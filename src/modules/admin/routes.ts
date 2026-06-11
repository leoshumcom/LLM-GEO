import { Hono } from 'hono';
import type { Env, ApiResponse } from '../../types';
import { authMiddleware, requireRole } from '../../middleware/auth';

export const adminRouter = new Hono<{ Bindings: Env }>();

adminRouter.use('*', authMiddleware);
adminRouter.use('*', requireRole('admin'));

// ========== 全局数据看板 ==========
adminRouter.get('/dashboard', async (c) => {
  try {
    const totalCompanies = await c.env.DB.prepare('SELECT COUNT(*) as cnt FROM sys_company').first();
    const activeCompanies = await c.env.DB.prepare("SELECT COUNT(*) as cnt FROM sys_company WHERE status = 'active'").first();
    const totalAgents = await c.env.DB.prepare("SELECT COUNT(*) as cnt FROM sys_agent WHERE status = 'active'").first();
    const totalOrders = await c.env.DB.prepare("SELECT COUNT(*) as cnt FROM finance_order WHERE payment_status = 'paid'").first();
    const todayOrders = await c.env.DB.prepare(
      "SELECT COUNT(*) as cnt, COALESCE(SUM(amount), 0) as amount FROM finance_order WHERE payment_status = 'paid' AND date(paid_at) = date('now')"
    ).first();
    const pendingReservations = await c.env.DB.prepare("SELECT COUNT(*) as cnt FROM reservation_form WHERE status = 'pending'").first();
    const totalKws = await c.env.DB.prepare('SELECT COUNT(*) as cnt FROM company_keyword').first();
    const pendingKws = await c.env.DB.prepare("SELECT COUNT(*) as cnt FROM company_keyword WHERE status = 'pending'").first();

    return c.json({
      success: true,
      data: {
        totalCompanies: totalCompanies?.cnt || 0,
        activeCompanies: activeCompanies?.cnt || 0,
        totalAgents: totalAgents?.cnt || 0,
        totalPaidOrders: totalOrders?.cnt || 0,
        todayPaidOrders: todayOrders?.cnt || 0,
        todayRevenue: todayOrders?.amount || 0,
        pendingReservations: pendingReservations?.cnt || 0,
        totalKeywords: totalKws?.cnt || 0,
        pendingKeywords: pendingKws?.cnt || 0,
      }
    });
  } catch (e) {
    console.error('[Admin] Dashboard error:', e);
    return c.json({ success: false, error: '获取看板失败' }, 500);
  }
});

// ========== 代理商管理 ==========
adminRouter.get('/agents', async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1');
    const pageSize = Math.min(parseInt(c.req.query('pageSize') || '20'), 100);
    const offset = (page - 1) * pageSize;
    const status = c.req.query('status') || '';

    let whereClause = 'WHERE 1=1';
    const params = [];
    if (status) { whereClause += ' AND status = ?'; params.push(status); }

    const total = await c.env.DB.prepare('SELECT COUNT(*) as cnt FROM sys_agent ' + whereClause).bind(...params).first();

    const items = await c.env.DB.prepare(
      'SELECT id, username, email, balance, paid_8888, contact_phone, status, created_at FROM sys_agent ' + whereClause + ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
    ).bind(...params, pageSize, offset).all();

    // 获取每家代理商名下企业数
    const itemsWithCount = [];
    for (const item of items.results || []) {
      const cnt = await c.env.DB.prepare('SELECT COUNT(*) as cnt FROM sys_company WHERE agent_id = ?').bind(item.id).first();
      itemsWithCount.push({ ...item, companyCount: cnt?.cnt || 0 });
    }

    return c.json({
      success: true,
      data: {
        items: itemsWithCount,
        total: total?.cnt || 0,
        page, pageSize,
        totalPages: Math.ceil((total?.cnt || 0) / pageSize)
      }
    });
  } catch (e) {
    return c.json({ success: false, error: '获取代理商列表失败' }, 500);
  }
});

