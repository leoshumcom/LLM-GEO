import { Hono } from 'hono';
import type { Env, ApiResponse } from '../../types';
import { authMiddleware, requireRole, tenantIsolationMiddleware, generateToken } from '../../middleware/auth';

// 服务类型中文名称映射
const SERVICE_TYPE_NAMES: Record<string, string> = {
  '1': '关键词研究与拓展',
  '2': '竞争对手GEO分析',
  '3': 'AI内容策略定制',
  '4': '多媒体内容制作',
  '5': '站群架构规划',
  '6': '外链建设服务',
  '7': '数据报告与优化建议',
  '8': '专属客户经理',
};

export const companyRouter = new Hono<{ Bindings: Env }>();

companyRouter.use('*', authMiddleware);
companyRouter.use('*', requireRole('company', 'operator'));
companyRouter.use('*', tenantIsolationMiddleware);

// ========== 企业资料 ==========

// GET /api/company/profile - 获取企业资料
companyRouter.get('/profile', async (c) => {
  try {
    const user = c.get('user');
    const company = await c.env.DB.prepare(
      `SELECT company_name, brand_name, website, contact_email, contact_phone,
              contact_whatsapp, membership_expires_at, ai_package_type,
              ai_package_expires_at, registration_type, status,
              created_at
       FROM sys_company WHERE tenant_id = ?`
    ).bind(user.tenantId).first();

    if (!company) {
      return c.json({ success: false, error: '企业信息不存在' } as ApiResponse, 404);
    }

    return c.json({ success: true, data: company });
  } catch (e: any) {
    return c.json({ success: false, error: '获取企业信息失败' } as ApiResponse, 500);
  }
});

// PUT /api/company/profile - 更新企业资料
companyRouter.put('/profile', async (c) => {
  try {
    const user = c.get('user');
    const { brandName, website, phone, whatsapp } = await c.req.json<{
      brandName?: string; website?: string; phone?: string; whatsapp?: string;
    }>();

    await c.env.DB.prepare(
      `UPDATE sys_company SET
        brand_name = COALESCE(?, brand_name),
        website = COALESCE(?, website),
        contact_phone = COALESCE(?, contact_phone),
        contact_whatsapp = COALESCE(?, contact_whatsapp),
        updated_at = datetime('now')
       WHERE tenant_id = ?`
    ).bind(brandName || null, website || null, phone || null, whatsapp || null, user.tenantId).run();

    return c.json({ success: true, message: '企业资料已更新' });
  } catch (e: any) {
    return c.json({ success: false, error: '更新失败' } as ApiResponse, 500);
  }
});

// ========== 关键词管理 ==========

