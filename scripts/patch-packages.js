const fs = require('fs');
let src = fs.readFileSync('src/pages/company/index.ts', 'utf8');

// Find markers
const startMarker = '// ===== 购买套餐 =====';
const endMarker = '// ===== AI 模型配置 =====';

const startIdx = src.indexOf(startMarker);
const endIdx = src.indexOf(endMarker);

if (startIdx === -1) throw new Error('start marker not found');
if (endIdx === -1) throw new Error('end marker not found');

const header = `// ===== 购买套餐 =====
export function companyPackagesPage(user: any): string {
  const body = \`
<style>
.pkg-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); gap:24px; margin:20px 0; }
.pkg-card { border-radius:16px; padding:32px 24px; text-align:center; transition:all .2s; position:relative; }
.pkg-card:hover { transform:translateY(-4px); }
.pkg-card .icon { font-size:40px; margin-bottom:12px; }
.pkg-card .name { font-size:22px; font-weight:700; margin-bottom:4px; }
.pkg-card .subtitle { font-size:13px; margin-bottom:16px; }
.pkg-card .price { font-size:36px; font-weight:800; margin:12px 0; }
.pkg-card .price small { font-size:14px; font-weight:400; opacity:0.7; }
.pkg-card .features { text-align:left; margin:16px 0 20px; padding:0; list-style:none; }
.pkg-card .features li { padding:6px 0; font-size:14px; display:flex; align-items:center; gap:8px; }
.pkg-card .features li::before { content:"✓"; font-weight:700; }
.pkg-card.enterprise { background:linear-gradient(135deg,#1e3a5f,#1f2937); border:1px solid #2563eb; }
.pkg-card.enterprise .name { color:#93c5fd; }
.pkg-card.enterprise .price { color:#60a5fa; }
.pkg-card.enterprise .features li::before { color:#60a5fa; }
.pkg-card.agent { background:linear-gradient(135deg,#3b1f6e,#1f2937); border:1px solid #7c3aed; }
.pkg-card.agent .name { color:#c4b5fd; }
.pkg-card.agent .price { color:#a78bfa; }
.pkg-card.agent .features li::before { color:#a78bfa; }
.pkg-card.agent .badge-rec { position:absolute; top:-12px; left:50%; transform:translateX(-50%); background:#7c3aed; color:#fff; padding:4px 16px; border-radius:20px; font-size:12px; font-weight:600; }
.pkg-card.premium { background:linear-gradient(135deg,#5f1e1e,#1f2937); border:1px solid #dc2626; }
.pkg-card.premium .name { color:#fca5a5; }
.pkg-card.premium .price { color:#f87171; }
.pkg-card.premium .features li::before { color:#f87171; }
.pkg-card .btn-buy { display:block; width:100%; padding:12px; border-radius:8px; font-size:15px; font-weight:600; cursor:pointer; border:none; transition:all .2s; }
.pkg-card.enterprise .btn-buy { background:#2563eb; color:#fff; }
.pkg-card.agent .btn-buy { background:#7c3aed; color:#fff; }
.pkg-card.premium .btn-buy { background:#dc2626; color:#fff; }
.pkg-card .btn-buy:hover { opacity:0.85; }
.pkg-card .btn-buy:disabled { opacity:0.5; cursor:not-allowed; }
.status-bar { display:flex; gap:24px; flex-wrap:wrap; margin-bottom:24px; }
.status-item { flex:1; min-width:200px; padding:20px; border-radius:12px; background:#1f2937; border:1px solid #374151; }
.status-item .label { color:#9ca3af; font-size:13px; }
.status-item .value { font-size:18px; font-weight:700; color:#e5e7eb; margin-top:4px; }
</style>

<div class="status-bar">
  <div class="status-item">
    <div class="label">👤 当前身份</div>
    <div class="value">\${user.registration_type === 'agent' ? '代理商企业' : '企业用户'}</div>
  </div>
  <div class="status-item">
    <div class="label">📅 会员状态</div>
    <div class="value">\${user.membership_expires_at ? new Date(user.membership_expires_at).toLocaleDateString('zh-CN') : '未开通'}</div>
  </div>
  <div class="status-item">
    <div class="label">🤖 AI 加油包</div>
    <div class="value">\${user.ai_package_type && user.ai_package_type !== 'none' ? '✅ 已开通' : '❌ 未开通'}</div>
    <div style="color:#6b7280;font-size:12px;">\${user.ai_package_expires_at ? '到期: ' + new Date(user.ai_package_expires_at).toLocaleDateString('zh-CN') : ''}</div>
  </div>
</div>

<div class="card">
  <h3 style="margin-bottom:4px;">💎 选择套餐</h3>
  <p style="color:#6b7280;font-size:14px;margin-bottom:16px;">买断制 · 一次性付费，永久使用</p>

  <div class="pkg-grid">
    <!-- 企业自助版 -->
    <div class="pkg-card enterprise">
      <div class="icon">🏪</div>
      <div class="name">企业自助版</div>
      <div class="subtitle" style="color:#9ca3af;">适合独立运营企业</div>
      <div class="price">¥1,688 <small>一次性</small></div>
      <ul class="features" style="color:#d1d5db;">
        <li>全功能 GEO 内容管理平台</li>
        <li>关键词研究 & 内容生成</li>
        <li>站群发布 & 外链管理</li>
        <li>16+ 社媒渠道绑定</li>
        <li>子账号管理（最多10人）</li>
      </ul>
      <button class="btn-buy" onclick="buyPackage('self')">立即购买</button>
    </div>

    <!-- 代理商版 -->
    <div class="pkg-card agent">
      <span class="badge-rec">🔥 推荐</span>
      <div class="icon">🚀</div>
      <div class="name">代理商版</div>
      <div class="subtitle" style="color:#9ca3af;">发展下级企业客户</div>
      <div class="price">¥8,888 <small>一次性</small></div>
      <ul class="features" style="color:#d1d5db;">
        <li>包含企业自助版全部功能</li>
        <li>无限开企业客户（¥888/家）</li>
        <li>客户管理系统</li>
        <li>余额充值体系</li>
        <li>佣金 & 流水报表</li>
      </ul>
      <button class="btn-buy" onclick="buyPackage('agent')">立即购买</button>
    </div>

    <!-- 高级代理商版 -->
    <div class="pkg-card premium">
      <div class="icon">👑</div>
      <div class="name">高级代理商版</div>
      <div class="subtitle" style="color:#9ca3af;">充值赠送 ¥8,000</div>
      <div class="price">¥18,888 <small>到账 ¥26,888</small></div>
      <ul class="features" style="color:#d1d5db;">
        <li>代理商版全部功能</li>
        <li>充值赠送 ¥8,000 账户金</li>
        <li>到账余额：¥26,888</li>
        <li>可开约 30 家下级企业</li>
        <li>专属客服支持</li>
      </ul>
      <button class="btn-buy" onclick="buyPackage('premium')">立即购买</button>
    </div>
  </div>
</div>

<div class="card">
  <h3>📜 订单记录</h3>
  <div id="order-history"><div class="empty"><div class="icon">⏳</div><p>加载中...</p></div></div>
</div>

<div class="card" id="payment-status" style="display:none;">
  <h3>💰 支付</h3>
  <div id="payment-content"></div>
</div>

<script>
async function buyPackage(type) {
  const names = { self: '企业自助版 ¥1,688', agent: '代理商版 ¥8,888', premium: '高级代理商版 ¥18,888' };
  const btn = event.target;
  btn.disabled = true; btn.textContent = '⏳ 创建订单...';
  const r = await api('/payment/create', {
    method: 'POST',
    body: JSON.stringify({ packageType: type === 'self' ? 'enterprise_self' : type === 'agent' ? 'agent_standard' : 'agent_premium' })
  });
  if (r.success) showPayment(r, names[type]);
  else showToast(r.error || '创建失败', 'error');
  btn.disabled = false; btn.textContent = '立即购买';
}

function showPayment(r, name) {
  const d = r.data;
  document.getElementById('payment-status').style.display = 'block';
  document.getElementById('payment-content').innerHTML =
    '<p>📦 <strong>' + name + '</strong></p>' +
    '<p>订单号：<strong>' + d.orderNo + '</strong></p>' +
    '<p>金额：<strong class="text-primary">¥' + d.amount + '</strong></p>' +
    '<div style="margin:20px 0;text-align:center;">' +
      (d.qrcode ? '<img src="' + d.qrcode + '" style="width:200px;height:200px;border:1px solid #374151;border-radius:8px;"><p style="font-size:14px;color:#6b7280;margin-top:8px;">请使用微信/支付宝扫码支付</p>' : '') +
      '<p><a href="' + (d.payUrl || '#') + '" target="_blank" class="btn btn-success" style="justify-content:center;">🔗 去支付</a></p>' +
    '</div>' +
    '<p style="font-size:13px;color:#6b7280;text-align:center;">支付完成后请等待几秒，系统自动生效</p>';
  showToast('订单已创建，请完成支付');
}

async function loadOrders() {
  const r = await api('/payment/orders');
  if (!r.success) return;
  const items = r.data?.items || [];
  const sb = { pending: '<span class="badge badge-warning">待支付</span>', paid: '<span class="badge badge-success">已支付</span>', failed: '<span class="badge badge-danger">失败</span>', refunded: '<span class="badge">已退款</span>' };
  const tn = { enterprise_self: '企业自助版', agent_standard: '代理商版', agent_premium: '高级代理商版' };
  document.getElementById('order-history').innerHTML = items.length
    ? '<table><tr><th>订单号</th><th>类型</th><th>金额</th><th>状态</th><th>时间</th></tr>' +
      items.map(i => '<tr><td style="font-size:12px;">' + i.order_no + '</td><td>' + (tn[i.order_type] || i.order_type) + '</td><td>¥' + (i.amount / 100).toFixed(2) + '</td><td>' + (sb[i.payment_status] || i.payment_status) + '</td><td>' + formatDate(i.created_at) + '</td></tr>').join('') + '</table>'
    : '<div class="empty"><p>暂无订单记录</p></div>';
}

loadOrders();
</script>
\${navScript('packages')}\`;

  return pageLayout('购买套餐', NAV, SIDEBAR_LOGO,
    \`<span>\${user.company_name || ''}</span><a href="#" onclick="logout()" class="logout">退出</a>\`,
    body);
}

`;

const result = src.substring(0, startIdx) + header + src.substring(endIdx);
fs.writeFileSync('src/pages/company/index.ts', result, 'utf8');
console.log('OK - packages page replaced');
