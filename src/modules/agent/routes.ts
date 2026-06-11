import { Hono } from 'hono';
import type { Env, ApiResponse } from '../../types';
import { authMiddleware, requireRole, generateToken } from '../../middleware/auth';

export const agentRouter = new Hono<{ Bindings: Env }>();

agentRouter.use('*', authMiddleware);
agentRouter.use('*', requireRole('agent'));

// ========== 代理商看板 ==========
agentRouter.get('/dashboard', async (c) => {
  try {
    const user = c.get('user');
    const agent = await c.env.DB.prepare(
      `SELECT id, username, email, balance, contact_phone, paid_8888, expiry_reminder, status, created_at
       FROM sys_agent WHERE id = ?`
    ).bind(user.userId).first();

    if (!agent) return c.json({ success: false, error: '代理商信息不存在' }, 404);

    // 名下企业数
    const companyCount = await c.env.DB.prepare(
      `SELECT COUNT(*) as cnt FROM sys_company WHERE agent_id = ?`
    ).bind(user.userId).first();
    
    // 本月新增企业数
    const monthlyNew = await c.env.DB.prepare(
      `SELECT COUNT(*) as cnt FROM sys_company WHERE agent_id = ? AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')`
    ).bind(user.userId).first();

    // 最近订单
    const recentOrders = await c.env.DB.prepare(
      `SELECT order_no, order_type, amount, payment_status, description, created_at
       FROM finance_order WHERE agent_id = ?
       ORDER BY created_at DESC LIMIT 5`
    ).bind(user.userId).all();

    return c.json({
      success: true,
      data: {
        ...agent,
        companyCount: companyCount?.cnt || 0,
        monthlyNewCompanies: monthlyNew?.cnt || 0,
        recentOrders: recentOrders.results || [],
      }
    });
  } catch (e) {
    console.error('[Agent] Dashboard error:', e);
    return c.json({ success: false, error: '获取看板失败' }, 500);
  }
});