// POST /api/admin/agents - 创建代理商
adminRouter.post('/agents', async (c) => {
  try {
    const { username, password, email, phone, initialBalance } = await c.req.json();

    if (!username || !password || !email) {
      return c.json({ success: false, error: '用户名、密码、邮箱必填' }, 400);
    }

    const existing = await c.env.DB.prepare('SELECT id FROM sys_agent WHERE username = ? OR email = ?').bind(username, email).first();
    if (existing) return c.json({ success: false, error: '用户名或邮箱已存在' }, 409);

    const encoder = new TextEncoder();
    const pwdData = encoder.encode(password + 'llmgeo_salt_2024');
    const hashBuf = await crypto.subtle.digest('SHA-256', pwdData);
    const hashArr = Array.from(new Uint8Array(hashBuf));
    const pwdHash = hashArr.map(b => b.toString(16).padStart(2, '0')).join('');

    const id = crypto.randomUUID();
    await c.env.DB.prepare(
      `INSERT INTO sys_agent (id, username, password_hash, email, balance, contact_phone, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'active', datetime('now'), datetime('now'))`
    ).bind(id, username, pwdHash, email, initialBalance || 0, phone || '').run();

    // 分配角色
    await c.env.DB.prepare(
      `INSERT INTO sys_user_role (id, user_id, user_type, role_id, created_at)
       VALUES (?, ?, 'agent', 'role_agent', datetime('now'))`
    ).bind(crypto.randomUUID(), id).run();

    return c.json({ success: true, data: { id }, message: '代理商创建成功' });
  } catch (e) {
    return c.json({ success: false, error: '创建代理商失败' }, 500);
  }
});

// PUT /api/admin/agents/:id - 更新代理商
adminRouter.put('/agents/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const { balance, status } = await c.req.json();

    if (balance !== undefined) {
      await c.env.DB.prepare('UPDATE sys_agent SET balance = ?, updated_at = datetime(\'now\') WHERE id = ?').bind(balance, id).run();
    }
    if (status) {
      await c.env.DB.prepare('UPDATE sys_agent SET status = ?, updated_at = datetime(\'now\') WHERE id = ?').bind(status, id).run();
    }

    return c.json({ success: true, message: '代理商信息已更新' });
  } catch (e) {
    return c.json({ success: false, error: '更新失败' }, 500);
  }
});

// ========== 企业管理（总览） ==========
adminRouter.get('/companies', async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1');
    const pageSize = Math.min(parseInt(c.req.query('pageSize') || '20'), 100);
    const offset = (page - 1) * pageSize;
    const status = c.req.query('status') || '';

    let whereClause = 'WHERE 1=1';
    const params = [];
    if (status) { whereClause += ' AND status = ?'; params.push(status); }

    const total = await c.env.DB.prepare('SELECT COUNT(*) as cnt FROM sys_company ' + whereClause).bind(...params).first();

    const items = await c.env.DB.prepare(
      `SELECT sc.id, sc.tenant_id, sc.company_name, sc.brand_name, sc.contact_email, sc.registration_type, sc.registration_fee, sc.status, sc.membership_expires_at, sc.ai_package_type, sc.created_at, sa.username as agent_name
       FROM sys_company sc LEFT JOIN sys_agent sa ON sc.agent_id = sa.id ` + whereClause + ' ORDER BY sc.created_at DESC LIMIT ? OFFSET ?'
    ).bind(...params, pageSize, offset).all();

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
    return c.json({ success: false, error: '获取企业列表失败' }, 500);
  }
});

// ========== 财务管理 ==========
adminRouter.get('/finance', async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1');
    const pageSize = Math.min(parseInt(c.req.query('pageSize') || '20'), 100);
    const offset = (page - 1) * pageSize;
    const status = c.req.query('status') || '';

    let whereClause = 'WHERE 1=1';
    const params = [];
    if (status) { whereClause += ' AND payment_status = ?'; params.push(status); }

    const total = await c.env.DB.prepare('SELECT COUNT(*) as cnt FROM finance_order ' + whereClause).bind(...params).first();

    const items = await c.env.DB.prepare(
      `SELECT fo.order_no, fo.order_type, fo.amount, fo.payment_status, fo.payment_method, fo.paid_at, fo.description, fo.created_at,
              sc.company_name as tenant_name, sa.username as agent_name
       FROM finance_order fo
       LEFT JOIN sys_company sc ON fo.tenant_id = sc.tenant_id
       LEFT JOIN sys_agent sa ON fo.agent_id = sa.id ` + whereClause + ' ORDER BY fo.created_at DESC LIMIT ? OFFSET ?'
    ).bind(...params, pageSize, offset).all();

    // 汇总
    const totals = await c.env.DB.prepare(
      `SELECT payment_status, COUNT(*) as cnt, COALESCE(SUM(amount), 0) as amount
       FROM finance_order GROUP BY payment_status`
    ).all();

    return c.json({
      success: true,
      data: {
        items: items.results || [],
        total: total?.cnt || 0,
        page, pageSize,
        totalPages: Math.ceil((total?.cnt || 0) / pageSize),
        summary: totals.results || [],
      }
    });
  } catch (e) {
    return c.json({ success: false, error: '获取财务数据失败' }, 500);
  }
});

