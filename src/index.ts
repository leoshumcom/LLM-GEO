import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import type { Env } from './types';
import type { ExportedHandler, ScheduledEvent } from '@cloudflare/workers-types';

// 模块路由
import { authRouter } from './modules/auth/routes';
import { adminRouter } from './modules/admin/routes';
import { agentRouter } from './modules/agent/routes';
import { companyRouter } from './modules/company/routes';
import { apiRouter } from './modules/api/routes';
import { dashboardRouter } from './modules/dashboard/routes';
import { paymentRouter } from './modules/payment/routes';
import { publishRouter } from './modules/publish/routes';
// 管理后台页面路由
import { pagesRouter } from './pages/routes';
// Queue 消费者
import queueConsumer from './worker/queue-consumer';

const app = new Hono<{ Bindings: Env }>();

// ===== 全局中间件 =====
app.use('*', logger());
app.use('*', cors({
  origin: ['https://llmgeo.com', 'https://staging.llmgeo.com', 'http://localhost:8787'],
  credentials: true,
}));

// ===== 健康检查 =====
app.get('/api/health', (c) => {
  return c.json({
    success: true,
    message: 'LLMGEO API is running',
    version: '0.1.1',
    timestamp: new Date().toISOString(),
  });
});

// ===== 挂载模块路由 =====
app.route('/api/auth', authRouter);
app.route('/api/admin', adminRouter);
app.route('/api/agent', agentRouter);
app.route('/api/company', companyRouter);
app.route('/api/dashboard', dashboardRouter);
app.route('/api/payment', paymentRouter);
app.route('/payment', paymentRouter);
app.route('/api/publish', publishRouter);
app.route('/api', apiRouter);

// ===== 管理后台页面 =====
app.route('/', pagesRouter);

// ===== 404 处理 =====
app.notFound((c) => {
  return c.json({ success: false, error: 'Not Found' }, 404);
});

// ===== 全局错误处理 =====
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({ success: false, error: 'Internal Server Error' }, 500);
});

// ===== 导出：将 Hono 的 fetch 和 Queue consumer 合并导出 =====
export default {
  fetch: app.fetch,
  queue: queueConsumer.queue,
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const cron = event.cron;
    console.log(`[Cron] Triggered: ${cron}`);

    try {
      if (cron === '0 2 * * *') {
        // 每日凌晨2点：刷新过期的社媒令牌
        console.log('[Cron] Refreshing expired social tokens...');
        const expiredTokens = await env.DB.prepare(
          `SELECT id, tenant_id, platform, refresh_token FROM company_social_oauth
           WHERE token_expires_at < datetime('now') AND refresh_token IS NOT NULL AND refresh_token != ''`
        ).all();

        for (const token of (expiredTokens.results || []) as any[]) {
          try {
            // 标记为过期（后续可对接各平台刷新接口）
            await env.DB.prepare(
              `UPDATE company_social_oauth SET status = 'expired', updated_at = datetime('now') WHERE id = ?`
            ).bind(token.id).run();
          } catch (e) {
            console.error(`[Cron] Token refresh failed for ${token.id}:`, e);
          }
        }
        console.log(`[Cron] Refreshed ${expiredTokens.results?.length || 0} tokens`);
      }

      if (cron === '0 3 * * *') {
        // 每日凌晨3点：会员到期 / AI套餐到期检测
        console.log('[Cron] Checking expirations...');

        // AI套餐到期
        const expiredAiPackages = await env.DB.prepare(
          `SELECT tenant_id, company_name, contact_email, ai_package_type, ai_package_expires_at
           FROM sys_company
           WHERE ai_package_expires_at < datetime('now') AND ai_package_type != 'none' AND ai_package_type IS NOT NULL`
        ).all();

        for (const company of (expiredAiPackages.results || []) as any[]) {
          await env.DB.prepare(
            `UPDATE sys_company SET ai_package_type = 'none', updated_at = datetime('now') WHERE tenant_id = ?`
          ).bind(company.tenant_id).run();

          // 发送到期通知邮件
          if (company.contact_email) {
            const { sendExpiryReminder } = await import('./utils/email');
            ctx.waitUntil(sendExpiryReminder(
              company.contact_email,
              company.company_name,
              company.ai_package_expires_at,
              0
            ));
          }
          console.log(`[Cron] Expired AI package for ${company.tenant_id}`);
        }

        // 会员到期（提前7天和1天提醒）
        const expiringMemberships = await env.DB.prepare(
          `SELECT tenant_id, company_name, contact_email, membership_expires_at
           FROM sys_company
           WHERE status = 'active' AND membership_expires_at IS NOT NULL
             AND (
               julianday(membership_expires_at) - julianday('now') = 7
               OR julianday(membership_expires_at) - julianday('now') = 1
             )`
        ).all();

        for (const company of (expiringMemberships.results || []) as any[]) {
          if (company.contact_email) {
            const daysLeft = Math.ceil(
              (new Date(company.membership_expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
            );
            const { sendExpiryReminder } = await import('./utils/email');
            ctx.waitUntil(sendExpiryReminder(
              company.contact_email,
              company.company_name,
              company.membership_expires_at,
              daysLeft
            ));
          }
        }
        console.log(`[Cron] Checked ${expiringMemberships.results?.length || 0} expiring memberships`);
      }

      if (cron === '0 */6 * * *') {
        // 每6小时：处理待队列的重试任务（兜底）
        console.log('[Cron] Retry check for pending tasks...');
        const pendingContents = await env.DB.prepare(
          `SELECT id, tenant_id, keyword FROM ai_generate_content WHERE status = 'pending'
           AND created_at < datetime('now', '-1 hour')
           ORDER BY created_at ASC LIMIT 10`
        ).all();

        for (const content of (pendingContents.results || []) as any[]) {
          // 重发到队列
          await env.AI_GENERATE_QUEUE.send({
            type: 'ai_generate',
            contentId: content.id,
            tenantId: content.tenant_id,
            retryCount: 1,
          });
        }
        console.log(`[Cron] Retried ${pendingContents.results?.length || 0} pending tasks`);
      }

      console.log('[Cron] All tasks completed');
    } catch (e: any) {
      console.error('[Cron] Error:', e.message);
    }
  },
} as ExportedHandler<Env>;
