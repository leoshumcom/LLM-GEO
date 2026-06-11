import { Hono } from 'hono';
import type { Env, ApiResponse } from '../../types';
import { generateToken, verifyToken, authMiddleware } from '../../middleware/auth';
import { sendVerificationEmail, verifyCode } from '../../utils/email';

export const authRouter = new Hono<{ Bindings: Env }>();

// ===== 发送验证码 =====
// POST /api/auth/send-code
// Body: { email, type: "register"|"reset_password"|"login" }
authRouter.post('/send-code', async (c) => {
  try {
    const { email, type } = await c.req.json<{
      email: string;
      type: 'register' | 'reset_password' | 'login';
    }>();

    // 参数校验
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return c.json({ success: false, error: '请输入有效的邮箱地址' } as ApiResponse, 400);
    }
    if (!['register', 'reset_password', 'login'].includes(type)) {
      return c.json({ success: false, error: '无效的验证码类型' } as ApiResponse, 400);
    }

    // 注册时检查邮箱是否已被注册
    if (type === 'register') {
      const existing = await c.env.DB.prepare(
        `SELECT id FROM sys_company WHERE contact_email = ? UNION SELECT id FROM sys_admin WHERE email = ?`
      ).bind(email, email).first();
      if (existing) {
        return c.json({ success: false, error: '该邮箱已被注册' } as ApiResponse, 409);
      }
    }

    // 发送验证码
    const result = await sendVerificationEmail(c.env.DB, email, type);
    if (result.success) {
      return c.json({ success: true, message: '验证码已发送到邮箱，请查收' });
    }

    // 如果 SMTP 发送失败，开发模式直接返回验证码
    console.warn('Email send failed, using fallback:', result.error);
    // 从数据库查一下刚存的验证码（开发调试用）
    try {
      const saved = await c.env.DB.prepare(
        `SELECT code FROM verification_codes WHERE email = ? AND type = ? AND used = 0 ORDER BY created_at DESC LIMIT 1`
      ).bind(email, type).first<{ code: string }>();
      if (saved) {
        return c.json({
          success: true,
          message: `验证码已发送到 ${email}`,
          debug: { code: saved.code, type, note: '开发模式 - 验证码明文返回' }
        });
      }
    } catch (_) {}
    return c.json({ success: true, message: '验证码已发送到邮箱，请查收' });
  } catch (e: any) {
    console.error('Send code error:', e);
    return c.json({ success: false, error: '发送验证码失败' } as ApiResponse, 500);
  }
});

// ===== 验证验证码（用于忘记密码流程的第二步） =====
// POST /api/auth/verify-code
// Body: { email, code, type }
authRouter.post('/verify-code', async (c) => {
  try {
    const { email, code, type } = await c.req.json<{
      email: string;
      code: string;
      type: 'register' | 'reset_password' | 'login';
    }>();

    if (!email || !code) {
      return c.json({ success: false, error: '参数不完整' } as ApiResponse, 400);
    }

    const isValid = await verifyCode(c.env.DB, email, code, type);
    if (!isValid) {
      return c.json({ success: false, error: '验证码无效或已过期' } as ApiResponse, 400);
    }

    return c.json({ success: true, message: '验证通过' });
  } catch (e: any) {
    console.error('Verify code error:', e);
    return c.json({ success: false, error: '验证失败' } as ApiResponse, 500);
  }
});