// ========== 预约管理 ==========
adminRouter.get('/reservations', async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1');
    const pageSize = Math.min(parseInt(c.req.query('pageSize') || '20'), 100);
    const offset = (page - 1) * pageSize;
    const status = c.req.query('status') || '';

    let whereClause = 'WHERE 1=1';
    const params = [];
    if (status) { whereClause += ' AND r.status = ?'; params.push(status); }

    const total = await c.env.DB.prepare('SELECT COUNT(*) as cnt FROM reservation_form r ' + whereClause).bind(...params).first();
    const items = await c.env.DB.prepare(
      `SELECT r.*, sc.company_name FROM reservation_form r
       LEFT JOIN sys_company sc ON r.tenant_id = sc.tenant_id ` + whereClause + ' ORDER BY r.created_at DESC LIMIT ? OFFSET ?'
    ).bind(...params, pageSize, offset).all();

    return c.json({
      success: true,
      data: {
        items: items.results || [],
        total: total?.cnt || 0,
        page, pageSize,
      }
    });
  } catch (e) {
    return c.json({ success: false, error: '获取预约列表失败' }, 500);
  }
});

// PUT /api/admin/reservations/:id - 处理预约
adminRouter.put('/reservations/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const { status, remark } = await c.req.json();

    if (!['pending', 'contacted', 'completed', 'cancelled'].includes(status)) {
      return c.json({ success: false, error: '无效的状态' }, 400);
    }

    await c.env.DB.prepare(
      `UPDATE reservation_form SET status = ?, updated_at = datetime('now') WHERE id = ?`
    ).bind(status, id).run();

    return c.json({ success: true, message: '预约状态已更新' });
  } catch (e) {
    return c.json({ success: false, error: '更新失败' }, 500);
  }
});

// ========== 系统配置管理 ==========
adminRouter.get('/config', async (c) => {
  try {
    const configs = await c.env.DB.prepare(
      'SELECT config_key, config_value, description FROM system_config WHERE 1=1 ORDER BY config_key'
    ).all();
    return c.json({ success: true, data: configs.results || [] });
  } catch (e) {
    return c.json({ success: false, error: '获取配置失败' }, 500);
  }
});

adminRouter.put('/config', async (c) => {
  try {
    const { configs } = await c.req.json();
    if (!Array.isArray(configs)) {
      return c.json({ success: false, error: '参数格式错误' }, 400);
    }

    for (const { key, value } of configs) {
      const existing = await c.env.DB.prepare('SELECT id FROM system_config WHERE config_key = ?').bind(key).first();
      if (existing) {
        await c.env.DB.prepare('UPDATE system_config SET config_value = ?, updated_at = datetime(\'now\') WHERE config_key = ?').bind(value, key).run();
      } else {
        await c.env.DB.prepare('INSERT INTO system_config (id, config_key, config_value, created_at, updated_at) VALUES (?, ?, ?, datetime(\'now\'), datetime(\'now\'))').bind(crypto.randomUUID(), key, value).run();
      }
    }

    return c.json({ success: true, message: '配置已更新' });
  } catch (e) {
    return c.json({ success: false, error: '更新配置失败' }, 500);
  }
});

// ========== 系统日志 ==========
adminRouter.get('/logs', async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1');
    const pageSize = Math.min(parseInt(c.req.query('pageSize') || '50'), 200);
    const offset = (page - 1) * pageSize;
    const level = c.req.query('level') || '';

    let whereClause = 'WHERE 1=1';
    const params = [];
    if (level) { whereClause += ' AND level = ?'; params.push(level); }

    const total = await c.env.DB.prepare('SELECT COUNT(*) as cnt FROM system_log ' + whereClause).bind(...params).first();
    const items = await c.env.DB.prepare(
      'SELECT * FROM system_log ' + whereClause + ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
    ).bind(...params, pageSize, offset).all();

    return c.json({
      success: true,
      data: {
        items: items.results || [],
        total: total?.cnt || 0,
        page, pageSize,
      }
    });
  } catch (e) {
    return c.json({ success: false, error: '获取日志失败' }, 500);
  }
});