// GET /api/company/keywords - 获取关键词列表
// Query: ?status=pending&group=xxx&page=1&pageSize=20
companyRouter.get('/keywords', async (c) => {
  try {
    const user = c.get('user');
    const status = c.req.query('status') || '';
    const group = c.req.query('group') || '';
    const page = parseInt(c.req.query('page') || '1');
    const pageSize = Math.min(parseInt(c.req.query('pageSize') || '20'), 100);
    const offset = (page - 1) * pageSize;

    let whereClause = 'WHERE tenant_id = ?';
    const params: any[] = [user.tenantId];

    if (status) { whereClause += ' AND status = ?'; params.push(status); }
    if (group) { whereClause += ' AND group_name = ?'; params.push(group); }

    const total = await c.env.DB.prepare(
      `SELECT COUNT(*) as count FROM company_keyword ${whereClause}`
    ).bind(...params).first<{ count: number }>();

    const items = await c.env.DB.prepare(
      `SELECT id, keyword, group_name, status, created_at, updated_at
       FROM company_keyword ${whereClause}
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
  } catch (e: any) {
    return c.json({ success: false, error: '获取关键词失败' } as ApiResponse, 500);
  }
});

// POST /api/company/keywords - 添加单个关键词
companyRouter.post('/keywords', async (c) => {
  try {
    const user = c.get('user');
    const { keyword, groupName } = await c.req.json<{
      keyword: string; groupName?: string;
    }>();

    if (!keyword || keyword.trim().length === 0) {
      return c.json({ success: false, error: '关键词不能为空' } as ApiResponse, 400);
    }

    const id = crypto.randomUUID();
    await c.env.DB.prepare(
      `INSERT INTO company_keyword (id, tenant_id, keyword, group_name, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'pending', datetime('now'), datetime('now'))`
    ).bind(id, user.tenantId, keyword.trim(), groupName || '').run();

    return c.json({ success: true, data: { id, keyword: keyword.trim() }, message: '关键词已添加' });
  } catch (e: any) {
    return c.json({ success: false, error: '添加关键词失败' } as ApiResponse, 500);
  }
});

// POST /api/company/keywords/batch - 批量导入关键词
companyRouter.post('/keywords/batch', async (c) => {
  try {
    const user = c.get('user');
    const { keywords, groupName } = await c.req.json<{
      keywords: string[]; groupName?: string;
    }>();

    if (!keywords || keywords.length === 0) {
      return c.json({ success: false, error: '关键词列表不能为空' } as ApiResponse, 400);
    }

    let added = 0;
    let skipped = 0;

    // 逐条插入（更可靠的写法）
    for (const kw of keywords) {
      if (!kw || kw.trim().length === 0) continue;
      const id = crypto.randomUUID();
      try {
        const result = await c.env.DB.prepare(
          `INSERT OR IGNORE INTO company_keyword (id, tenant_id, keyword, group_name, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'pending', datetime('now'), datetime('now'))`
        ).bind(id, user.tenantId, kw.trim(), groupName || '').run();
        added += (result.meta.changes || 0);
      } catch (e: any) {
        console.error('Insert KW failed:', e.message);
        skipped++;
      }
    }

    return c.json({
      success: true,
      data: { added, total: keywords.length },
      message: `成功导入 ${added} 个关键词${skipped > 0 ? `，${skipped} 个已存在` : ''}`
    });
  } catch (e: any) {
    return c.json({ success: false, error: '批量导入失败' } as ApiResponse, 500);
  }
});

// DELETE /api/company/keywords/:id - 删除关键词
companyRouter.delete('/keywords/:id', async (c) => {
  try {
    const user = c.get('user');
    const id = c.req.param('id');

    const result = await c.env.DB.prepare(
      `DELETE FROM company_keyword WHERE id = ? AND tenant_id = ?`
    ).bind(id, user.tenantId).run();

    if (result.meta.changes === 0) {
      return c.json({ success: false, error: '关键词不存在' } as ApiResponse, 404);
    }

    return c.json({ success: true, message: '关键词已删除' });
  } catch (e: any) {
    return c.json({ success: false, error: '删除失败' } as ApiResponse, 500);
  }
});

// ========== AI 内容生成 ==========

// POST /api/company/ai/generate - 提交 AI 生成任务
// Body: { keywordIds: string[], provider?: string }
// 模型选择逻辑：优先企业自有 Key → 次选平台加油包 → 拒绝生成
companyRouter.post('/ai/generate', async (c) => {
  try {
    const user = c.get('user');
    const { keywordIds, provider } = await c.req.json<{
      keywordIds: string[];
      provider?: string;
    }>();

    if (!keywordIds || keywordIds.length === 0) {
      return c.json({ success: false, error: '请选择关键词' } as ApiResponse, 400);
    }

    // 检查企业信息
    const company = await c.env.DB.prepare(
      `SELECT company_name, brand_name, website, contact_email, contact_phone
       FROM sys_company WHERE tenant_id = ?`
    ).bind(user.tenantId).first<{
      company_name: string; brand_name: string; website: string;
      contact_email: string; contact_phone: string;
    }>();

    if (!company) {
      return c.json({ success: false, error: '企业信息不存在' } as ApiResponse, 404);
    }

    // ===== 多模型路由检查：企业自有 Key → 平台加油包 → 拒绝 =====
    const { checkAiAccess } = await import('../../utils/model-router');
    const access = await checkAiAccess(c.env.DB, user.tenantId!);

    if (!access.canGenerate) {
      return c.json({
        success: false,
        error: access.message,
        _hint: '请前往「模型配置」配置自有 API Key，或购买平台加油包（¥66/天 或 ¥666/月）'
      } as ApiResponse, 403);
    }

    // 获取关键词信息并创建任务
    const tasks: { keywordId: string; keyword: string }[] = [];

    for (const kid of keywordIds) {
      const kw = await c.env.DB.prepare(
        `SELECT id, keyword FROM company_keyword WHERE id = ? AND tenant_id = ?`
      ).bind(kid, user.tenantId).first<{ id: string; keyword: string }>();

      if (kw) {
        tasks.push({ keywordId: kw.id, keyword: kw.keyword });
      }
    }

    if (tasks.length === 0) {
      return c.json({ success: false, error: '未找到有效的关键词' } as ApiResponse, 400);
    }

    // 创建生成记录
    const contentIds: string[] = [];
    const actualProvider = provider || access.provider || 'agnes';

    for (const task of tasks) {
      const contentId = crypto.randomUUID();
      contentIds.push(contentId);

      await c.env.DB.prepare(
        `INSERT INTO ai_generate_content
         (id, tenant_id, keyword_id, keyword, brand_name, brand_website, contact_info, provider, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'))`
      ).bind(
        contentId, user.tenantId, task.keywordId, task.keyword,
        company.brand_name, company.website,
        `${company.contact_email} | ${company.contact_phone || ''}`,
        access.provider || actualProvider
      ).run();

      // 标记关键词为生成中
      await c.env.DB.prepare(
        `UPDATE company_keyword SET status = 'generating', updated_at = datetime('now') WHERE id = ?`
      ).bind(task.keywordId).run();

      // 发送到队列处理
      try {
        await c.env.AI_GENERATE_QUEUE.send({
          taskId: contentId,
          tenantId: user.tenantId!,
          keywordId: task.keywordId,
          keyword: task.keyword,
          brandName: company.brand_name,
          brandWebsite: company.website,
          contactInfo: `${company.contact_email} | ${company.contact_phone || ''}`,
          modelType: 'text',
          provider: access.provider || actualProvider,
        });
      } catch (qe) {
        console.error('Queue send failed:', qe);
      }
    }

    return c.json({
      success: true,
      data: { contentIds, count: contentIds.length, actualProvider: access.provider },
      message: `已提交 ${contentIds.length} 个生成任务（${access.message}）`,
    });
  } catch (e: any) {
    console.error('AI generate error:', e);
    return c.json({ success: false, error: '提交生成任务失败' } as ApiResponse, 500);
  }
});

