/**
 * 公开页面 - 注册/登录/Favicon
 * 企业自主注册页面，暗色主题，与 landing page 风格一致
 */

const LANDING_STYLES = `
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif; background: #0a0a0f; color: #e0e0e8; line-height: 1.6; min-height: 100vh; }
.gradient-bg { position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: -1; background: radial-gradient(ellipse at 20% 50%, rgba(99, 102, 241, 0.08) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(139, 92, 246, 0.06) 0%, transparent 50%), radial-gradient(ellipse at 50% 80%, rgba(236, 72, 153, 0.04) 0%, transparent 50%); }
nav { padding: 20px 0; border-bottom: 1px solid rgba(255,255,255,0.06); backdrop-filter: blur(20px); position: sticky; top: 0; z-index: 100; background: rgba(10,10,15,0.8); }
nav .container { max-width: 1200px; margin: 0 auto; padding: 0 24px; display: flex; justify-content: space-between; align-items: center; }
.logo { font-size: 24px; font-weight: 800; background: linear-gradient(135deg, #6366f1, #8b5cf6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; letter-spacing: -0.5px; }
.logo span { color: #e0e0e8; -webkit-text-fill-color: #e0e0e8; }
.nav-links { display: flex; gap: 32px; align-items: center; }
.nav-links a { color: #a0a0b0; text-decoration: none; font-size: 14px; font-weight: 500; transition: color 0.2s; }
.nav-links a:hover { color: #fff; }
.btn { padding: 10px 24px; border-radius: 8px; font-weight: 600; font-size: 14px; border: none; cursor: pointer; transition: all 0.3s; text-decoration: none; display: inline-block; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-primary { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff; }
.btn-primary:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(99, 102, 241, 0.3); }
.btn-outline { background: transparent; color: #e0e0e8; border: 1px solid rgba(255,255,255,0.15); }
.btn-outline:hover { border-color: #6366f1; color: #fff; }
.form-page { display: flex; justify-content: center; align-items: center; min-height: calc(100vh - 80px); padding: 40px 20px; }
.form-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 40px; max-width: 480px; width: 100%; }
.form-card h2 { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
.form-card .subtitle { color: #8888a0; font-size: 14px; margin-bottom: 32px; }
.form-group { margin-bottom: 20px; }
.form-group label { display: block; font-size: 14px; font-weight: 500; margin-bottom: 6px; color: #c0c0d0; }
.form-group input, .form-group select { width: 100%; padding: 10px 14px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; font-size: 14px; color: #e0e0e8; outline: none; transition: border 0.2s; }
.form-group input:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15); }
.form-group input::placeholder { color: #6b7280; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.form-hint { font-size: 12px; color: #6b7280; margin-top: 4px; }
.code-row { display: flex; gap: 12px; }
.code-row .form-group { flex: 1; }
.code-row .btn { white-space: nowrap; height: 42px; margin-top: 22px; font-size: 13px; padding: 10px 16px; }
.error-msg { color: #ef4444; font-size: 13px; margin-top: 4px; display: none; }
.error-msg.show { display: block; }
.success-msg { color: #10b981; font-size: 13px; margin-top: 4px; }
.footer-meta { text-align: center; margin-top: 24px; color: #6b7280; font-size: 13px; }
.footer-meta a { color: #818cf8; text-decoration: none; }
.toast { position: fixed; top: 20px; right: 20px; z-index: 9999; padding: 12px 20px; border-radius: 8px; font-size: 14px; display: none; }
.toast.show { display: block; animation: slideIn .3s ease; }
.toast.success { background: #10b981; color: #fff; }
.toast.error { background: #ef4444; color: #fff; }
@keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
@media (max-width: 768px) { .form-row { grid-template-columns: 1fr; } .code-row { flex-direction: column; } .code-row .btn { margin-top: 0; } .form-card { padding: 24px; } }
`;