// ========== 名下企业管理 ==========
agentRouter.get('/companies', async (c) => {
  try {
    const user = c.get('user');
    const page = parseInt(c.req.query('page') || '1');
    const pageSize = Math.min(parseInt(c.req.query('pageSize') || '20'), 100);
    const offset = (page - 1) * pageSize;
    const status = c.req.query('status') || '';

    let whereClause = 'WHERE agent_id = ?';
    const params = [user.userId];
    if (status) { whereClause += ' AND status = ?'; params.push(status); }

    const total = await c.env.DB.prepare(
      `SELECT COUNT(*) as count FROM sys_company ${whereClause}`
    ).bind(...params).first();

    const items = await c.env.DB.prepare(
      `SELECT id, tenant_id, company_name, brand_name, website, contact_email,
              contact_phone, registration_type, registration_fee, status,
              membership_expires_at, ai_package_type, ai_package_expires_at,
              created_at
       FROM sys_company ${whereClause}
       ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).bind(...params, pageSize, offset).all();

    return c.json({
      success: true,
      data: {
        items: items.results || [],
        total: total?.count || 0,
        page, pageSize,
        totalPages: Math.ceil((total?.count || 0) / pageSize)
      }
    });
  } catch (e) {
    console.error('[Agent] Companies error:', e);
    return c.json({ success: false, error: '获取企业列表失败' }, 500);
  }
});

// ========== 代开企业租户 ==========
agentRouter.post('/companies', async (c) => {
  try {
    const user = c.get('user');
    const { companyName, email, brandName, website, phone, registrationFee } = await c.req.json();

    if (!companyName || !email) {
      return c.json({ success: false, error: '企业名称和邮箱必填' }, 400);
    }

    // 查重
    const existing = await c.env.DB.prepare(
      `SELECT id FROM sys_company WHERE contact_email = ?`
    ).bind(email).first();
    if (existing) return c.json({ success: false, error: '该邮箱已被注册' }, 409);

    const existingName = await c.env.DB.prepare(
      `SELECT id FROM sys_company WHERE company_name = ?`
    ).bind(companyName).first();
    if (existingName) return c.json({ success: false, error: '该企业名称已被注册' }, 409);

    const userId = crypto.randomUUID();
    const tenantId = 'tenant_' + crypto.randomUUID().slice(0, 8);
    const fee = registrationFee || 168800; // 默认 1688 元

    // 检查代理商余额
    const agent = await c.env.DB.prepare(
      `SELECT balance FROM sys_agent WHERE id = ?`
    ).bind(user.userId).first();

    if (!agent || agent.balance < fee) {
      return c.json({ success: false, error: '代理商余额不足，请先充值' }, 400);
    }

    // 扣减余额并创建企业（赠送 AI 免费试用 + 365天会员）
    const trialDays = await c.env.DB.prepare(
      `SELECT config_value FROM system_config WHERE config_key = 'ai_free_trial_days'`
    ).first<{ config_value: string }>();
    const freeTrialDays = parseInt(trialDays?.config_value || '7');

    await c.env.DB.prepare(
      `INSERT INTO sys_company (id, agent_id, tenant_id, company_name, brand_name, website, contact_email, contact_phone, registration_type, registration_fee, membership_expires_at, ai_package_type, ai_package_expires_at, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'agent', ?, datetime('now', '+365 days'), 'daily', datetime('now', '+${freeTrialDays} days'), 'active', datetime('now'), datetime('now'))`
    ).bind(userId, user.userId, tenantId, companyName, brandName || companyName, website || '', email, phone || '', fee).run();

    // 扣余额
    await c.env.DB.prepare(
      `UPDATE sys_agent SET balance = balance - ? WHERE id = ?`
    ).bind(fee, user.userId).run();

    // 余额变动日志
    const logId = crypto.randomUUID();
    const afterBalance = agent.balance - fee;
    await c.env.DB.prepare(
      `INSERT INTO agent_balance_log (id, agent_id, order_id, change_amount, balance_before, balance_after, operation_type, description, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'deduct', ?, datetime('now'))`
    ).bind(logId, user.userId, userId, -fee, agent.balance, afterBalance, '代理开通企业: ' + companyName).run();

    return c.json({
      success: true,
      data: { userId, tenantId, companyName, fee, balanceAfter: afterBalance },
      message: '企业创建成功'
    });
  } catch (e) {
    console.error('[Agent] Create company error:', e);
    return c.json({ success: false, error: '创建企业失败' }, 500);
  }
});

// ========== 余额查询 ==========
agentRouter.get('/balance', async (c) => {
  try {
    const user = c.get('user');
    const agent = await c.env.DB.prepare(
      `SELECT balance, paid_8888 FROM sys_agent WHERE id = ?`
    ).bind(user.userId).first();

    // 最近10条余额变动
    const logs = await c.env.DB.prepare(
      `SELECT change_amount, balance_before, balance_after, operation_type, description, created_at
       FROM agent_balance_log WHERE agent_id = ?
       ORDER BY created_at DESC LIMIT 10`
    ).bind(user.userId).all();

    return c.json({
      success: true,
      data: {
        balance: agent?.balance || 0,
        paid_8888: agent?.paid_8888 || 0,
        logs: logs.results || [],
      }
    });
  } catch (e) {
    return c.json({ success: false, error: '查询余额失败' }, 500);
  }
});

// ========== 余额流水 ==========
agentRouter.get('/balance/log', async (c) => {
  try {
    const user = c.get('user');
    const page = parseInt(c.req.query('page') || '1');
    const pageSize = Math.min(parseInt(c.req.query('pageSize') || '20'), 100);
    const offset = (page - 1) * pageSize;

    const total = await c.env.DB.prepare(
      `SELECT COUNT(*) as cnt FROM agent_balance_log WHERE agent_id = ?`
    ).bind(user.userId).first();
    const items = await c.env.DB.prepare(
      `SELECT change_amount, balance_before, balance_after, operation_type, description, created_at
       FROM agent_balance_log WHERE agent_id = ?
       ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).bind(user.userId, pageSize, offset).all();

    return c.json({
      success: true,
      data: {
        items: items.results || [],
        total: total?.cnt || 0,
        page, pageSize,
        totalPages: Math.ceil((total?.cnt || 0) / pageSize)
      }
    });
  } catch (e) {
    return c.json({ success: false, error: '查询余额流水失败' }, 500);
  }
});