// GET /api/company/ai/generate - 获取生成记录列表
companyRouter.get('/ai/generate', async (c) => {
  try {
    const user = c.get('user');
    const status = c.req.query('status') || '';
    const page = parseInt(c.req.query('page') || '1');
    const pageSize = Math.min(parseInt(c.req.query('pageSize') || '20'), 100);
    const offset = (page - 1) * pageSize;

    let whereClause = 'WHERE tenant_id = ?';
    const params: any[] = [user.tenantId];

    if (status) { whereClause += ' AND status = ?'; params.push(status); }

    const total = await c.env.DB.prepare(
      `SELECT COUNT(*) as count FROM ai_generate_content ${whereClause}`
    ).bind(...params).first<{ count: number }>();

    const items = await c.env.DB.prepare(
      `SELECT id, keyword, title, status, provider, error_message, created_at, completed_at
       FROM ai_generate_content ${whereClause}
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
  } catch (e: any) {
    return c.json({ success: false, error: '获取生成记录失败' } as ApiResponse, 500);
  }
});

// GET /api/company/ai/generate/:id - 获取单篇内容详情
companyRouter.get('/ai/generate/:id', async (c) => {
  try {
    const user = c.get('user');
    const id = c.req.param('id');

    const content = await c.env.DB.prepare(
      `SELECT * FROM ai_generate_content WHERE id = ? AND tenant_id = ?`
    ).bind(id, user.tenantId).first();

    if (!content) {
      return c.json({ success: false, error: '内容不存在' } as ApiResponse, 404);
    }

    return c.json({ success: true, data: content });
  } catch (e: any) {
    return c.json({ success: false, error: '获取内容失败' } as ApiResponse, 500);
  }
});

// ========== AI 模型配置 ==========

// GET /api/company/ai/config - 获取 AI 模型配置
companyRouter.get('/ai/config', async (c) => {
  try {
    const user = c.get('user');
    const configs = await c.env.DB.prepare(
      `SELECT provider, model_name, is_platform_package, status
       FROM ai_model_config WHERE tenant_id = ?`
    ).bind(user.tenantId).all();

    return c.json({ success: true, data: configs.results || [] });
  } catch (e: any) {
    return c.json({ success: false, error: '获取配置失败' } as ApiResponse, 500);
  }
});

// PUT /api/company/ai/config - 更新 AI 模型配置
companyRouter.put('/ai/config', async (c) => {
  try {
    const user = c.get('user');
    const { provider, apiKey, apiBaseUrl, modelName } = await c.req.json<{
      provider: string; apiKey?: string; apiBaseUrl?: string; modelName?: string;
    }>();

    if (!provider) {
      return c.json({ success: false, error: '请指定模型厂商' } as ApiResponse, 400);
    }

    // UPSERT: insert or update
    await c.env.DB.prepare(
      `INSERT INTO ai_model_config (id, tenant_id, provider, api_key, api_base_url, model_name, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'active', datetime('now'), datetime('now'))
       ON CONFLICT(tenant_id, provider) DO UPDATE SET
         api_key = COALESCE(?, api_key),
         api_base_url = COALESCE(?, api_base_url),
         model_name = COALESCE(?, model_name),
         updated_at = datetime('now')`
    ).bind(
      crypto.randomUUID(), user.tenantId, provider,
      apiKey || null, apiBaseUrl || null, modelName || null,
      apiKey || null, apiBaseUrl || null, modelName || null
    ).run();

    return c.json({ success: true, message: 'AI 模型配置已更新' });
  } catch (e: any) {
    return c.json({ success: false, error: '更新配置失败' } as ApiResponse, 500);
  }
});

// ========== AI 套餐 ==========

// POST /api/company/ai/package - 购买 AI 套餐
companyRouter.post('/ai/package', async (c) => {
  try {
    const user = c.get('user');
    const { packageType } = await c.req.json<{ packageType: 'daily' | 'monthly' }>();

    if (!['daily', 'monthly'].includes(packageType)) {
      return c.json({ success: false, error: '无效的套餐类型' } as ApiResponse, 400);
    }

    const prices: Record<string, number> = { daily: 6600, monthly: 66600 };
    const durations: Record<string, string> = { daily: '+1 days', monthly: '+30 days' };
    const amount = prices[packageType];
    const duration = durations[packageType];

    // 创建订单
    const orderId = crypto.randomUUID();
    const orderNo = 'AI' + Date.now().toString(36).toUpperCase();

    await c.env.DB.prepare(
      `INSERT INTO finance_order (id, order_no, order_type, amount, payment_status, tenant_id, description, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'paid', ?, ?, datetime('now'), datetime('now'))`
    ).bind(orderId, orderNo, `ai_${packageType}`, amount, user.tenantId,
      `AI ${packageType === 'daily' ? '日' : '月'}套餐`).run();

    // 更新企业套餐信息
    await c.env.DB.prepare(
      `UPDATE sys_company SET
        ai_package_type = ?,
        ai_package_expires_at = datetime('now', ?),
        updated_at = datetime('now')
       WHERE tenant_id = ?`
    ).bind(packageType, duration, user.tenantId).run();

    return c.json({
      success: true,
      data: { orderNo, amount, packageType },
      message: `AI ${packageType === 'daily' ? '日' : '月'}套餐购买成功`
    });
  } catch (e: any) {
    return c.json({ success: false, error: '购买套餐失败' } as ApiResponse, 500);
  }
});

// ========== 发布记录 ==========

// GET /api/company/publish - 获取发布记录
companyRouter.get('/publish', async (c) => {
  try {
    const user = c.get('user');
    const page = parseInt(c.req.query('page') || '1');
    const pageSize = Math.min(parseInt(c.req.query('pageSize') || '20'), 100);
    const offset = (page - 1) * pageSize;

    const total = await c.env.DB.prepare(
      `SELECT COUNT(*) as count FROM publish_record WHERE tenant_id = ?`
    ).bind(user.tenantId).first<{ count: number }>();

    const items = await c.env.DB.prepare(
      `SELECT pr.id, pr.platform, pr.platform_url, pr.channel_type, pr.status,
              pr.error_message, pr.published_at, pr.created_at,
              agc.keyword, agc.title
       FROM publish_record pr
       LEFT JOIN ai_generate_content agc ON pr.content_id = agc.id
       WHERE pr.tenant_id = ?
       ORDER BY pr.created_at DESC LIMIT ? OFFSET ?`
    ).bind(user.tenantId, pageSize, offset).all();

    return c.json({
      success: true,
      data: {
        items: items.results || [],
        total: total?.count || 0,
        page, pageSize,
        totalPages: Math.ceil((total?.count || 0) / pageSize)
      }
    });
  } catch (e: any) {
    return c.json({ success: false, error: '获取发布记录失败' } as ApiResponse, 500);
  }
});

// ========== 增值预约 ==========

// POST /api/company/reservations - 提交增值服务预约（需支付 ¥6）
companyRouter.post('/reservations', async (c) => {
  try {
    const user = c.get('user');
    const { serviceType, applicantName, contact, requirement, peopleCount, expectedTime } = await c.req.json<{
      serviceType: string; applicantName: string; contact: string;
      requirement?: string; peopleCount?: string; expectedTime?: string;
    }>();

    if (!serviceType || !applicantName || !contact) {
      return c.json({ success: false, error: '请填写完整信息' } as ApiResponse, 400);
    }

    const id = crypto.randomUUID();
    const reservationFee = 600; // ¥6 in 分

    // 创建预约记录（支付状态 pending）
    await c.env.DB.prepare(
      `INSERT INTO reservation_form
       (id, tenant_id, service_type, applicant_name, contact, requirement, people_count, expected_contact_time, payment_status, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'pending', datetime('now'), datetime('now'))`
    ).bind(id, user.tenantId, serviceType, applicantName, contact,
      requirement || '', peopleCount || '', expectedTime || '').run();

    // 创建虎皮椒支付订单
    const orderNo = 'RES' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 4).toUpperCase();
    const orderId = crypto.randomUUID();

    await c.env.DB.prepare(
      `INSERT INTO finance_order (id, order_no, order_type, amount, payment_status, tenant_id, description, created_at, updated_at)
       VALUES (?, ?, 'reservation', ?, 'pending', ?, ?, datetime('now'), datetime('now'))`
    ).bind(orderId, orderNo, reservationFee, user.tenantId,
      '增值预约 ¥6 - ' + (SERVICE_TYPE_NAMES[serviceType] || '服务' + serviceType)).run();

    // 关联订单ID到预约
    await c.env.DB.prepare(
      `UPDATE reservation_form SET order_id = ?, updated_at = datetime('now') WHERE id = ?`
    ).bind(orderId, id).run();

    // 调用虎皮椒支付
    const { createXunhupayOrder } = await import('../../utils/payment');
    const notifyUrl = c.env.APP_URL + '/api/company/reservations/payment/notify';
    const returnUrl = c.env.APP_URL + '/company/reservations';
    const now = Math.floor(Date.now() / 1000).toString();

    const payResult = await createXunhupayOrder({
      trade_order_id: orderNo,
      total_fee: '6.00',
      title: 'LLMGEO 增值预约服务',
      description: SERVICE_TYPE_NAMES[serviceType] || '增值服务预约',
      time: now,
      notify_url: notifyUrl,
      return_url: returnUrl,
    });

    if (!payResult.success) {
      await c.env.DB.prepare(
        `UPDATE finance_order SET payment_status = 'failed', updated_at = datetime('now') WHERE id = ?`
      ).bind(orderId).run();
      return c.json({ success: false, error: payResult.error || '支付创建失败', data: { id, orderNo } } as ApiResponse, 400);
    }

    return c.json({
      success: true,
      data: {
        id,
        orderNo,
        payUrl: payResult.url,
        qrcode: payResult.qrcode,
        amount: 6,
      },
      message: '预约已提交，请完成 ¥6 支付'
    });
  } catch (e: any) {
    console.error('[Company] Reservation error:', e);
    return c.json({ success: false, error: '提交预约失败' } as ApiResponse, 500);
  }
});

// 预约支付回调通知
companyRouter.post('/reservations/payment/notify', async (c) => {
  try {
    const formData = await c.req.formData();
    const params: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
      params[key] = value.toString();
    }

    console.log('[Reservation Payment] Notify:', JSON.stringify({ ...params, hash: params.hash?.substring(0, 8) + '...' }));

    const { verifyNotify } = await import('../../utils/payment');
    const result = await verifyNotify(params);
    if (!result.valid) return c.text('sign_error');

    const orderNo = result.trade_order_id;
    if (!orderNo) return c.text('param_error');

    const order = await c.env.DB.prepare(
      `SELECT id, payment_status FROM finance_order WHERE order_no = ? AND order_type = 'reservation'`
    ).first<{ id: string; payment_status: string }>();

    if (!order) return c.text('order_not_found');
    if (order.payment_status === 'paid') return c.text('success');

    // 更新订单状态
    await c.env.DB.prepare(
      `UPDATE finance_order SET payment_status = 'paid', paid_at = datetime('now'), transaction_id = ?, updated_at = datetime('now') WHERE id = ?`
    ).bind(result.orderId || '', order.id).run();

    // 更新预约工单支付状态
    await c.env.DB.prepare(
      `UPDATE reservation_form SET payment_status = 'paid', updated_at = datetime('now') WHERE order_id = ?`
    ).bind(order.id).run();

    return c.text('success');
  } catch (e: any) {
    console.error('[Reservation Payment] Error:', e.message);
    return c.text('error');
  }
});

// GET /api/company/reservations - 获取预约历史
companyRouter.get('/reservations', async (c) => {
  try {
    const user = c.get('user');
    const page = parseInt(c.req.query('page') || '1');
    const pageSize = Math.min(parseInt(c.req.query('pageSize') || '20'), 100);
    const offset = (page - 1) * pageSize;

    const total = await c.env.DB.prepare(
      `SELECT COUNT(*) as cnt FROM reservation_form WHERE tenant_id = ?`
    ).bind(user.tenantId).first();
    const items = await c.env.DB.prepare(
      `SELECT id, service_type, applicant_name, contact, requirement, people_count, payment_status, status, admin_notes, created_at, updated_at
       FROM reservation_form WHERE tenant_id = ?
       ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).bind(user.tenantId, pageSize, offset).all();

    return c.json({
      success: true,
      data: {
        items: items.results || [],
        total: total?.cnt || 0,
        page, pageSize,
      }
    });
  } catch (e: any) {
    return c.json({ success: false, error: '获取预约记录失败' } as ApiResponse, 500);
  }
});

