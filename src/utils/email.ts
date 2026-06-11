/**
 * 邮件发送工具 - 通过 Resend API 发送邮件
 * 
 * 替代之前的 SMTP 直连方案（Workers connect() 不可用）
 * Resend API 简单稳定，Workers 原生友好
 */

const RESEND_API_KEY = 're_2XbNvS6M_GauAuFE4N54LUQ7vczeycntG';
const FROM_EMAIL = 'LLMGEO <noreply@a95.top>';
const FROM_NAME = 'LLMGEO';

// 生成随机验证码
export function generateCode(length: number = 6): string {
  const chars = '0123456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// 存储验证码到 D1
export async function saveVerificationCode(
  db: D1Database,
  email: string,
  code: string,
  type: 'register' | 'reset_password' | 'login'
): Promise<void> {
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10分钟

  await db.prepare(
    `DELETE FROM verification_codes WHERE email = ? AND type = ?`
  ).bind(email, type).run();

  await db.prepare(
    `INSERT INTO verification_codes (id, email, code, type, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))`
  ).bind(
    crypto.randomUUID(),
    email,
    code,
    type,
    new Date(expiresAt).toISOString()
  ).run();
}

// 验证验证码
export async function verifyCode(
  db: D1Database,
  email: string,
  code: string,
  type: 'register' | 'reset_password' | 'login'
): Promise<boolean> {
  const result = await db.prepare(
    `SELECT code, expires_at FROM verification_codes
     WHERE email = ? AND type = ? AND used = 0
     ORDER BY created_at DESC LIMIT 1`
  ).bind(email, type).first<{ code: string; expires_at: string }>();

  if (!result) return false;
  if (new Date(result.expires_at).getTime() < Date.now()) return false;
  if (result.code !== code) return false;

  await db.prepare(
    `UPDATE verification_codes SET used = 1 WHERE email = ? AND type = ? AND code = ?`
  ).bind(email, type, code).run();

  return true;
}

/**
 * 通过 Resend API 发送邮件
 */
export async function sendEmail(
  to: string,
  subject: string,
  htmlBody: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [to],
        subject: subject,
        html: htmlBody,
      }),
    });

    const data = await resp.json() as any;

    if (resp.ok && data.id) {
      console.log('Email sent successfully:', data.id);
      return { success: true };
    }

    console.error('Resend API error:', resp.status, JSON.stringify(data));
    return { success: false, error: data.message || `HTTP ${resp.status}` };
  } catch (e: any) {
    console.error('Email send failed:', e);
    return { success: false, error: e.message };
  }
}

/**
 * 发送验证码邮件（封装好的便捷方法）
 */
export async function sendVerificationEmail(
  db: D1Database,
  to: string,
  type: 'register' | 'reset_password' | 'login'
): Promise<{ success: boolean; error?: string }> {
  const code = generateCode();

  await saveVerificationCode(db, to, code, type);

  const subjectMap = {
    register: '欢迎注册 LLMGEO - 邮箱验证码',
    reset_password: 'LLMGEO - 重置密码验证码',
    login: 'LLMGEO - 登录验证码',
  };

  const subject = subjectMap[type];
  const htmlBody = `
    <div style="max-width:600px;margin:0 auto;padding:20px;font-family:Arial,sans-serif;">
      <div style="text-align:center;margin-bottom:30px;">
        <h1 style="color:#2563eb;font-size:24px;margin:0;">🔮 LLMGEO</h1>
        <p style="color:#6b7280;">海外 GEO 排名优化 SaaS 平台</p>
      </div>
      <div style="background:#f9fafb;border-radius:12px;padding:30px;text-align:center;">
        <p style="color:#374151;font-size:16px;margin-bottom:20px;">您的验证码为：</p>
        <div style="background:#fff;border:2px dashed #2563eb;border-radius:8px;padding:15px 30px;display:inline-block;">
          <span style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#2563eb;font-family:monospace;">${code}</span>
        </div>
        <p style="color:#9ca3af;font-size:13px;margin-top:20px;">验证码有效期为 10 分钟，请勿泄露给他人。</p>
      </div>
      <p style="color:#9ca3af;font-size:12px;text-align:center;margin-top:20px;">
        此邮件由 LLMGEO 系统自动发送，请勿回复。
      </p>
    </div>
  `;

  return sendEmail(to, subject, htmlBody);
}

/**
 * 发送订单通知邮件
 */
export async function sendOrderEmail(
  to: string,
  orderId: string,
  planName: string,
  amount: string,
  status: string
): Promise<{ success: boolean; error?: string }> {
  const statusText = status === 'paid' ? '支付成功' : status === 'pending' ? '待支付' : '已取消';
  const htmlBody = `
    <div style="max-width:600px;margin:0 auto;padding:20px;font-family:Arial,sans-serif;">
      <div style="text-align:center;margin-bottom:30px;">
        <h1 style="color:#2563eb;font-size:24px;margin:0;">🔮 LLMGEO</h1>
        <p style="color:#6b7280;">订单通知</p>
      </div>
      <div style="background:#f9fafb;border-radius:12px;padding:30px;">
        <h2 style="margin-top:0;color:#1f2937;">${status === 'paid' ? '✅ 支付成功' : '📋 订单状态更新'}</h2>
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:8px 0;color:#6b7280;">订单编号：</td><td style="padding:8px 0;font-weight:600;">${orderId}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280;">套餐：</td><td style="padding:8px 0;font-weight:600;">${planName}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280;">金额：</td><td style="padding:8px 0;font-weight:600;">${amount}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280;">状态：</td><td style="padding:8px 0;font-weight:600;">${statusText}</td></tr>
        </table>
      </div>
      <p style="color:#9ca3af;font-size:12px;text-align:center;margin-top:20px;">
        此邮件由 LLMGEO 系统自动发送，请勿回复。
      </p>
    </div>
  `;

  const subject = `LLMGEO - ${status === 'paid' ? '支付成功' : '订单通知'} #${orderId}`;
  return sendEmail(to, subject, htmlBody);
}

/**
 * 发送会员到期提醒
 */
export async function sendExpiryReminder(
  to: string,
  companyName: string,
  expiryDate: string,
  daysLeft: number
): Promise<{ success: boolean; error?: string }> {
  const htmlBody = `
    <div style="max-width:600px;margin:0 auto;padding:20px;font-family:Arial,sans-serif;">
      <div style="text-align:center;margin-bottom:30px;">
        <h1 style="color:#2563eb;font-size:24px;margin:0;">🔮 LLMGEO</h1>
        <p style="color:#6b7280;">会员到期提醒</p>
      </div>
      <div style="background:#fef2f2;border-radius:12px;padding:30px;border:1px solid #fecaca;">
        <h2 style="margin-top:0;color:#dc2626;">⚠️ 会员即将到期</h2>
        <p style="color:#374151;">${companyName}，您的 LLMGEO 会员将在 ${daysLeft} 天后到期（${expiryDate}）。</p>
        <p style="color:#374151;">到期后将无法使用 AI 内容生成等功能，请及时续费。</p>
        <div style="text-align:center;margin-top:24px;">
          <a href="https://llmgeo.com/company/profile" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">立即续费</a>
        </div>
      </div>
      <p style="color:#9ca3af;font-size:12px;text-align:center;margin-top:20px;">
        此邮件由 LLMGEO 系统自动发送，请勿回复。
      </p>
    </div>
  `;

  return sendEmail(to, `LLMGEO - 会员到期提醒（${daysLeft}天后到期）`, htmlBody);
}