// ========== 管理看板统计数据（供前端 adminDashboardPage 调用） ==========
adminRouter.get('/stats', async (c) => {
  try {
    const totalCompanies = await c.env.DB.prepare('SELECT COUNT(*) as cnt FROM sys_company').first();
    const totalAgents = await c.env.DB.prepare("SELECT COUNT(*) as cnt FROM sys_agent WHERE status = 'active'").first();
    const totalOrders = await c.env.DB.prepare("SELECT COUNT(*) as cnt FROM finance_order WHERE payment_status = 'paid'").first();
    const newThisMonth = await c.env.DB.prepare(
      "SELECT COUNT(*) as cnt FROM sys_company WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')"
    ).first();
    const monthRev = await c.env.DB.prepare(
      "SELECT COALESCE(SUM(amount), 0) as amount FROM finance_order WHERE payment_status = 'paid' AND strftime('%Y-%m', paid_at) = strftime('%Y-%m', 'now')"
    ).first();
    const pendingRes = await c.env.DB.prepare("SELECT COUNT(*) as cnt FROM reservation_form WHERE status = 'pending'").first();
    const totalGen = await c.env.DB.prepare("SELECT COUNT(*) as cnt FROM ai_generate_content").first();
    const totalPub = await c.env.DB.prepare("SELECT COUNT(*) as cnt FROM publish_record WHERE status = 'published'").first();
    const refundReq = await c.env.DB.prepare("SELECT COUNT(*) as cnt FROM finance_order WHERE payment_status = 'refund_requested'").first();

    return c.json({
      success: true,
      data: {
        totalCompanies: totalCompanies?.cnt || 0,
        totalAgents: totalAgents?.cnt || 0,
        totalOrders: totalOrders?.cnt || 0,
        newCompaniesThisMonth: newThisMonth?.cnt || 0,
        monthRevenue: monthRev?.amount || 0,
        pendingReservations: pendingRes?.cnt || 0,
        totalGenerations: totalGen?.cnt || 0,
        totalPublished: totalPub?.cnt || 0,
        refundRequests: refundReq?.cnt || 0,
        totalRevenue: monthRev?.amount || 0,
        pendingRefund: refundReq?.cnt || 0,
      }
    });
  } catch (e) {
    console.error('[Admin] Stats error:', e);
    return c.json({ success: false, error: '获取统计数据失败' }, 500);
  }
});

// ========== 管理员订单列表（供前端 adminFinancePage 调用） ==========
adminRouter.get('/orders', async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1');
    const pageSize = Math.min(parseInt(c.req.query('pageSize') || '20'), 100);
    const offset = (page - 1) * pageSize;
    const type = c.req.query('type') || '';
    const status = c.req.query('status') || '';

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    if (type) { whereClause += ' AND order_type = ?'; params.push(type); }
    if (status) { whereClause += ' AND payment_status = ?'; params.push(status); }

    const total = await c.env.DB.prepare('SELECT COUNT(*) as cnt FROM finance_order ' + whereClause).bind(...params).first();
    const items = await c.env.DB.prepare(
      `SELECT fo.order_no, fo.order_type, fo.amount, fo.payment_status, fo.payment_method, fo.description, fo.created_at,
              sc.company_name as tenant_name, sa.username as agent_name
       FROM finance_order fo
       LEFT JOIN sys_company sc ON fo.tenant_id = sc.tenant_id
       LEFT JOIN sys_agent sa ON fo.agent_id = sa.id ` + whereClause + ' ORDER BY fo.created_at DESC LIMIT ? OFFSET ?'
    ).bind(...params, pageSize, offset).all();

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
    return c.json({ success: false, error: '获取订单列表失败' }, 500);
  }
});

// ========== CSV 数据导出 ==========

// GET /api/admin/export/companies - 企业列表导出 CSV
adminRouter.get('/export/companies', async (c) => {
  try {
    const items = await c.env.DB.prepare(
      `SELECT sc.company_name, sc.brand_name, sc.contact_email, sc.contact_phone,
              sc.website, sc.registration_type, sc.registration_fee, sc.status,
              sc.membership_expires_at, sc.ai_package_type, sc.created_at,
              sa.username as agent_name
       FROM sys_company sc
       LEFT JOIN sys_agent sa ON sc.agent_id = sa.id
       ORDER BY sc.created_at DESC`
    ).all();

    const rows = (items.results || []) as any[];
    const header = '企业名称,品牌名称,邮箱,电话,官网,注册方式,注册费(分),状态,会员到期,AI套餐,创建时间,代理商\n';
    const csv = header + rows.map(r =>
      `"${(r.company_name || '').replace(/"/g, '""')}","${(r.brand_name || '').replace(/"/g, '""')}","${r.contact_email || ''}","${r.contact_phone || ''}","${r.website || ''}","${r.registration_type || ''}",${r.registration_fee || 0},"${r.status || ''}","${r.membership_expires_at || ''}","${r.ai_package_type || ''}","${r.created_at || ''}","${(r.agent_name || '').replace(/"/g, '""')}"`
    ).join('\n');

    return c.newResponse(csv, 200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="companies.csv"',
    });
  } catch (e) {
    console.error('[Admin] Export companies error:', e);
    return c.json({ success: false, error: '导出失败' }, 500);
  }
});

