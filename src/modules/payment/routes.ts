import { Hono } from 'hono';
import type { Env, ApiResponse } from '../../types';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { createXunhupayOrder, verifyNotify } from '../../utils/payment';
import { sendOrderEmail } from '../../utils/email';

export const paymentRouter = new Hono<{ Bindings: Env }>();

// ========== 支付 - 创建订单 ==========
// POST /api/payment/create
// Body: { packageType: 'ai_daily' | 'ai_monthly' }
paymentRouter.post('/create', authMiddleware, requireRole('company'), async (c) => {
  try {
    const user = c.get('user');
    const { packageType } = await c.req.json<{ packageType: string }>();

    // 套餐定价
    const packages: Record<string, { name: string; price: number }> = {
      enterprise_self: { name: '企业自助版', price: 1688 },
      agent_standard: { name: '代理商版', price: 8888 },
      agent_premium: { name: '高级代理商版', price: 18888 },
    };

    const pkg = packages[packageType];
    if (!pkg) {
      return c.json({ success: false, error: '无效套餐类型' } as ApiResponse, 400);
    }

    // 生成本地订单号
    const orderNo = 'LLM' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();

    // 创建本地订单（未支付）
    const orderId = crypto.randomUUID();
    await c.env.DB.prepare(
      `INSERT INTO finance_order (id, order_no, order_type, amount, payment_status, tenant_id, description, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'pending', ?, ?, datetime('now'), datetime('now'))`
    ).bind(orderId, orderNo, packageType, pkg.price * 100, user.tenantId, pkg.name).run();

    // 调用虎皮椒支付
    const notifyUrl = c.env.APP_URL + '/api/payment/notify';
    const returnUrl = c.env.APP_URL + '/payment/success?order_no=' + orderNo;
    const now = Math.floor(Date.now() / 1000).toString();

    const payResult = await createXunhupayOrder({
      trade_order_id: orderNo,
      total_fee: pkg.price.toFixed(2),
      title: pkg.name + ' - LLMGEO',
      description: `LLMGEO ${pkg.name}`,
      time: now,
      notify_url: notifyUrl,
      return_url: returnUrl,
    });

    if (!payResult.success) {
      // 支付创建失败，将订单标记为失败
      await c.env.DB.prepare(
        `UPDATE finance_order SET payment_status = 'failed', updated_at = datetime('now') WHERE id = ?`
      ).bind(orderId).run();

      return c.json({ success: false, error: payResult.error } as ApiResponse, 400);
    }

    return c.json({
      success: true,
      data: {
        orderNo,
        packageType,
        amount: pkg.price,
        payUrl: payResult.url,
        qrcode: payResult.qrcode,
        payOrderId: payResult.order_id,
      },
      message: '订单创建成功，请完成支付',
    });
  } catch (e: any) {
    console.error('[Payment] Create error:', e.message);
    return c.json({ success: false, error: '创建订单失败' } as ApiResponse, 500);
  }
});