// DELETE /api/company/reservations/:id - 取消预约
companyRouter.delete('/reservations/:id', async (c) => {
  try {
    const user = c.get('user');
    const id = c.req.param('id');
    await c.env.DB.prepare(
      `UPDATE reservation_form SET status = 'cancelled', updated_at = datetime('now') WHERE id = ? AND tenant_id = ?`
    ).bind(id, user.tenantId).run();
    return c.json({ success: true, message: '预约已取消' });
  } catch (e: any) {
    return c.json({ success: false, error: '取消失败' } as ApiResponse, 500);
  }
});

// ========== 子账号管理 ==========

// GET /api/company/operators - 获取运营子账号列表
companyRouter.get('/operators', async (c) => {
  try {
    const user = c.get('user');

    // 获取企业 ID
    const company = await c.env.DB.prepare(
      `SELECT id FROM sys_company WHERE tenant_id = ?`
    ).bind(user.tenantId).first<{ id: string }>();

    if (!company) {
      return c.json({ success: false, error: '企业不存在' } as ApiResponse, 404);
    }

    const operators = await c.env.DB.prepare(
      `SELECT id, username, display_name, created_at
       FROM sys_company_operator WHERE company_id = ?`
    ).bind(company.id).all();

    return c.json({ success: true, data: operators.results || [] });
  } catch (e: any) {
    return c.json({ success: false, error: '获取子账号失败' } as ApiResponse, 500);
  }
});