// GET /api/admin/export/publish-records - 发布记录导出 CSV
adminRouter.get('/export/publish-records', async (c) => {
  try {
    const items = await c.env.DB.prepare(
      `SELECT pr.id, pr.platform, pr.platform_url, pr.channel_type, pr.status,
              pr.published_at, pr.created_at,
              agc.keyword, agc.title,
              sc.company_name
       FROM publish_record pr
       LEFT JOIN ai_generate_content agc ON pr.content_id = agc.id
       LEFT JOIN sys_company sc ON pr.tenant_id = sc.tenant_id
       ORDER BY pr.created_at DESC`
    ).all();

    const rows = (items.results || []) as any[];
    const header = 'ID,企业名称,关键词,标题,平台,外链URL,渠道类型,状态,发布时间,创建时间\n';
    const csv = header + rows.map(r =>
      `"${r.id || ''}","${(r.company_name || '').replace(/"/g, '""')}","${(r.keyword || '').replace(/"/g, '""')}","${(r.title || '').replace(/"/g, '""')}","${r.platform || ''}","${(r.platform_url || '').replace(/"/g, '""')}","${r.channel_type || ''}","${r.status || ''}","${r.published_at || ''}","${r.created_at || ''}"`
    ).join('\n');

    return c.newResponse(csv, 200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="publish_records.csv"',
    });
  } catch (e) {
    console.error('[Admin] Export publish error:', e);
    return c.json({ success: false, error: '导出失败' }, 500);
  }
});

// ========== 全量数据导出（JSON） ==========
adminRouter.get('/export/:type', async (c) => {
  try {
    const type = c.req.param('type');
    const allowedTypes = ['companies', 'agents', 'orders', 'keywords', 'contents'];

    if (!allowedTypes.includes(type)) {
      return c.json({ success: false, error: '无效的导出类型' }, 400);
    }

    let sql = '';
    if (type === 'companies') sql = 'SELECT * FROM sys_company ORDER BY created_at DESC';
    else if (type === 'agents') sql = 'SELECT * FROM sys_agent ORDER BY created_at DESC';
    else if (type === 'orders') sql = 'SELECT * FROM finance_order ORDER BY created_at DESC';
    else if (type === 'keywords') sql = 'SELECT * FROM company_keyword ORDER BY created_at DESC';
    else if (type === 'contents') sql = 'SELECT * FROM ai_generate_content ORDER BY created_at DESC';

    const data = await c.env.DB.prepare(sql).all();
    return c.json({ success: true, data: data.results || [] });
  } catch (e) {
    return c.json({ success: false, error: '导出失败' }, 500);
  }
});

// ========== 7天退款管理 ==========

// GET /api/admin/refunds - 获取退款申请列表
adminRouter.get('/refunds', async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1');
    const pageSize = Math.min(parseInt(c.req.query('pageSize') || '20'), 100);
    const offset = (page - 1) * pageSize;

    const total = await c.env.DB.prepare(
      `SELECT COUNT(*) as cnt FROM sys_company WHERE status = 'refund_pending'`
    ).first();

    const items = await c.env.DB.prepare(
      `SELECT sc.id, sc.company_name, sc.brand_name, sc.contact_email, sc.registration_fee,
              sc.created_at, sc.refund_requested_at, sa.username as agent_name, sa.id as agent_id
       FROM sys_company sc
       LEFT JOIN sys_agent sa ON sc.agent_id = sa.id
       WHERE sc.status = 'refund_pending'
       ORDER BY sc.refund_requested_at DESC LIMIT ? OFFSET ?`
    ).bind(pageSize, offset).all();

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
    console.error('[Admin] Refund list error:', e);
    return c.json({ success: false, error: '获取退款列表失败' }, 500);
  }
});