// ========== 支付 - 虎皮椒异步通知 ==========
// POST /api/payment/notify
paymentRouter.post('/notify', async (c) => {
  try {
    const formData = await c.req.formData();
    const params: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
      params[key] = value.toString();
    }

    console.log('[Payment] Notify received:', JSON.stringify(params));

    // 验证签名
    const result = await verifyNotify(params);
    if (!result.valid) {
      console.error('[Payment] Invalid signature');
      return c.text('sign_error');
    }

    const orderNo = result.trade_order_id;
    const totalFee = result.totalFee;
    const payOrderId = result.orderId;

    if (!orderNo) {
      return c.text('param_error');
    }

    // 查找订单
    const order = await c.env.DB.prepare(
      `SELECT id, order_type, amount, payment_status, tenant_id FROM finance_order WHERE order_no = ?`
    ).bind(orderNo).first<{
      id: string; order_type: string; amount: number;
      payment_status: string; tenant_id: string;
    }>();

    if (!order) {
      console.error('[Payment] Order not found:', orderNo);
      return c.text('order_not_found');
    }

    // 防止重复回调
    if (order.payment_status === 'paid') {
      console.log('[Payment] Order already paid:', orderNo);
      return c.text('success');
    }

    // 金额校验（元转分对比）
    const paidAmount = Math.round(parseFloat(totalFee || '0') * 100);
    if (paidAmount < order.amount) {
      console.error(`[Payment] Amount mismatch: expected ${order.amount}, got ${paidAmount}`);
      return c.text('amount_error');
    }

    // 更新订单状态
    await c.env.DB.prepare(
      `UPDATE finance_order SET payment_status = 'paid', paid_at = datetime('now'), transaction_id = ?, updated_at = datetime('now') WHERE id = ?`
    ).bind(payOrderId || '', order.id).run();

    // 根据套餐类型处理
    if (order.order_type === 'enterprise_self') {
      // 企业自助版：永久会员（+3650天），不改变身份
      await c.env.DB.prepare(
        `UPDATE sys_company SET
          membership_expires_at = datetime('now', '+3650 days'),
          updated_at = datetime('now')
         WHERE tenant_id = ?`
      ).bind(order.tenant_id).run();
    } else if (order.order_type === 'agent_standard') {
      // 代理商版：升级为代理商 + 充值 ¥8,888 余额
      // 1. 查找企业邮箱
      const company = await c.env.DB.prepare(
        `SELECT id, company_name, contact_email, contact_phone FROM sys_company WHERE tenant_id = ?`
      ).bind(order.tenant_id).first<{ id: string; company_name: string; contact_email: string; contact_phone: string }>();

      if (company) {
        // 创建代理商账户（如果不存在）
        const existingAgent = await c.env.DB.prepare(
          `SELECT id, balance FROM sys_agent WHERE email = ?`
        ).bind(company.contact_email).first<{ id: string; balance: number }>();

        if (existingAgent) {
          // 已有代理商 → 充值余额
          const newBalance = existingAgent.balance + 888800;
          await c.env.DB.prepare(
            `UPDATE sys_agent SET balance = ?, updated_at = datetime('now') WHERE id = ?`
          ).bind(newBalance, existingAgent.id).run();
        } else {
          // 创建新代理商
          const agentId = crypto.randomUUID();
          await c.env.DB.prepare(
            `INSERT INTO sys_agent (id, email, company_name, phone, balance, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, 888800, 'active', datetime('now'), datetime('now'))`
          ).bind(agentId, company.contact_email, company.company_name, company.contact_phone || '').run();

          // 分配代理商角色
          await c.env.DB.prepare(
            `INSERT INTO sys_user_role (id, user_id, user_type, role_id, created_at)
             VALUES (?, ?, 'agent', 'role_agent', datetime('now'))`
          ).bind(crypto.randomUUID(), agentId).run();

          // 记录余额变动日志
          await c.env.DB.prepare(
            `INSERT INTO agent_balance_log (id, agent_id, order_id, change_amount, balance_before, balance_after, operation_type, description, created_at)
             VALUES (?, ?, ?, 888800, 0, 888800, 'recharge', ?, datetime('now'))`
          ).bind(crypto.randomUUID(), agentId, order.id, '代理商版套餐购买: ' + orderNo).run();
        }

        // 企业端：设为代理商标识
        await c.env.DB.prepare(
          `UPDATE sys_company SET registration_type = 'agent', membership_expires_at = datetime('now', '+3650 days'), updated_at = datetime('now') WHERE tenant_id = ?`
        ).bind(order.tenant_id).run();
      }
    } else if (order.order_type === 'agent_premium') {
      // 高级代理商版：升级为代理商 + 充值 ¥26,888（= 18888 + 8000 赠金）
      const company = await c.env.DB.prepare(
        `SELECT id, company_name, contact_email, contact_phone FROM sys_company WHERE tenant_id = ?`
      ).bind(order.tenant_id).first<{ id: string; company_name: string; contact_email: string; contact_phone: string }>();

      if (company) {
        const existingAgent = await c.env.DB.prepare(
          `SELECT id, balance FROM sys_agent WHERE email = ?`
        ).bind(company.contact_email).first<{ id: string; balance: number }>();

        if (existingAgent) {
          const newBalance = existingAgent.balance + 268800;
          await c.env.DB.prepare(
            `UPDATE sys_agent SET balance = ?, updated_at = datetime('now') WHERE id = ?`
          ).bind(newBalance, existingAgent.id).run();
        } else {
          const agentId = crypto.randomUUID();
          await c.env.DB.prepare(
            `INSERT INTO sys_agent (id, email, company_name, phone, balance, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, 268800, 'active', datetime('now'), datetime('now'))`
          ).bind(agentId, company.contact_email, company.company_name, company.contact_phone || '').run();

          await c.env.DB.prepare(
            `INSERT INTO sys_user_role (id, user_id, user_type, role_id, created_at)
             VALUES (?, ?, 'agent', 'role_agent', datetime('now'))`
          ).bind(crypto.randomUUID(), agentId).run();

          await c.env.DB.prepare(
            `INSERT INTO agent_balance_log (id, agent_id, order_id, change_amount, balance_before, balance_after, operation_type, description, created_at)
             VALUES (?, ?, ?, 268800, 0, 268800, 'recharge', ?, datetime('now'))`
          ).bind(crypto.randomUUID(), agentId, order.id, '高级代理商版套餐购买: ' + orderNo).run();
        }

        await c.env.DB.prepare(
          `UPDATE sys_company SET registration_type = 'agent', membership_expires_at = datetime('now', '+3650 days'), updated_at = datetime('now') WHERE tenant_id = ?`
        ).bind(order.tenant_id).run();
      }
    }

    // 发送支付成功邮件通知（非阻塞）
    try {
      const company = await c.env.DB.prepare(
        `SELECT contact_email, company_name FROM sys_company WHERE tenant_id = ?`
      ).bind(order.tenant_id).first<{ contact_email: string; company_name: string }>();
      if (company?.contact_email) {
        const pkgNames: Record<string, string> = {
          ai_daily: 'AI 日套餐', ai_monthly: 'AI 月套餐',
          ai_quarterly: 'AI 季套餐', ai_yearly: 'AI 年套餐',
        };
        sendOrderEmail(
          company.contact_email,
          orderNo,
          pkgNames[order.order_type] || order.order_type,
          `¥${(order.amount / 100).toFixed(2)}`,
          'paid'
        );
      }
    } catch (emailErr) {
      console.error('[Payment] Email send error:', emailErr);
    }

    console.log(`[Payment] Order ${orderNo} paid successfully`);
    return c.text('success');
  } catch (e: any) {
    console.error('[Payment] Notify error:', e.message);
    return c.text('error');
  }
});