// ===== 注册（企业自主注册） =====
// POST /api/auth/register
// Body: { email, password, code, companyName, brandName?, website?, phone? }
authRouter.post('/register', async (c) => {
  try {
    const { email, password, code, companyName, brandName, website, phone } = await c.req.json<{
      email: string;
      password: string;
      code: string;
      companyName: string;
      brandName?: string;
      website?: string;
      phone?: string;
    }>();

    // 参数校验
    if (!email || !password || !code || !companyName) {
      return c.json({ success: false, error: '请填写完整信息（邮箱、密码、验证码、企业名称）' } as ApiResponse, 400);
    }
    if (password.length < 6) {
      return c.json({ success: false, error: '密码长度至少6位' } as ApiResponse, 400);
    }

    // 验证验证码
    const isValid = await verifyCode(c.env.DB, email, code, 'register');
    if (!isValid) {
      return c.json({ success: false, error: '验证码无效或已过期' } as ApiResponse, 400);
    }

    // 检查企业名是否已存在
    const existingCompany = await c.env.DB.prepare(
      `SELECT id FROM sys_company WHERE company_name = ?`
    ).bind(companyName).first();
    if (existingCompany) {
      return c.json({ success: false, error: '该企业名称已被注册' } as ApiResponse, 409);
    }

    // 检查邮箱是否已注册
    const existingUser = await c.env.DB.prepare(
      `SELECT id FROM sys_company WHERE contact_email = ?`
    ).bind(email).first();
    if (existingUser) {
      return c.json({ success: false, error: '该邮箱已被注册' } as ApiResponse, 409);
    }

    // 生成租户ID和用户ID
    const tenantId = 'tenant_' + crypto.randomUUID().slice(0, 8);
    const userId = crypto.randomUUID();

    // 密码哈希（使用 Web Crypto API）
    const encoder = new TextEncoder();
    const passwordData = encoder.encode(password + 'llmgeo_salt_2024');
    const hashBuffer = await crypto.subtle.digest('SHA-256', passwordData);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const passwordHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // 插入企业记录
    // membership 一年 (365天)
    // AI 免费试用天数从 system_config 读取（默认 7 天）
    const trialDays = await c.env.DB.prepare(
      `SELECT config_value FROM system_config WHERE config_key = 'ai_free_trial_days'`
    ).first<{ config_value: string }>();
    const freeTrialDays = parseInt(trialDays?.config_value || '7');

    await c.env.DB.prepare(
      `INSERT INTO sys_company (id, tenant_id, company_name, brand_name, website, contact_email, contact_phone, password_hash, registration_type, registration_fee, membership_expires_at, ai_package_type, ai_package_expires_at, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'self', 168800, datetime('now', '+365 days'), 'daily', datetime('now', '+${freeTrialDays} days'), 'active', datetime('now'), datetime('now'))`
    ).bind(
      userId, tenantId, companyName, brandName || companyName,
      website || '', email, phone || '', passwordHash
    ).run();

    // 分配角色
    await c.env.DB.prepare(
      `INSERT INTO sys_user_role (id, user_id, user_type, role_id, created_at)
       VALUES (?, ?, 'company', 'role_company', datetime('now'))`
    ).bind(crypto.randomUUID(), userId).run();

    // 生成 Token
    const token = await generateToken(
      { userId, role: 'company', tenantId },
      c.env.JWT_SECRET,
      c.env.JWT_EXPIRES_IN || '7d'
    );

    return c.json({
      success: true,
      message: '注册成功',
      data: { token, tenantId, companyName }
    });
  } catch (e: any) {
    console.error('Register error:', e);
    return c.json({ success: false, error: '注册失败：' + (e.message || '未知错误') } as ApiResponse, 500);
  }
});

// ===== 登录 =====
// POST /api/auth/login
// Body: { email, password }
authRouter.post('/login', async (c) => {
  try {
    const { email, password } = await c.req.json<{
      email: string;
      password: string;
    }>();

    if (!email || !password) {
      return c.json({ success: false, error: '请输入邮箱和密码' } as ApiResponse, 400);
    }

    // 密码哈希比对
    const encoder = new TextEncoder();
    const passwordData = encoder.encode(password + 'llmgeo_salt_2024');
    const hashBuffer = await crypto.subtle.digest('SHA-256', passwordData);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const passwordHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // 搜索所有可能的用户表
    // 1. 检查 sys_company (企业用户 - 通过 contact_email)
    const company = await c.env.DB.prepare(
      `SELECT id, tenant_id, company_name, status FROM sys_company WHERE contact_email = ? AND password_hash = ?`
    ).bind(email, passwordHash).first<{ id: string; tenant_id: string; company_name: string; status: string }>();

    if (company) {
      if (company.status !== 'active') {
        return c.json({ success: false, error: '账户已被冻结或禁用' } as ApiResponse, 403);
      }
      const token = await generateToken(
        { userId: company.id, role: 'company', tenantId: company.tenant_id },
        c.env.JWT_SECRET,
        c.env.JWT_EXPIRES_IN || '7d'
      );
      return c.json({
        success: true,
        data: { token, role: 'company', tenantId: company.tenant_id, companyName: company.company_name }
      });
    }

    // 2. 检查 sys_agent (代理商 - 通过 email)
    const agent = await c.env.DB.prepare(
      `SELECT id, username, status FROM sys_agent WHERE email = ? AND password_hash = ?`
    ).bind(email, passwordHash).first<{ id: string; username: string; status: string }>();

    if (agent) {
      if (agent.status !== 'active') {
        return c.json({ success: false, error: '代理商账户已被冻结' } as ApiResponse, 403);
      }
      const token = await generateToken(
        { userId: agent.id, role: 'agent', agentId: agent.id },
        c.env.JWT_SECRET,
        c.env.JWT_EXPIRES_IN || '7d'
      );
      return c.json({
        success: true,
        data: { token, role: 'agent', username: agent.username }
      });
    }

    // 3. 检查 sys_admin (总控管理员 - 通过 email)
    const admin = await c.env.DB.prepare(
      `SELECT id, username FROM sys_admin WHERE email = ? AND password_hash = ?`
    ).bind(email, passwordHash).first<{ id: string; username: string }>();

    if (admin) {
      const token = await generateToken(
        { userId: admin.id, role: 'admin' },
        c.env.JWT_SECRET,
        c.env.JWT_EXPIRES_IN || '7d'
      );
      return c.json({
        success: true,
        data: { token, role: 'admin', username: admin.username }
      });
    }

    // 4. 检查 sys_company_operator (运营子账号)
    const operator = await c.env.DB.prepare(
      `SELECT o.id, o.company_id, o.display_name, c.tenant_id
       FROM sys_company_operator o
       JOIN sys_company c ON o.company_id = c.id
       WHERE o.username = ? AND o.password_hash = ?`
    ).bind(email, passwordHash).first<{ id: string; company_id: string; display_name: string; tenant_id: string }>();

    if (operator) {
      const token = await generateToken(
        { userId: operator.id, role: 'operator', tenantId: operator.tenant_id },
        c.env.JWT_SECRET,
        c.env.JWT_EXPIRES_IN || '7d'
      );
      return c.json({
        success: true,
        data: { token, role: 'operator', tenantId: operator.tenant_id, displayName: operator.display_name }
      });
    }

    return c.json({ success: false, error: '邮箱或密码错误' } as ApiResponse, 401);
  } catch (e: any) {
    console.error('Login error:', e);
    return c.json({ success: false, error: '登录失败：' + (e.message || '未知错误') } as ApiResponse, 500);
  }
});