// ========== 余额充值（通过虎皮椒支付） ==========
agentRouter.post('/recharge', async (c) => {
  try {
    const user = c.get('user');
    const { amount } = await c.req.json();
    
    if (!amount || amount <= 0) {
      return c.json({ success: false, error: '充值金额须大于0' }, 400);
    }

    const orderId = crypto.randomUUID();
    const orderNo = 'AR' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
    const description = '代理商余额充值 ' + (amount / 100).toFixed(2) + '元';

    // 创建本地订单
    await c.env.DB.prepare(
      `INSERT INTO finance_order (id, order_no, order_type, amount, payment_status, agent_id, description, created_at, updated_at)
       VALUES (?, ?, 'agent_recharge', ?, 'pending', ?, ?, datetime('now'), datetime('now'))`
    ).bind(orderId, orderNo, amount, user.userId, description).run();

    // 调用虎皮椒支付
    const { createXunhupayOrder } = await import('../../utils/payment');
    const notifyUrl = c.env.APP_URL + '/api/agent/payment/notify';
    const returnUrl = c.env.APP_URL + '/agent/balance?order_no=' + orderNo;
    const now = Math.floor(Date.now() / 1000).toString();

    const payResult = await createXunhupayOrder({
      trade_order_id: orderNo,
      total_fee: (amount / 100).toFixed(2),
      title: 'LLMGEO 代理商余额充值',
      description: description,
      time: now,
      notify_url: notifyUrl,
      return_url: returnUrl,
    });

    if (!payResult.success) {
      await c.env.DB.prepare(
        `UPDATE finance_order SET payment_status = 'failed', updated_at = datetime('now') WHERE id = ?`
      ).bind(orderId).run();
      return c.json({ success: false, error: payResult.error || '支付创建失败' }, 400);
    }

    return c.json({
      success: true,
      data: {
        orderNo,
        amount,
        payUrl: payResult.url,
        qrcode: payResult.qrcode,
        payOrderId: payResult.order_id,
      },
      message: '充值订单已创建，请完成支付'
    });
  } catch (e) {
    console.error('[Agent] Recharge error:', e);
    return c.json({ success: false, error: '创建充值订单失败' }, 500);
  }
});

// ========== 代理商充值回调（虎皮椒异步通知） ==========
agentRouter.post('/payment/notify', async (c) => {
  try {
    const formData = await c.req.formData();
    const params: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
      params[key] = value.toString();
    }

    console.log('[Agent Payment Notify] Received:', JSON.stringify({ ...params, hash: params.hash?.substring(0, 8) + '...' }));

    const { verifyNotify } = await import('../../utils/payment');
    const result = await verifyNotify(params);
    if (!result.valid) {
      console.error('[Agent Payment Notify] Invalid signature');
      return c.text('sign_error');
    }

    const orderNo = result.trade_order_id;
    if (!orderNo) return c.text('param_error');

    // 查找订单
    const order = await c.env.DB.prepare(
      `SELECT id, amount, payment_status, agent_id FROM finance_order WHERE order_no = ? AND order_type = 'agent_recharge'`
    ).first<{ id: string; amount: number; payment_status: string; agent_id: string }>();

    if (!order) {
      console.error('[Agent Payment Notify] Order not found:', orderNo);
      return c.text('order_not_found');
    }

    if (order.payment_status === 'paid') {
      console.log('[Agent Payment Notify] Already paid:', orderNo);
      return c.text('success');
    }

    // 金额校验
    const paidAmount = Math.round(parseFloat(result.totalFee || '0') * 100);
    if (paidAmount < order.amount) {
      console.error(`[Agent Payment Notify] Amount mismatch: expected ${order.amount}, got ${paidAmount}`);
      return c.text('amount_error');
    }

    // 更新订单状态为 paid
    await c.env.DB.prepare(
      `UPDATE finance_order SET payment_status = 'paid', paid_at = datetime('now'), transaction_id = ?, updated_at = datetime('now') WHERE id = ?`
    ).bind(result.orderId || '', order.id).run();

    // 增加代理商余额
    const agent = await c.env.DB.prepare(
      `SELECT balance FROM sys_agent WHERE id = ?`
    ).bind(order.agent_id).first<{ balance: number }>();

    if (agent) {
      const beforeBalance = agent.balance;
      const afterBalance = beforeBalance + order.amount;

      await c.env.DB.prepare(
        `UPDATE sys_agent SET balance = ?, updated_at = datetime('now') WHERE id = ?`
      ).bind(afterBalance, order.agent_id).run();

      // 余额变动日志
      const logId = crypto.randomUUID();
      await c.env.DB.prepare(
        `INSERT INTO agent_balance_log (id, agent_id, order_id, change_amount, balance_before, balance_after, operation_type, description, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'recharge', ?, datetime('now'))`
      ).bind(logId, order.agent_id, order.id, order.amount, beforeBalance, afterBalance, '代理商充值: ' + orderNo).run();
    }

    console.log(`[Agent Payment Notify] Order ${orderNo} recharge success, amount: ${order.amount}`);
    return c.text('success');
  } catch (e: any) {
    console.error('[Agent Payment Notify] Error:', e.message);
    return c.text('error');
  }
});

