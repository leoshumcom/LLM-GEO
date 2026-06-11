/**
 * 代理商管理后台页面
 * 代理商登录后看到的完整 Dashboard
 */
import { pageLayout, emptyState, statusBadge } from '../shared/layout';

const SIDEBAR_LOGO = `<h1>🔮 LLMGEO</h1><p>代理商后台</p>`;
const NAV = `
<a href="/agent/dashboard" class="active" data-nav="dashboard">📊 数据看板</a>
<a href="/agent/companies" data-nav="companies">🏢 名下企业</a>
<a href="/agent/balance" data-nav="balance">💰 余额管理</a>
<a href="/agent/orders" data-nav="orders">📋 订单历史</a>
<a href="/agent/profile" data-nav="profile">👤 个人资料</a>
`;

function navScript(active: string): string {
  return `<script>
document.querySelectorAll('.sidebar nav a').forEach(a => {
  a.classList.toggle('active', a.dataset.nav === '${active}');
});
</script>`;
}

// ===== 数据看板 =====
export function agentDashboardPage(agent: any, stats?: any): string {
  const body = `
<div class="stats">
  <div class="stat"><div class="label">名下企业</div><div class="value">${stats?.totalCompanies || 0}</div></div>
  <div class="stat"><div class="label">账户余额</div><div class="value">¥${((agent?.balance || 0) / 100).toFixed(2)}</div><div class="sub">${agent?.paid_8888 ? '已支付开户费' : '未支付开户费'}</div></div>
  <div class="stat"><div class="label">本月订单</div><div class="value">${stats?.monthOrders || 0}</div></div>
  <div class="stat"><div class="label">总消费</div><div class="value">¥${((stats?.totalSpent || 0) / 100).toFixed(2)}</div></div>
</div>

<div class="card">
  <h3>快速操作</h3>
  <div style="display:flex;gap:12px;flex-wrap:wrap;">
    <button class="btn btn-primary" onclick="showCreateCompany()">🏢 创建新企业</button>
    <a href="/agent/balance" class="btn btn-success">💰 充值余额</a>
    <a href="/agent/companies" class="btn btn-outline">📋 查看企业列表</a>
  </div>
</div>

<div class="card">
  <h3>名下企业列表</h3>
  <div id="company-list"><div class="empty"><div class="icon">⏳</div><p>加载中...</p></div></div>
</div>

<!-- 创建企业 Modal -->
<div class="modal-overlay" id="createCompanyModal">
  <div class="modal">
    <h3>创建新企业</h3>
    <p style="color:#6b7280;font-size:13px;margin-bottom:16px;">创建企业后将自动扣除年费 <strong>¥888</strong></p>
    <div class="form-group"><label>企业名称</label><input type="text" id="ccName" placeholder="例如: 某某贸易有限公司"></div>
    <div class="form-group"><label>品牌名称</label><input type="text" id="ccBrand" placeholder="例如: MyBrand"></div>
    <div class="form-group"><label>管理员邮箱（登录账号）</label><input type="email" id="ccEmail" placeholder="admin@company.com"></div>
    <div class="form-group"><label>管理员密码</label><input type="password" id="ccPassword" placeholder="至少6位"></div>
    <div class="form-group"><label>联系电话</label><input type="text" id="ccPhone" placeholder="可选"></div>
    <div class="actions">
      <button class="btn btn-outline" onclick="closeModal()">取消</button>
      <button class="btn btn-primary" onclick="createCompany()">创建（¥888）</button>
    </div>
  </div>
</div>

<script>
async function loadCompanies() {
  const r = await api('/agent/companies?pageSize=10');
  if (!r.success) return;
  const items = r.data?.items || [];
  document.getElementById('company-list').innerHTML = items.length
    ? '<table><tr><th>企业名称</th><th>品牌</th><th>会员状态</th><th>创建时间</th><th>操作</th></tr>' +
      items.map(i => '<tr><td>' + (i.company_name || '-') + '</td><td>' + (i.brand_name || '-') + '</td><td>' + (i.membership_expires_at ? (new Date(i.membership_expires_at) > new Date() ? '<span class="badge badge-success">有效</span>' : '<span class="badge badge-danger">已过期</span>') : '<span class="badge badge-warning">未激活</span>') + '</td><td>' + formatDate(i.created_at) + '</td><td><a href="/agent/profile?tenant=' + i.tenant_id + '" class="btn btn-sm btn-outline">详情</a></td></tr>').join('') + '</table>'
    : '<div class="empty"><p>暂无名下企业</p></div>';
}

function showCreateCompany() { document.getElementById('createCompanyModal').classList.add('show'); }
function closeModal() { document.getElementById('createCompanyModal').classList.remove('show'); }

async function createCompany() {
  const name = document.getElementById('ccName').value.trim();
  const brand = document.getElementById('ccBrand').value.trim();
  const email = document.getElementById('ccEmail').value.trim();
  const password = document.getElementById('ccPassword').value;
  const phone = document.getElementById('ccPhone').value.trim();
  if (!name || !email || !password) return showToast('请填写企业名称、邮箱和密码', 'error');
  if (password.length < 6) return showToast('密码至少6位', 'error');
  
  const btn = event.target;
  btn.disabled = true;
  btn.textContent = '⏳ 创建中...';
  
  const r = await api('/agent/companies', { method: 'POST', body: JSON.stringify({ companyName: name, brandName: brand, email, password, phone }) });
  if (r.success) { showToast('企业创建成功！¥888已扣除'); closeModal(); loadCompanies(); }
  else showToast(r.error || '创建失败', 'error');
  
  btn.disabled = false;
  btn.textContent = '创建（¥888）';
}

loadCompanies();
</script>
${navScript('dashboard')}`;

  return pageLayout('数据看板', NAV, SIDEBAR_LOGO,
    `<span>${agent?.username || '代理商'}</span><span>¥${((agent?.balance || 0) / 100).toFixed(2)}</span><a href="#" onclick="logout()" class="logout">退出</a>`,
    body);
}

