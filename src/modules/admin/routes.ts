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

// ========== 全量数据导出 ==========
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
