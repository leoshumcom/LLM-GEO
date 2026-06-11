/**
 * 邮件发送工具 - 通过 QQ邮箱 SMTP 发送验证码等邮件
 * 
 * 实现方案：
 * Cloudflare Workers 支持 connect() API，可以建立 TCP 连接。
 * 我们通过 SMTP 协议 + TLS 直接连接 smtp.qq.com:587 发送邮件。
 * 
 * 参考：https://developers.cloudflare.com/workers/runtime-apis/tcp-sockets/
 */

interface EmailConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
}

const EMAIL_CONFIG: EmailConfig = {
  host: 'smtp.qq.com',
  port: 587,
  user: 'no-replyz@qq.com',
  pass: 'ldkdmjhefwdwfhef',
};

// Base64 编码（兼容 Unicode）
function toBase64(str: string): string {
  return btoa(unescape(encodeURIComponent(str)));
}

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

  // 删除旧的未使用验证码
  await db.prepare(
    `DELETE FROM verification_codes WHERE email = ? AND type = ?`
  ).bind(email, type).run();

  // 插入新验证码
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

  // 标记已使用
  await db.prepare(
    `UPDATE verification_codes SET used = 1 WHERE email = ? AND type = ? AND code = ?`
  ).bind(email, type, code).run();

  return true;
}

/**
 * 发送邮件 - 直接通过 SMTP over TLS 连接 QQ邮箱服务器
 * 
 * Cloudflare Workers 的 connect() API 支持建立 TCP 连接，
 * 但需要启用 experimental 标志。
 * 
 * 作为备选方案，我们使用外部邮件 API 发送。
 * 这里我们用一个兼容层：尝试 connect()，如果不可用则报错。
 */
export async function sendEmail(
  to: string,
  subject: string,
  htmlBody: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // 方法1: 尝试使用 Workers connect() API
    // 但由于需要 experimental flags，我们改用方法2
    
    // 方法2: 使用 fetch 通过第三方邮件 API 发送
    // 这里我们走 SMTP API 路由
    return await sendViaMailApi(to, subject, htmlBody);
  } catch (e: any) {
    console.error('Email send failed:', e);
    return { success: false, error: e.message };
  }
}

/**
 * 使用 QQ邮箱 SMTP 通过 HTTP API 发送
 * 
 * 由于 CF Workers 的 TCP connect 是 experimental，
 * 我们将邮件发送请求路由到一个专门处理 SMTP 通信的 Worker。
 * 
 * 或者：在同一个 Worker 中使用更底层的 API。
 * 
 * == 最可靠的实现：==
 * 每次发送验证码时，通过 fetch POST 到一个专门做 SMTP 转发的服务。
 * 但目前我们还没有这个转发服务。
 * 
 * == 替代方案：==
 * 使用 emailjs 的纯 JS SMTP 客户端实现。
 * 但 emailjs 依赖 socket.io，不适合 Worker。
 * 
 * == 最终方案：==
 * 我们使用 Cloudflare 的 connect() API 手动实现 SMTP 协议。
 * 这个 API 在 Workers 中可用（GA 状态）。
 */
async function sendViaMailApi(
  to: string,
  subject: string,
  htmlBody: string
): Promise<{ success: boolean; error?: string }> {
  // 使用 Cloudflare Workers 的 connect() API 实现 SMTP
  // 参考: https://developers.cloudflare.com/workers/runtime-apis/tcp-sockets/
  
  try {
    // @ts-ignore - connect() API 在 Cloudflare Workers 中可用
    const socket = await connect({
      hostname: EMAIL_CONFIG.host,
      port: EMAIL_CONFIG.port,
      tls: true,
    });
    
    const reader = socket.readable.getReader();
    const writer = socket.writable.getWriter();
    
    // 辅助函数：读取一行响应
    const textDecoder = new TextDecoder();
    let responseBuffer = '';
    
    async function readLine(): Promise<string> {
      while (!responseBuffer.includes('\n')) {
        const { value, done } = await reader.read();
        if (done) break;
        responseBuffer += textDecoder.decode(value, { stream: true });
      }
      const idx = responseBuffer.indexOf('\n');
      const line = responseBuffer.substring(0, idx).trim();
      responseBuffer = responseBuffer.substring(idx + 1);
      return line;
    }
    
    async function sendCommand(cmd: string): Promise<string> {
      const encoder = new TextEncoder();
      await writer.write(encoder.encode(cmd + '\r\n'));
      return readLine();
    }
    
    // SMTP 握手流程
    let response = await readLine();
    console.log('SMTP:', response);
    
    // EHLO
    response = await sendCommand('EHLO llmgeo.com');
    console.log('EHLO:', response);
    
    // 如果 EHLO 不成功，试试 HELO
    if (!response.startsWith('250')) {
      response = await sendCommand('HELO llmgeo.com');
      console.log('HELO:', response);
    }
    
    // AUTH LOGIN
    response = await sendCommand('AUTH LOGIN');
    console.log('AUTH:', response);
    
    // Username (Base64)
    response = await sendCommand(toBase64(EMAIL_CONFIG.user));
    console.log('USER:', response);
    
    // Password (Base64)
    response = await sendCommand(toBase64(EMAIL_CONFIG.pass));
    console.log('PASS:', response);
    
    if (!response.startsWith('235')) {
      throw new Error('Authentication failed: ' + response);
    }
    
    // MAIL FROM
    response = await sendCommand(`MAIL FROM:<${EMAIL_CONFIG.user}>`);
    console.log('MAIL FROM:', response);
    
    // RCPT TO
    response = await sendCommand(`RCPT TO:<${to}>`);
    console.log('RCPT TO:', response);
    
    // DATA
    response = await sendCommand('DATA');
    console.log('DATA:', response);
    
    // 邮件内容
    const boundary = '----=_NextPart_' + Date.now();
    const message = [
      `From: "LLMGEO" <${EMAIL_CONFIG.user}>`,
      `To: ${to}`,
      `Subject: =?UTF-8?B?${toBase64(subject)}?=`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      ``,
      `--${boundary}`,
      `Content-Type: text/plain; charset="utf-8"`,
      `Content-Transfer-Encoding: base64`,
      ``,
      toBase64(htmlBody.replace(/<[^>]*>/g, '')),
      ``,
      `--${boundary}`,
      `Content-Type: text/html; charset="utf-8"`,
      `Content-Transfer-Encoding: base64`,
      ``,
      toBase64(htmlBody),
      ``,
      `--${boundary}--`,
      `.`,
    ].join('\r\n');
    
    await writer.write(new TextEncoder().encode(message));
    response = await readLine();
    console.log('END DATA:', response);
    
    // QUIT
    await sendCommand('QUIT');
    
    // 清理
    writer.close();
    reader.cancel();
    
    if (response.startsWith('250')) {
      return { success: true };
    } else {
      return { success: false, error: response };
    }
  } catch (e: any) {
    // 如果 connect() 不可用（沙箱环境不支持 TCP socket），
    // 返回特定错误，上层可以处理
    return { success: false, error: `SMTP send failed: ${e.message}` };
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
  
  // 保存验证码到数据库
  await saveVerificationCode(db, to, code, type);
  
  // 构建邮件内容
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
        <p style="color:#6b7280;">AI 智能内容生成平台</p>
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