// ========== 支付 - 查询订单状态 ==========
// GET /api/payment/status/:orderNo
paymentRouter.get('/status/:orderNo', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const orderNo = c.req.param('orderNo');

    const order = await c.env.DB.prepare(
      `SELECT order_no, order_type, amount, payment_status, transaction_id, description, paid_at, created_at
       FROM finance_order WHERE order_no = ? AND tenant_id = ?`
    ).bind(orderNo, user.tenantId).first();

    if (!order) {
      return c.json({ success: false, error: '订单不存在' } as ApiResponse, 404);
    }

    return c.json({ success: true, data: order });
  } catch (e: any) {
    return c.json({ success: false, error: '查询失败' } as ApiResponse, 500);
  }
});

// ========== 支付 - 查询历史订单 ==========
// GET /api/payment/orders
paymentRouter.get('/orders', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const page = parseInt(c.req.query('page') || '1');
    const pageSize = Math.min(parseInt(c.req.query('pageSize') || '20'), 100);
    const offset = (page - 1) * pageSize;

    const total = await c.env.DB.prepare(
      `SELECT COUNT(*) as count FROM finance_order WHERE tenant_id = ?`
    ).bind(user.tenantId).first<{ count: number }>();

    const items = await c.env.DB.prepare(
      `SELECT order_no, order_type, amount, payment_status, description, paid_at, created_at
       FROM finance_order WHERE tenant_id = ?
       ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).bind(user.tenantId, pageSize, offset).all();

    return c.json({
      success: true,
      data: {
        items: items.results || [],
        total: total?.count || 0,
        page, pageSize,
      }
    });
  } catch (e: any) {
    return c.json({ success: false, error: '查询失败' } as ApiResponse, 500);
  }
});

// ========== 支付成功页（同步回跳） ==========
// GET /payment/success
// 这是一个简单的页面跳转（非 API），放在这里便于路由统一
paymentRouter.get('/success', (c) => {
  const orderNo = c.req.query('order_no') || '';
  return c.html(`<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><title>支付成功 - LLMGEO</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body { font-family: -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f0fdf4; }
  .card { text-align: center; padding: 48px; background: white; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); max-width: 400px; }
  .icon { font-size: 64px; margin-bottom: 16px; }
  h1 { color: #16a34a; margin: 0 0 8px; }
  p { color: #666; margin: 0 0 24px; }
  .order { color: #999; font-size: 14px; }
  a { display: inline-block; padding: 12px 32px; background: #16a34a; color: white; text-decoration: none; border-radius: 8px; }
</style>
</head>
<body><div class="card">
  <div class="icon">🎉</div>
  <h1>支付成功</h1>
  <p>您的订单已完成支付</p>
  <div class="order">订单号：${orderNo}</div>
  <a href="${c.env.APP_URL}">返回首页</a>
</div></body></html>`);
});