export function registerPage(): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>企业注册 - LLMGEO</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>${LANDING_STYLES}</style>
</head>
<body>
  <div class="gradient-bg"></div>

  <nav>
    <div class="container">
      <a href="/" class="logo">LLM<span>GEO</span></a>
      <div class="nav-links">
        <a href="/#features">功能</a>
        <a href="/#pricing">定价</a>
        <a href="/login">登录</a>
      </div>
    </div>
  </nav>

  <div class="form-page">
    <div class="form-card">
      <h2>企业注册</h2>
      <p class="subtitle">注册即赠送 3 天 AI 免费试用，无需信用卡</p>

      <form id="registerForm" onsubmit="handleRegister(event)">
        <div class="form-row">
          <div class="form-group">
            <label>企业名称 *</label>
            <input type="text" id="companyName" placeholder="例如：某某贸易有限公司" required>
          </div>
          <div class="form-group">
            <label>品牌名</label>
            <input type="text" id="brandName" placeholder="例如：MyBrand">
          </div>
        </div>

        <div class="form-group">
          <label>企业邮箱 *</label>
          <input type="email" id="email" placeholder="admin@company.com" required>
        </div>

        <div class="code-row">
          <div class="form-group">
            <label>验证码 *</label>
            <input type="text" id="code" placeholder="输入6位验证码" maxlength="6" required>
          </div>
          <button type="button" class="btn btn-outline" id="sendCodeBtn" onclick="sendCode()">发送验证码</button>
        </div>

        <div class="form-group">
          <label>设置密码 *</label>
          <input type="password" id="password" placeholder="至少6位密码" minlength="6" required>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>官网</label>
            <input type="url" id="website" placeholder="https://example.com">
          </div>
          <div class="form-group">
            <label>电话</label>
            <input type="tel" id="phone" placeholder="+86 13800138000">
          </div>
        </div>

        <div id="formError" class="error-msg"></div>

        <button type="submit" class="btn btn-primary" style="width:100%;justify-content:center;padding:12px;font-size:16px;">注册并开始免费试用</button>
      </form>

      <div class="footer-meta">
        已有账号？<a href="/login">立即登录</a><br>
        注册即代表同意 <a href="#">服务条款</a> 和 <a href="#">隐私政策</a>
      </div>
    </div>
  </div>

  <div id="toast" class="toast"></div>
  <script>
  function showToast(msg, type) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'toast ' + (type || 'success') + ' show';
    setTimeout(() => t.className = 'toast', 3000);
  }

  let codeTimer = null;
  let codeCountdown = 0;

  async function sendCode() {
    const email = document.getElementById('email').value.trim();
    if (!email) return showToast('请先输入邮箱', 'error');
    const btn = document.getElementById('sendCodeBtn');
    btn.disabled = true;

    try {
      const r = await fetch('/api/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, type: 'register' })
      });
      const data = await r.json();
      if (data.success) {
        showToast('验证码已发送到邮箱');
        // 开发模式显示 debug code
        if (data.debug?.code) {
          document.getElementById('code').value = data.debug.code;
        }
        // 倒计时
        codeCountdown = 60;
        btn.textContent = codeCountdown + 's';
        codeTimer = setInterval(() => {
          codeCountdown--;
          if (codeCountdown <= 0) {
            clearInterval(codeTimer);
            btn.textContent = '重新发送';
            btn.disabled = false;
          } else {
            btn.textContent = codeCountdown + 's';
          }
        }, 1000);
      } else {
        showToast(data.error || '发送失败', 'error');
        btn.disabled = false;
      }
    } catch(e) {
      showToast('网络错误', 'error');
      btn.disabled = false;
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    const companyName = document.getElementById('companyName').value.trim();
    const brandName = document.getElementById('brandName').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const code = document.getElementById('code').value.trim();
    const website = document.getElementById('website').value.trim();
    const phone = document.getElementById('phone').value.trim();

    if (!companyName || !email || !password || !code) {
      return showToast('请填写必要信息', 'error');
    }
    if (password.length < 6) {
      return showToast('密码至少6位', 'error');
    }

    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true;
    btn.textContent = '⏳ 注册中...';

    try {
      const r = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName, brandName: brandName || undefined, email, password, code, website: website || undefined, phone: phone || undefined })
      });
      const data = await r.json();
      if (data.success) {
        localStorage.setItem('token', data.data.token);
        showToast('注册成功！正在进入后台...');
        setTimeout(() => { window.location.href = '/company/dashboard'; }, 800);
      } else {
        showToast(data.error || '注册失败', 'error');
        btn.disabled = false;
        btn.textContent = '注册并开始免费试用';
      }
    } catch(e) {
      showToast('网络错误', 'error');
      btn.disabled = false;
      btn.textContent = '注册并开始免费试用';
    }
  }
  </script>
</body>
</html>`;
}

export function loginPage(): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>登录 - LLMGEO</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>${LANDING_STYLES}</style>
</head>
<body>
  <div class="gradient-bg"></div>

  <nav>
    <div class="container">
      <a href="/" class="logo">LLM<span>GEO</span></a>
      <div class="nav-links">
        <a href="/#features">功能</a>
        <a href="/#pricing">定价</a>
        <a href="/register">注册</a>
      </div>
    </div>
  </nav>

  <div class="form-page">
    <div class="form-card">
      <h2>登录</h2>
      <p class="subtitle">企业/代理/管理员通用登录</p>

      <form onsubmit="handleLogin(event)">
        <div class="form-group">
          <label>邮箱 / 用户名</label>
          <input type="text" id="email" placeholder="请输入您的邮箱" required>
        </div>
        <div class="form-group">
          <label>密码</label>
          <input type="password" id="password" placeholder="请输入密码" required>
        </div>
        <div id="formError" class="error-msg"></div>
        <button type="submit" class="btn btn-primary" style="width:100%;justify-content:center;padding:12px;font-size:16px;">登 录</button>
      </form>

      <div class="footer-meta" style="display:flex;justify-content:space-between;margin-top:16px;">
        <a href="/register">没有账号？立即注册</a>
        <a href="/forgot-password">忘记密码</a>
      </div>
    </div>
  </div>

  <div id="toast" class="toast"></div>
  <script>
  function showToast(msg, type) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'toast ' + (type || 'success') + ' show';
    setTimeout(() => t.className = 'toast', 3000);
  }

  async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    if (!email || !password) return showToast('请填写邮箱和密码', 'error');

    const btn = e.target.querySelector('button');
    btn.disabled = true;
    btn.textContent = '⏳ 登录中...';

    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await r.json();
      if (data.success) {
        localStorage.setItem('token', data.data.token);
        const role = data.data.role;
        showToast('登录成功');
        setTimeout(() => {
          if (role === 'admin') window.location.href = '/admin/dashboard';
          else if (role === 'agent') window.location.href = '/agent/dashboard';
          else if (role === 'operator') window.location.href = '/company/dashboard';
          else window.location.href = '/company/dashboard';
        }, 500);
      } else {
        showToast(data.error || '登录失败', 'error');
        btn.disabled = false;
        btn.textContent = '登 录';
      }
    } catch(e) {
      showToast('网络错误', 'error');
      btn.disabled = false;
      btn.textContent = '登 录';
    }
  }
  </script>
</body>
</html>`;
}