// POST /api/admin/refunds/:id/approve - 审核通过退款
adminRouter.post('/refunds/:id/approve', async (c) => {
  try {
    const companyId = c.req.param('id');

    const company = await c.env.DB.prepare(
      `SELECT id, agent_id, registration_fee, company_name
       FROM sys_company WHERE id = ? AND status = 'refund_pending'`
    ).first<{ id: string; agent_id: string | null; registration_fee: number; company_name: string }>();

    if (!company) {
      return c.json({ success: false, error: '退款申请不存在或已处理' }, 404);
    }

    if (!company.agent_id) {
      // 自助注册企业没有代理商，直接标记为 disabled
      await c.env.DB.prepare(
        `UPDATE sys_company SET status = 'disabled', updated_at = datetime('now') WHERE id = ?`
      ).bind(companyId).run();
    } else {
      // 有代理商：退费到代理商余额
      const agent = await c.env.DB.prepare(
        `SELECT balance FROM sys_agent WHERE id = ?`
      ).bind(company.agent_id).first<{ balance: number }>();

      if (!agent) {
        return c.json({ success: false, error: '代理商不存在' }, 404);
      }

      const beforeBalance = agent.balance;
      const afterBalance = beforeBalance + company.registration_fee;

      // 更新企业状态
      await c.env.DB.prepare(
        `UPDATE sys_company SET status = 'disabled', updated_at = datetime('now') WHERE id = ?`
      ).bind(companyId).run();

      // 增加代理商余额
      await c.env.DB.prepare(
        `UPDATE sys_agent SET balance = ?, updated_at = datetime('now') WHERE id = ?`
      ).bind(afterBalance, company.agent_id).run();

      // 余额变动日志
      await c.env.DB.prepare(
        `INSERT INTO agent_balance_log (id, agent_id, order_id, change_amount, balance_before, balance_after, operation_type, description, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'refund', ?, datetime('now'))`
      ).bind(crypto.randomUUID(), company.agent_id, companyId,
        company.registration_fee, beforeBalance, afterBalance,
        '退款: ' + company.company_name + ' 注销退款 ¥' + (company.registration_fee / 100).toFixed(2)).run();
    }

    // 记录日志
    await c.env.DB.prepare(
      `INSERT INTO system_log (id, user_id, user_type, action, target_type, target_id, detail, created_at)
       VALUES (?, ?, 'admin', 'refund_approve', 'sys_company', ?, ?, datetime('now'))`
    ).bind(crypto.randomUUID(), c.get('user').userId, companyId,
      '审核通过退款: ' + company.company_name + ', 退费 ' + (company.registration_fee / 100).toFixed(2) + ' 元').run();

    return c.json({ success: true, message: '退款已审核通过，企业已禁用' });
  } catch (e) {
    console.error('[Admin] Refund approve error:', e);
    return c.json({ success: false, error: '审核失败' }, 500);
  }
});

// POST /api/admin/refunds/:id/reject - 审核拒绝退款
adminRouter.post('/refunds/:id/reject', async (c) => {
  try {
    const companyId = c.req.param('id');

    const company = await c.env.DB.prepare(
      `SELECT id, company_name FROM sys_company WHERE id = ? AND status = 'refund_pending'`
    ).first<{ id: string; company_name: string }>();

    if (!company) {
      return c.json({ success: false, error: '退款申请不存在或已处理' }, 404);
    }

    // 恢复企业状态为 active
    await c.env.DB.prepare(
      `UPDATE sys_company SET status = 'active', refund_requested_at = NULL, updated_at = datetime('now') WHERE id = ?`
    ).bind(companyId).run();

    // 记录日志
    await c.env.DB.prepare(
      `INSERT INTO system_log (id, user_id, user_type, action, target_type, target_id, detail, created_at)
       VALUES (?, ?, 'admin', 'refund_reject', 'sys_company', ?, ?, datetime('now'))`
    ).bind(crypto.randomUUID(), c.get('user').userId, companyId,
      '审核拒绝退款: ' + company.company_name).run();

    return c.json({ success: true, message: '退款申请已拒绝，企业状态已恢复' });
  } catch (e) {
    console.error('[Admin] Refund reject error:', e);
    return c.json({ success: false, error: '拒绝失败' }, 500);
  }
});

// ========== 系统配置管理 ==========
// GET /api/admin/config - 获取系统配置
adminRouter.get('/config', async (c) => {
  try {
    const items = await c.env.DB.prepare(
      'SELECT config_key, config_value, description FROM system_config ORDER BY config_key'
    ).all();
    return c.json({ success: true, data: items.results || [] });
  } catch (e) {
    return c.json({ success: false, error: '获取配置失败' }, 500);
  }
});