// ===== 名下企业 =====
export function agentCompaniesPage(agent: any): string {
  const body = `
<div class="card">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
    <h3 style="margin:0">名下企业列表</h3>
    <button class="btn btn-primary btn-sm" onclick="showCreateCompany()">🏢 创建新企业</button>
  </div>
  <div class="search-bar">
    <input type="text" id="searchInput" placeholder="搜索企业名称、品牌..." oninput="loadComps()">
  </div>
  <div id="comp-table"><div class="empty"><div class="icon">⏳</div><p>加载中...</p></div></div>
  <div id="comp-pagination" class="pagination"></div>
</div>

<div class="modal-overlay" id="createCompanyModal2">
  <div class="modal">
    <h3>创建新企业</h3>
    <p style="color:#6b7280;font-size:13px;margin-bottom:16px;">扣除余额 <strong>¥888</strong></p>
    <div class="form-group"><label>企业名称</label><input type="text" id="cc2Name" placeholder="例如: 某某贸易有限公司"></div>
    <div class="form-group"><label>品牌名称</label><input type="text" id="cc2Brand" placeholder="例如: MyBrand"></div>
    <div class="form-group"><label>管理员邮箱</label><input type="email" id="cc2Email" placeholder="admin@company.com"></div>
    <div class="form-group"><label>管理员密码</label><input type="password" id="cc2Password" placeholder="至少6位"></div>
    <div class="actions">
      <button class="btn btn-outline" onclick="closeModal2()">取消</button>
      <button class="btn btn-primary" onclick="createCompany2()">创建</button>
    </div>
  </div>
</div>

<script>
let cp = 1;
async function loadComps() {
  const s = document.getElementById('searchInput').value;
  const r = await api('/agent/companies?page=' + cp + '&pageSize=20&search=' + encodeURIComponent(s));
  if (!r.success) return;
  const data = r.data;
  document.getElementById('comp-table').innerHTML = data.items.length
    ? '<table><tr><th>企业名称</th><th>品牌</th><th>邮箱</th><th>会员到期</th><th>AI套餐</th><th>操作</th></tr>' +
      data.items.map(i => '<tr><td>' + (i.company_name || '-') + '</td><td>' + (i.brand_name || '-') + '</td><td>' + (i.contact_email || '-') + '</td><td>' + (i.membership_expires_at ? new Date(i.membership_expires_at).toLocaleDateString() : '-') + '</td><td>' + (i.ai_package_type || '-') + '</td><td><button class="btn btn-sm btn-danger" onclick="showToast(\'功能开发中\')">停用</button></td></tr>').join('') + '</table>'
    : '<div class="empty"><p>暂无名下企业</p></div>';
  
  if (data.totalPages > 1) {
    let phtml = '';
    for (let i = 1; i <= data.totalPages; i++) {
      phtml += '<a href="#" onclick="cp=' + i + ';loadComps();return false" class="' + (i === cp ? 'active' : '') + '">' + i + '</a>';
    }
    document.getElementById('comp-pagination').innerHTML = phtml;
  }
}

function showCreateCompany() { document.getElementById('createCompanyModal2').classList.add('show'); }
function closeModal2() { document.getElementById('createCompanyModal2').classList.remove('show'); }

async function createCompany2() {
  const name = document.getElementById('cc2Name').value.trim();
  const brand = document.getElementById('cc2Brand').value.trim();
  const email = document.getElementById('cc2Email').value.trim();
  const password = document.getElementById('cc2Password').value;
  if (!name || !email || !password) return showToast('请填写完整', 'error');
  const r = await api('/agent/companies', { method: 'POST', body: JSON.stringify({ companyName: name, brandName: brand, email, password }) });
  if (r.success) { showToast('企业创建成功'); closeModal2(); loadComps(); }
  else showToast(r.error || '创建失败', 'error');
}

loadComps();
</script>
${navScript('companies')}`;

  return pageLayout('名下企业', NAV, SIDEBAR_LOGO,
    `<span>${agent?.username || '代理商'}</span><span>¥${((agent?.balance || 0) / 100).toFixed(2)}</span><a href="#" onclick="logout()" class="logout">退出</a>`,
    body);
}