// ========== 订单历史 ==========
agentRouter.get('/orders', async (c) => {
  try {
    const user = c.get('user');
    const page = parseInt(c.req.query('page') || '1');
    const pageSize = parseInt(c.req.query('pageSize') || '20');
    const offset = (page - 1) * pageSize;

    const total = await c.env.DB.prepare(
      `SELECT COUNT(*) as cnt FROM finance_order WHERE agent_id = ?`
    ).bind(user.userId).first();

    const items = await c.env.DB.prepare(
      `SELECT order_no, order_type, amount, payment_status, description, paid_at, created_at
       FROM finance_order WHERE agent_id = ?
       ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).bind(user.userId, pageSize, offset).all();

    return c.json({
      success: true,
      data: {
        items: items.results || [],
        total: total?.cnt || 0,
        page, pageSize,
        totalPages: Math.ceil((total?.cnt || 0) / pageSize)
      }
    });
  } catch (e) {
    return c.json({ success: false, error: '查询订单失败' }, 500);
  }
});

// ========== 7天退款 - 代理商提交企业注销退款申请 ==========
agentRouter.post('/companies/:id/refund', async (c) => {
  try {
    const user = c.get('user');
    const companyId = c.req.param('id');

    // 检查企业是否在当前代理商名下
    const company = await c.env.DB.prepare(
      `SELECT id, agent_id, status, created_at, registration_fee
       FROM sys_company WHERE id = ? AND agent_id = ?`
    ).bind(companyId, user.userId).first<{
      id: string; agent_id: string; status: string;
      created_at: string; registration_fee: number;
    }>();

    if (!company) {
      return c.json({ success: false, error: '企业不存在或不属于您' }, 404);
    }

    if (company.status !== 'active') {
      return c.json({ success: false, error: '企业状态不合法，无法申请退款' }, 400);
    }

    // 检查创建时间是否在 7 天内
    const createdAt = new Date(company.created_at);
    const now = new Date();
    const daysDiff = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

    // 从系统配置读取退款宽限期（默认7天）
    let refundGraceDays = 7;
    try {
      const config = await c.env.DB.prepare(
        `SELECT config_value FROM system_config WHERE config_key = 'refund_grace_days'`
      ).first<{ config_value: string }>();
      if (config) refundGraceDays = parseInt(config.config_value) || 7;
    } catch (_) {}

    if (daysDiff > refundGraceDays) {
      return c.json({
        success: false,
        error: `企业创建已超过 ${refundGraceDays} 天，无法申请退款`
      }, 400);
    }

    // 更新企业状态为 refund_pending，记录申请时间
    await c.env.DB.prepare(
      `UPDATE sys_company SET status = 'refund_pending', refund_requested_at = datetime('now'), updated_at = datetime('now')
       WHERE id = ? AND agent_id = ?`
    ).bind(companyId, user.userId).run();

    // 记录日志
    await c.env.DB.prepare(
      `INSERT INTO system_log (id, user_id, user_type, action, target_type, target_id, detail, created_at)
       VALUES (?, ?, 'agent', 'refund_request', 'sys_company', ?, ?, datetime('now'))`
    ).bind(crypto.randomUUID(), user.userId, companyId,
      `代理商申请退款: 企业ID=${companyId}, 费用=${company.registration_fee}分`).run();

    return c.json({
      success: true,
      message: '退款申请已提交，等待管理员审核'
    });
  } catch (e) {
    console.error('[Agent] Refund error:', e);
    return c.json({ success: false, error: '提交退款申请失败' }, 500);
  }
});

// ========== 增值预约（代理商提交，免单） ==========
agentRouter.post('/reservations', async (c) => {
  try {
    const user = c.get('user');
    const { serviceType, applicantName, contact, requirement } = await c.req.json();

    if (!serviceType || !applicantName || !contact) {
      return c.json({ success: false, error: '请填写完整信息' }, 400);
    }

    const id = crypto.randomUUID();
    await c.env.DB.prepare(
      `INSERT INTO reservation_form (id, agent_id, service_type, applicant_name, contact, requirement, payment_status, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'paid', 'pending', datetime('now'), datetime('now'))`
    ).bind(id, user.userId, serviceType, applicantName, contact, requirement || '').run();

    return c.json({ success: true, data: { id }, message: '预约已提交（免单）' });
  } catch (e) {
    return c.json({ success: false, error: '提交预约失败' }, 500);
  }
});