// PUT /api/admin/config - 更新系统配置
adminRouter.put('/config', async (c) => {
  try {
    const body = await c.req.json<{ configs: Array<{ key: string; value: string }> }>();
    if (!body.configs || !Array.isArray(body.configs)) {
      return c.json({ success: false, error: '参数无效' } as ApiResponse, 400);
    }

    for (const cfg of body.configs) {
      await c.env.DB.prepare(
        `UPDATE system_config SET config_value = ?, updated_at = datetime('now') WHERE config_key = ?`
      ).bind(cfg.value, cfg.key).run();

      // 记录日志
      await c.env.DB.prepare(
        `INSERT INTO system_log (id, user_id, user_type, action, target_type, target_id, detail, created_at)
         VALUES (?, ?, 'admin', 'config_change', 'system_config', ?, ?, datetime('now'))`
      ).bind(crypto.randomUUID(), c.get('user').userId, cfg.key, `更新 ${cfg.key} = ${cfg.value}`).run();
    }

    return c.json({ success: true, message: '配置已更新' });
  } catch (e) {
    return c.json({ success: false, error: '更新配置失败' } as ApiResponse, 500);
  }
});

// ========== 系统操作日志 ==========
// GET /api/admin/logs
adminRouter.get('/logs', async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1');
    const pageSize = Math.min(parseInt(c.req.query('pageSize') || '50'), 100);
    const offset = (page - 1) * pageSize;
    const action = c.req.query('action') || '';

    let whereClause = '';
    const params: any[] = [];
    if (action) {
      whereClause = ' WHERE action = ?';
      params.push(action);
    }

    const total = await c.env.DB.prepare('SELECT COUNT(*) as cnt FROM system_log' + whereClause).bind(...params).first();
    const items = await c.env.DB.prepare(
      `SELECT user_id, user_type, action, target_type, target_id, detail, created_at
       FROM system_log` + whereClause +
      ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
    ).bind(...params, pageSize, offset).all();

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
    return c.json({ success: false, error: '获取日志失败' }, 500);
  }
});

// ========== 增值预约工单管理 ==========
// GET /api/admin/reservations - 获取所有预约工单
adminRouter.get('/reservations', async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1');
    const pageSize = Math.min(parseInt(c.req.query('pageSize') || '20'), 100);
    const offset = (page - 1) * pageSize;
    const status = c.req.query('status') || '';

    let whereClause = '';
    const params: any[] = [];
    if (status) {
      whereClause = ' WHERE rf.status = ?';
      params.push(status);
    }

    const total = await c.env.DB.prepare(
      'SELECT COUNT(*) as cnt FROM reservation_form rf' + whereClause
    ).bind(...params).first();

    const items = await c.env.DB.prepare(
      `SELECT rf.id, rf.service_type, rf.applicant_name, rf.contact, rf.requirement,
              rf.people_count, rf.status, rf.admin_notes, rf.created_at, rf.updated_at,
              sc.company_name
       FROM reservation_form rf
       LEFT JOIN sys_company sc ON rf.tenant_id = sc.tenant_id` + whereClause +
      ' ORDER BY rf.created_at DESC LIMIT ? OFFSET ?'
    ).bind(...params, pageSize, offset).all();

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
    return c.json({ success: false, error: '获取预约工单失败' }, 500);
  }
});

// PUT /api/admin/reservations/:id - 更新工单状态/备注
adminRouter.put('/reservations/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const { status, adminNotes } = await c.req.json<{ status?: string; adminNotes?: string }>();

    if (!status && adminNotes === undefined) {
      return c.json({ success: false, error: '请提供要更新的字段' }, 400);
    }

    let sql = "UPDATE reservation_form SET updated_at = datetime('now')";
    const params: any[] = [];
    if (status) { sql += ', status = ?'; params.push(status); }
    if (adminNotes !== undefined) { sql += ', admin_notes = ?'; params.push(adminNotes); }
    sql += ' WHERE id = ?';
    params.push(id);

    await c.env.DB.prepare(sql).bind(...params).run();
    return c.json({ success: true, message: '工单已更新' });
  } catch (e) {
    return c.json({ success: false, error: '更新工单失败' }, 500);
  }
});