// ===== 余额管理 =====
export function agentBalancePage(agent: any): string {
  const body = `
<div class="stats">
  <div class="stat"><div class="label">可用余额</div><div class="value">¥${((agent?.balance || 0) / 100).toFixed(2)}</div></div>
  <div class="stat"><div class="label">已消费</div><div class="value" id="totalSpent">加载中...</div></div>
  <div class="stat"><div class="label">开户费</div><div class="value">${agent?.paid_8888 ? '✅ 已支付' : '❌ 未支付'}</div></div>
</div>

<div class="card">
  <h3>充值</h3>
  <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;">
    <div class="form-group" style="flex:1;min-width:200px;">
      <label>充值金额（元）</label>
      <input type="number" id="rechargeAmount" value="1000" min="100" step="100">
    </div>
    <button class="btn btn-primary" onclick="recharge()">💰 去充值</button>
  </div>
  <p style="color:#6b7280;font-size:13px;margin-top:8px;">最低充值 ¥100，支持微信/支付宝</p>
</div>

<div class="card">
  <h3>余额流水</h3>
  <div id="balance-log"><div class="empty"><div class="icon">⏳</div><p>加载中...</p></div></div>
</div>

<script>
async function loadLog() {
  const r = await api('/agent/balance/log?pageSize=20');
  if (!r.success) return;
  const items = r.data?.items || [];
  document.getElementById('balance-log').innerHTML = items.length
    ? '<table><tr><th>类型</th><th>变动</th><th>余额</th><th>描述</th><th>时间</th></tr>' +
      items.map(i => '<tr><td>' + (i.operation_type || '-') + '</td><td style="color:' + (i.change_amount > 0 ? '#10b981' : '#ef4444') + ';font-weight:600;">' + (i.change_amount > 0 ? '+' : '') + '¥' + (Math.abs(i.change_amount) / 100).toFixed(2) + '</td><td>¥' + (i.balance_after / 100).toFixed(2) + '</td><td>' + (i.description || '-') + '</td><td>' + formatDate(i.created_at) + '</td></tr>').join('') + '</table>'
    : '<div class="empty"><p>暂无流水记录</p></div>';
    
  // 总消费
  const totalConsumed = items.filter(i => i.change_amount < 0).reduce((sum, i) => sum + Math.abs(i.change_amount), 0);
  document.getElementById('totalSpent').textContent = '¥' + (totalConsumed / 100).toFixed(2);
}

async function recharge() {
  const amount = parseInt(document.getElementById('rechargeAmount').value);
  if (!amount || amount < 100) return showToast('最低充值 ¥100', 'error');
  const r = await api('/agent/balance/recharge', { method: 'POST', body: JSON.stringify({ amount: amount * 100 }) });
  if (r.success && r.data?.payUrl) { window.open(r.data.payUrl, '_blank'); loadLog(); }
  else showToast(r.error || '充值失败', 'error');
}

loadLog();
</script>
${navScript('balance')}`;

  return pageLayout('余额管理', NAV, SIDEBAR_LOGO,
    `<span>${agent?.username || '代理商'}</span><span>¥${((agent?.balance || 0) / 100).toFixed(2)}</span><a href="#" onclick="logout()" class="logout">退出</a>`,
    body);
}