// POST /api/company/operators - 创建运营子账号（上限10人）
companyRouter.post('/operators', async (c) => {
  try {
    const user = c.get('user');
    const { username, password, displayName } = await c.req.json<{
      username: string; password: string; displayName?: string;
    }>();

    if (!username || !password) {
      return c.json({ success: false, error: '请填写用户名和密码' } as ApiResponse, 400);
    }

    // 获取企业 ID
    const company = await c.env.DB.prepare(
      `SELECT id FROM sys_company WHERE tenant_id = ?`
    ).bind(user.tenantId).first<{ id: string }>();

    if (!company) {
      return c.json({ success: false, error: '企业不存在' } as ApiResponse, 404);
    }

    // 检查当前子账号数量（上限10人）
    const operatorCount = await c.env.DB.prepare(
      `SELECT COUNT(*) as cnt FROM sys_company_operator WHERE company_id = ?`
    ).bind(company.id).first<{ cnt: number }>();

    if (operatorCount && operatorCount.cnt >= 10) {
      return c.json({ success: false, error: '子账号数量已达上限（10人），请先删除不再使用的账号' } as ApiResponse, 400);
    }

    // 密码哈希
    const encoder = new TextEncoder();
    const pwdData = encoder.encode(password + 'llmgeo_salt_2024');
    const hashBuf = await crypto.subtle.digest('SHA-256', pwdData);
    const hashArr = Array.from(new Uint8Array(hashBuf));
    const pwdHash = hashArr.map(b => b.toString(16).padStart(2, '0')).join('');

    const operatorId = crypto.randomUUID();
    await c.env.DB.prepare(
      `INSERT INTO sys_company_operator (id, company_id, username, password_hash, display_name, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
    ).bind(operatorId, company.id, username, pwdHash, displayName || username).run();

    // 分配 operator 角色
    await c.env.DB.prepare(
      `INSERT INTO sys_user_role (id, user_id, user_type, role_id, created_at)
       VALUES (?, ?, 'operator', 'role_operator', datetime('now'))`
    ).bind(crypto.randomUUID(), operatorId).run();

    return c.json({ success: true, data: { id: operatorId }, message: '子账号创建成功' });
  } catch (e: any) {
    if (e.message?.includes('UNIQUE constraint')) {
      return c.json({ success: false, error: '用户名已存在' } as ApiResponse, 409);
    }
    return c.json({ success: false, error: '创建子账号失败' } as ApiResponse, 500);
  }
});

// PUT /api/company/operators/:id - 更新子账号
companyRouter.put('/operators/:id', async (c) => {
  try {
    const user = c.get('user');
    const opId = c.req.param('id');
    const { displayName, password } = await c.req.json<{ displayName?: string; password?: string }>();

    if (!displayName && !password) {
      return c.json({ success: false, error: '请提供要更新的字段' } as ApiResponse, 400);
    }

    let sql = "UPDATE sys_company_operator SET updated_at = datetime('now')";
    const params: any[] = [];

    if (displayName) { sql += ', display_name = ?'; params.push(displayName); }
    if (password) {
      const encoder = new TextEncoder();
      const pwdData = encoder.encode(password + 'llmgeo_salt_2024');
      const hashBuf = await crypto.subtle.digest('SHA-256', pwdData);
      const hashArr = Array.from(new Uint8Array(hashBuf));
      sql += ', password_hash = ?';
      params.push(hashArr.map(b => b.toString(16).padStart(2, '0')).join(''));
    }

    // 确保只在当前企业下更新
    const company = await c.env.DB.prepare(
      `SELECT id FROM sys_company WHERE tenant_id = ?`
    ).bind(user.tenantId).first<{ id: string }>();
    if (!company) return c.json({ success: false, error: '企业不存在' } as ApiResponse, 404);

    sql += ' WHERE id = ? AND company_id = ?';
    params.push(opId, company.id);

    await c.env.DB.prepare(sql).bind(...params).run();
    return c.json({ success: true, message: '子账号已更新' });
  } catch (e: any) {
    return c.json({ success: false, error: '更新失败' } as ApiResponse, 500);
  }
});

// DELETE /api/company/operators/:id - 删除子账号
companyRouter.delete('/operators/:id', async (c) => {
  try {
    const user = c.get('user');
    const opId = c.req.param('id');

    const company = await c.env.DB.prepare(
      `SELECT id FROM sys_company WHERE tenant_id = ?`
    ).bind(user.tenantId).first<{ id: string }>();
    if (!company) return c.json({ success: false, error: '企业不存在' } as ApiResponse, 404);

    await c.env.DB.prepare(`DELETE FROM sys_company_operator WHERE id = ? AND company_id = ?`)
      .bind(opId, company.id).run();
    await c.env.DB.prepare(`DELETE FROM sys_user_role WHERE user_id = ?`).bind(opId).run();

    return c.json({ success: true, message: '子账号已删除' });
  } catch (e: any) {
    return c.json({ success: false, error: '删除失败' } as ApiResponse, 500);
  }
});

// ========== 社媒授权 ==========

// GET /api/company/social - 获取已绑定的社媒账号
companyRouter.get('/social', async (c) => {
  try {
    const user = c.get('user');
    const socials = await c.env.DB.prepare(
      `SELECT platform, platform_user_name, status, token_expires_at, created_at
       FROM company_social_oauth WHERE tenant_id = ?`
    ).bind(user.tenantId).all();

    return c.json({ success: true, data: socials.results || [] });
  } catch (e: any) {
    return c.json({ success: false, error: '获取社媒账号失败' } as ApiResponse, 500);
  }
});

// POST /api/company/social/channel - 创建手动发布渠道
// 替代 OAuth 方式：企业手动输入 API Key / 令牌
companyRouter.post('/social/channel', async (c) => {
  try {
    const user = c.get('user');
    const { platform, displayName, apiKey, apiSecret, apiBaseUrl } = await c.req.json();

    if (!platform || !displayName) {
      return c.json({ success: false, error: '请填写平台名称和显示名称' } as ApiResponse, 400);
    }

    const validPlatforms = ['wordpress', 'custom_api', 'manual_copy',
      'twitter', 'facebook', 'linkedin', 'instagram', 'tiktok', 'youtube',
      'xiaohongshu', 'weibo', 'wechat', 'bilibili', 'zhihu', 'douyin',
      'pinterest', 'telegram', 'medium', 'blogger'];
    if (!validPlatforms.includes(platform)) {
      return c.json({ success: false, error: '无效平台类型，仅支持: wordpress, custom_api, manual_copy' } as ApiResponse, 400);
    }

    // 检查是否已存在同平台渠道
    const existing = await c.env.DB.prepare(
      `SELECT id FROM company_social_oauth WHERE tenant_id = ? AND platform = ?`
    ).bind(user.tenantId, platform).first();

    if (existing) {
      return c.json({ success: false, error: `渠道 ${platform} 已存在，请先删除再创建` } as ApiResponse, 400);
    }

    const id = crypto.randomUUID();
    const tokenData = JSON.stringify({ apiKey: apiKey || '', apiSecret: apiSecret || '', apiBaseUrl: apiBaseUrl || '' });

    await c.env.DB.prepare(
      `INSERT INTO company_social_oauth (id, tenant_id, platform, platform_user_name, access_token, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'active', datetime('now'), datetime('now'))`
    ).bind(id, user.tenantId, platform, displayName, tokenData).run();

    return c.json({ success: true, message: '发布渠道创建成功' });
  } catch (e: any) {
    return c.json({ success: false, error: '创建失败: ' + e.message } as ApiResponse, 500);
  }
});

// DELETE /api/company/social/:platform - 解绑社媒账号
companyRouter.delete('/social/:platform', async (c) => {
  try {
    const user = c.get('user');
    const platform = c.req.param('platform');

    await c.env.DB.prepare(
      `DELETE FROM company_social_oauth WHERE tenant_id = ? AND platform = ?`
    ).bind(user.tenantId, platform).run();

    return c.json({ success: true, message: '社媒账号已解绑' });
  } catch (e: any) {
    return c.json({ success: false, error: '解绑失败' } as ApiResponse, 500);
  }
});

// ========== AI 模型配置 ==========

// GET /api/company/ai/config - 获取模型配置
companyRouter.get('/ai/config', async (c) => {
  try {
    const user = c.get('user');
    const configs = await c.env.DB.prepare(
      `SELECT provider, model_name, api_base_url, is_platform_package, status
       FROM ai_model_config WHERE tenant_id = ?`
    ).bind(user.tenantId).all();

    return c.json({ success: true, data: configs.results || [] });
  } catch (e: any) {
    return c.json({ success: false, error: '获取模型配置失败' } as ApiResponse, 500);
  }
});

// PUT /api/company/ai/config/:provider - 更新/创建模型配置
companyRouter.put('/ai/config/:provider', async (c) => {
  try {
    const user = c.get('user');
    const provider = c.req.param('provider');
    const { apiKey, modelName, apiBaseUrl } = await c.req.json();

    if (!apiKey) {
      return c.json({ success: false, error: '请填写 API Key' } as ApiResponse, 400);
    }

    const existing = await c.env.DB.prepare(
      `SELECT id FROM ai_model_config WHERE tenant_id = ? AND provider = ?`
    ).bind(user.tenantId, provider).first();

    if (existing) {
      await c.env.DB.prepare(
        `UPDATE ai_model_config SET api_key = ?, model_name = ?, api_base_url = ?, status = 'active', updated_at = datetime('now')
         WHERE tenant_id = ? AND provider = ?`
      ).bind(apiKey, modelName || null, apiBaseUrl || null, user.tenantId, provider).run();
    } else {
      await c.env.DB.prepare(
        `INSERT INTO ai_model_config (id, tenant_id, provider, api_key, model_name, api_base_url, is_platform_package, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, 'active', datetime('now'), datetime('now'))`
      ).bind(crypto.randomUUID(), user.tenantId, provider, apiKey, modelName || null, apiBaseUrl || null).run();
    }

    return c.json({ success: true, message: '模型配置已保存' });
  } catch (e: any) {
    return c.json({ success: false, error: '保存失败: ' + e.message } as ApiResponse, 500);
  }
});

// DELETE /api/company/ai/config/:provider - 删除模型配置
companyRouter.delete('/ai/config/:provider', async (c) => {
  try {
    const user = c.get('user');
    const provider = c.req.param('provider');

    await c.env.DB.prepare(
      `DELETE FROM ai_model_config WHERE tenant_id = ? AND provider = ?`
    ).bind(user.tenantId, provider).run();

    return c.json({ success: true, message: '模型配置已删除' });
  } catch (e: any) {
    return c.json({ success: false, error: '删除失败' } as ApiResponse, 500);
  }
});

// ========== 素材库 ==========

// GET /api/company/media - 获取 AI 素材库
companyRouter.get('/media', async (c) => {
  try {
    const user = c.get('user');
    const page = parseInt(c.req.query('page') || '1');
    const pageSize = Math.min(parseInt(c.req.query('pageSize') || '20'), 100);
    const offset = (page - 1) * pageSize;

    const total = await c.env.DB.prepare(
      `SELECT COUNT(*) as count FROM ai_media_file WHERE tenant_id = ?`
    ).bind(user.tenantId).first<{ count: number }>();

    const items = await c.env.DB.prepare(
      `SELECT id, file_type, r2_path, mime_type, width, height, generated_by, created_at
       FROM ai_media_file WHERE tenant_id = ?
       ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).bind(user.tenantId, pageSize, offset).all();

    // 为每个素材生成 R2 访问 URL（带签名）
    const itemsWithUrls = (items.results || []).map((item: any) => {
      let url = '';
      try {
        url = `${c.env.APP_URL}/api/media/${item.id}`;
      } catch (_) {}
      return { ...item, url };
    });

    return c.json({
      success: true,
      data: {
        items: itemsWithUrls,
        total: total?.count || 0,
        page, pageSize,
        totalPages: Math.ceil((total?.count || 0) / pageSize)
      }
    });
  } catch (e: any) {
    return c.json({ success: false, error: '获取素材库失败' } as ApiResponse, 500);
  }
});
