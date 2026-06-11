import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import type { Env } from './types';

// 模块路由
import { authRouter } from './modules/auth/routes';
import { adminRouter } from './modules/admin/routes';
import { agentRouter } from './modules/agent/routes';
import { companyRouter } from './modules/company/routes';
import { apiRouter } from './modules/api/routes';
import { dashboardRouter } from './modules/dashboard/routes';
import { paymentRouter } from './modules/payment/routes';
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
};