// ===== 订单历史 =====
export function agentOrdersPage(agent: any): string {
  const body = `
<div class="card">
  <h3>订单历史</h3>
  <div class="search-bar">
    <select id="orderTypeFilter" onchange="loadOrders()"><option value="">全部类型</option><option value="company_fee">企业年费</option><option value="ai_daily">AI日套餐</option><option value="ai_monthly">AI月套餐</option><option value="recharge">充值</option></select>
    <select id="orderStatusFilter" onchange="loadOrders()"><option value="">全部状态</option><option value="paid">已支付</option><option value="pending">待支付</option><option value="refunded">已退款</option></select>
  </div>
  <div id="order-table"><div class="empty"><div class="icon">⏳</div><p>加载中...</p></div></div>
  <div id="order-pagination" class="pagination"></div>
</div>
<script>
let op = 1;
async function loadOrders() {
  const type = document.getElementById('orderTypeFilter').value;
  const status = document.getElementById('orderStatusFilter').value;
  const r = await api('/agent/orders?page=' + op + '&pageSize=20&type=' + type + '&status=' + status);
  if (!r.success) return;
  const data = r.data;
  document.getElementById('order-table').innerHTML = data.items.length
    ? '<table><tr><th>订单号</th><th>类型</th><th>金额</th><th>状态</th><th>时间</th></tr>' +
      data.items.map(i => '<tr><td>' + (i.order_no || '-') + '</td><td>' + (i.order_type || '-') + '</td><td>¥' + (i.amount / 100).toFixed(2) + '</td><td>' + statusBadge(i.payment_status === 'paid' ? 'active' : 'pending') + '</td><td>' + formatDate(i.created_at) + '</td></tr>').join('') + '</table>'
    : '<div class="empty"><p>暂无订单</p></div>';
  
  if (data.totalPages > 1) {
    let phtml = '';
    for (let i = 1; i <= data.totalPages; i++) {
      phtml += '<a href="#" onclick="op=' + i + ';loadOrders();return false" class="' + (i === op ? 'active' : '') + '">' + i + '</a>';
    }
    document.getElementById('order-pagination').innerHTML = phtml;
  }
}
loadOrders();
</script>
${navScript('orders')}`;

  return pageLayout('订单历史', NAV, SIDEBAR_LOGO,
    `<span>${agent?.username || '代理商'}</span><span>¥${((agent?.balance || 0) / 100).toFixed(2)}</span><a href="#" onclick="logout()" class="logout">退出</a>`,
    body);
}

// ===== 个人资料 =====
export function agentProfilePage(agent: any): string {
  const body = `
<div class="card">
  <h3>个人资料</h3>
  <div class="form-row">
    <div class="form-group"><label>用户名</label><input type="text" value="${agent?.username || ''}" disabled></div>
    <div class="form-group"><label>邮箱</label><input type="text" value="${agent?.email || ''}" disabled></div>
  </div>
  <div class="form-row">
    <div class="form-group"><label>联系电话</label><input type="text" id="phone" value="${agent?.contact_phone || ''}"></div>
    <div class="form-group"><label>状态</label><input type="text" value="${agent?.status || ''}" disabled></div>
  </div>
  <button class="btn btn-primary" onclick="saveProfile()">保存修改</button>
</div>

<div class="card">
  <h3>账户信息</h3>
  <div class="form-group"><label>开户费</label><input type="text" value="${agent?.paid_8888 ? '✅ 已支付 ¥8,888' : '❌ 未支付'}" disabled></div>
  <div class="form-group"><label>当前余额</label><input type="text" value="¥${((agent?.balance || 0) / 100).toFixed(2)}" disabled></div>
  <p style="color:#6b7280;font-size:13px;margin-top:8px;">未支付开户费的代理商无法创建企业。</p>
</div>

<script>
async function saveProfile() {
  const r = await api('/agent/profile', { method: 'PUT', body: JSON.stringify({ phone: document.getElementById('phone').value }) });
  if (r.success) showToast('保存成功');
  else showToast(r.error || '保存失败', 'error');
}
</script>
${navScript('profile')}`;

  return pageLayout('个人资料', NAV, SIDEBAR_LOGO,
    `<span>${agent?.username || '代理商'}</span><span>¥${((agent?.balance || 0) / 100).toFixed(2)}</span><a href="#" onclick="logout()" class="logout">退出</a>`,
    body);
}