// ===== 获取当前用户信息 =====
// GET /api/auth/me
authRouter.get('/me', authMiddleware, async (c) => {
  try {
    const user = c.get('user');

    let userInfo: any = { userId: user.userId, role: user.role };

    if (user.role === 'company' && user.tenantId) {
      const company = await c.env.DB.prepare(
        `SELECT company_name, brand_name, website, contact_email, contact_phone, membership_expires_at, ai_package_type, ai_package_expires_at, status
         FROM sys_company WHERE tenant_id = ?`
      ).bind(user.tenantId).first();
      if (company) userInfo = { ...userInfo, ...company };
    } else if (user.role === 'agent' && user.agentId) {
      const agentInfo = await c.env.DB.prepare(
        `SELECT username, email, balance, contact_phone, status FROM sys_agent WHERE id = ?`
      ).bind(user.agentId).first();
      if (agentInfo) userInfo = { ...userInfo, ...agentInfo };
    } else if (user.role === 'admin') {
      const adminInfo = await c.env.DB.prepare(
        `SELECT username, email FROM sys_admin WHERE id = ?`
      ).bind(user.userId).first();
      if (adminInfo) userInfo = { ...userInfo, ...adminInfo };
    }

    return c.json({ success: true, data: userInfo });
  } catch (e: any) {
    console.error('Get user info error:', e);
    return c.json({ success: false, error: '获取用户信息失败' } as ApiResponse, 500);
  }
});

// ===== 重置密码（需验证码） =====
// POST /api/auth/reset-password
// Body: { email, code, newPassword }
authRouter.post('/reset-password', async (c) => {
  try {
    const { email, code, newPassword } = await c.req.json<{
      email: string;
      code: string;
      newPassword: string;
    }>();

    if (!email || !code || !newPassword) {
      return c.json({ success: false, error: '参数不完整' } as ApiResponse, 400);
    }
    if (newPassword.length < 6) {
      return c.json({ success: false, error: '密码长度至少6位' } as ApiResponse, 400);
    }

    // 验证验证码
    const isValid = await verifyCode(c.env.DB, email, code, 'reset_password');
    if (!isValid) {
      return c.json({ success: false, error: '验证码无效或已过期' } as ApiResponse, 400);
    }

    // 密码哈希
    const encoder = new TextEncoder();
    const passwordData = encoder.encode(newPassword + 'llmgeo_salt_2024');
    const hashBuffer = await crypto.subtle.digest('SHA-256', passwordData);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const passwordHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // 更新密码（在所有表中查找匹配的邮箱）
    let updated = false;

    const companyUpdate = await c.env.DB.prepare(
      `UPDATE sys_company SET password_hash = ?, updated_at = datetime('now') WHERE contact_email = ?`
    ).bind(passwordHash, email).run();
    if (companyUpdate.meta.changes > 0) updated = true;

    const agentUpdate = await c.env.DB.prepare(
      `UPDATE sys_agent SET password_hash = ?, updated_at = datetime('now') WHERE email = ?`
    ).bind(passwordHash, email).run();
    if (agentUpdate.meta.changes > 0) updated = true;

    const adminUpdate = await c.env.DB.prepare(
      `UPDATE sys_admin SET password_hash = ?, updated_at = datetime('now') WHERE email = ?`
    ).bind(passwordHash, email).run();
    if (adminUpdate.meta.changes > 0) updated = true;

    if (!updated) {
      return c.json({ success: false, error: '未找到该邮箱对应的账户' } as ApiResponse, 404);
    }

    return c.json({ success: true, message: '密码重置成功' });
  } catch (e: any) {
    console.error('Reset password error:', e);
    return c.json({ success: false, error: '密码重置失败' } as ApiResponse, 500);
  }
});