// ========== AI 加油包管理 ==========
// POST /api/admin/company/:tenantId/ai-package - 为企业开通 AI 加油包
adminRouter.post('/company/:tenantId/ai-package', async (c) => {
  try {
    const user = c.get('user');
    const tenantId = c.req.param('tenantId');
    const { packageType } = await c.req.json<{ packageType: 'daily' | 'monthly' | 'yearly' }>();

    const durations: Record<string, string> = {
      daily: '+1 days',
      monthly: '+30 days',
      yearly: '+365 days',
    };
    const duration = durations[packageType];
    if (!duration) {
      return c.json({ success: false, error: '无效套餐类型（daily/monthly/yearly）' }, 400);
    }

    // 查找企业
    const company = await c.env.DB.prepare(
      `SELECT id, company_name FROM sys_company WHERE tenant_id = ?`
    ).bind(tenantId).first<{ id: string; company_name: string }>();

    if (!company) {
      return c.json({ success: false, error: '企业不存在' }, 404);
    }

    // 延长 AI 加油包有效期
    await c.env.DB.prepare(
      `UPDATE sys_company SET
        ai_package_type = ?,
        ai_package_expires_at = COALESCE(
          CASE WHEN ai_package_expires_at > datetime('now')
            THEN datetime(ai_package_expires_at, ?)
            ELSE datetime('now', ?)
          END,
          datetime('now', ?)
        ),
        updated_at = datetime('now')
       WHERE tenant_id = ?`
    ).bind(packageType, duration, duration, duration, tenantId).run();

    // 记录日志
    const pkgNames: Record<string, string> = { daily: '日套餐', monthly: '月套餐', yearly: '年套餐' };
    await c.env.DB.prepare(
      `INSERT INTO system_log (id, user_id, user_type, action, target_type, target_id, detail, created_at)
       VALUES (?, ?, 'admin', 'ai_package_grant', 'company', ?, ?, datetime('now'))`
    ).bind(crypto.randomUUID(), user.userId, tenantId, `为企业 ${company.company_name} 开通AI加油包（${pkgNames[packageType] || packageType}）`).run();

    return c.json({ success: true, message: `AI 加油包（${pkgNames[packageType] || packageType}）已开通` });
  } catch (e: any) {
    return c.json({ success: false, error: '开通失败：' + (e.message || '未知错误') }, 500);
  }
});

// GET /api/admin/ai-package-config - 获取加油包定价
adminRouter.get('/ai-package-config', async (c) => {
  try {
    const items = await c.env.DB.prepare(
      `SELECT config_key, config_value, description FROM system_config WHERE config_key LIKE 'ai_package_%'`
    ).all();

    // 默认值
    const defaults: Record<string, string> = {
      ai_package_daily: '600',
      ai_package_monthly: '12000',
      ai_package_yearly: '120000',
    };

    const results = items.results || [];
    const configs = ['ai_package_daily', 'ai_package_monthly', 'ai_package_yearly'].map(key => {
      const existing = results.find((r: any) => r.config_key === key);
      return {
        config_key: key,
        config_value: existing?.config_value || defaults[key] || '0',
        description: existing?.description || (key === 'ai_package_daily' ? 'AI加油包日套餐价格（分）' : key === 'ai_package_monthly' ? 'AI加油包月套餐价格（分）' : 'AI加油包年套餐价格（分）'),
      };
    });

    return c.json({ success: true, data: configs });
  } catch (e) {
    return c.json({ success: false, error: '获取配置失败' }, 500);
  }
});

// PUT /api/admin/ai-package-config - 更新加油包定价
adminRouter.put('/ai-package-config', async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json<{ configs: Array<{ key: string; value: string }> }>();
    if (!body.configs || !Array.isArray(body.configs)) {
      return c.json({ success: false, error: '参数无效' }, 400);
    }

    for (const cfg of body.configs) {
      // UPSERT: 如果存在则更新，否则插入
      const existing = await c.env.DB.prepare(
        `SELECT config_key FROM system_config WHERE config_key = ?`
      ).bind(cfg.key).first();

      if (existing) {
        await c.env.DB.prepare(
          `UPDATE system_config SET config_value = ?, updated_at = datetime('now') WHERE config_key = ?`
        ).bind(cfg.value, cfg.key).run();
      } else {
        await c.env.DB.prepare(
          `INSERT INTO system_config (config_key, config_value, description, created_at, updated_at)
           VALUES (?, ?, 'AI加油包价格配置', datetime('now'), datetime('now'))`
        ).bind(cfg.key, cfg.value).run();
      }

      await c.env.DB.prepare(
        `INSERT INTO system_log (id, user_id, user_type, action, target_type, target_id, detail, created_at)
         VALUES (?, ?, 'admin', 'ai_package_price_change', 'system_config', ?, ?, datetime('now'))`
      ).bind(crypto.randomUUID(), user.userId, cfg.key, `调整AI加油包定价 ${cfg.key} = ${cfg.value}`).run();
    }

    return c.json({ success: true, message: '加油包定价已更新' });
  } catch (e: any) {
    return c.json({ success: false, error: '更新失败：' + (e.message || '未知错误') }, 500);
  }
});

