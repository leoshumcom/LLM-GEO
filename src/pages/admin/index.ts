/**
 * 总控管理员后台页面
 * 平台管理员看到的 Dashboard
 */
import { pageLayout, emptyState, statusBadge } from '../shared/layout';

const SIDEBAR_LOGO = `<h1>🔮 LLMGEO</h1><p>总控后台</p>`;
const NAV = `
<a href="/admin/dashboard" class="active" data-nav="dashboard">📊 全局看板</a>
<a href="/admin/companies" data-nav="companies">🏢 企业管理</a>
<a href="/admin/agents" data-nav="agents">🤝 代理商管理</a>
<a href="/admin/finance" data-nav="finance">💰 财务</a>
<a href="/admin/refunds" data-nav="refunds">🔄 退款管理</a>
<a href="/admin/reservations" data-nav="reservations">📅 预约管理</a>
<a href="/admin/config" data-nav="config">⚙️ 配置</a>
<a href="/admin/logs" data-nav="logs">📜 日志</a>
`;

function navScript(active: string): string {
  return `<script>
document.querySelectorAll('.sidebar nav a').forEach(a => {
  a.classList.toggle('active', a.dataset.nav === '${active}');
});
</script>`;
}

// ===== 全局看板 =====
export function adminDashboardPage(): string {
  const body = `
<div class="stats">
  <div class="stat"><div class="label">企业总数</div><div class="value" id="totalCompanies">-</div></div>
  <div class="stat"><div class="label">代理商</div><div class="value" id="totalAgents">-</div></div>
  <div class="stat"><div class="label">本月新增</div><div class="value" id="newThisMonth">-</div></div>
  <div class="stat"><div class="label">本月收入</div><div class="value" id="monthRevenue">-</div></div>
</div>

<div class="stats" style="border-top:0;padding-top:0;">
  <div class="stat"><div class="label">待处理预约</div><div class="value" id="pendingReservations">-</div></div>
  <div class="stat"><div class="label">AI生成总量</div><div class="value" id="totalGenerations">-</div></div>
  <div class="stat"><div class="label">已发布文章</div><div class="value" id="totalPublished">-</div></div>
  <div class="stat"><div class="label">退款申请</div><div class="value" id="refundRequests">-</div></div>
</div>

<div class="card">
  <h3>最近注册企业</h3>
  <div id="recentCompanies"><div class="empty"><div class="icon">⏳</div><p>加载中...</p></div></div>
</div>

<div class="card">
  <h3>最近订单</h3>
  <div id="recentOrders"><div class="empty"><div class="icon">⏳</div><p>加载中...</p></div></div>
</div>

<script>
(async() => {
  // 加载统计数据
  const sr = await api('/admin/stats');
  if (sr.success) {
    const s = sr.data;
    document.getElementById('totalCompanies').textContent = s.totalCompanies || 0;
    document.getElementById('totalAgents').textContent = s.totalAgents || 0;
    document.getElementById('newThisMonth').textContent = s.newCompaniesThisMonth || 0;
    document.getElementById('monthRevenue').textContent = '¥' + ((s.monthRevenue || 0) / 100).toFixed(2);
    document.getElementById('pendingReservations').textContent = s.pendingReservations || 0;
    document.getElementById('totalGenerations').textContent = s.totalGenerations || 0;
    document.getElementById('totalPublished').textContent = s.totalPublished || 0;
    document.getElementById('refundRequests').textContent = s.refundRequests || 0;
  }
  
  // 最近企业
  const cr = await api('/admin/companies?pageSize=5');
  if (cr.success && cr.data.items.length) {
    document.getElementById('recentCompanies').innerHTML = '<table><tr><th>企业</th><th>邮箱</th><th>注册方式</th><th>时间</th></tr>' +
      cr.data.items.map(i => '<tr><td>' + (i.company_name || '-') + '</td><td>' + (i.contact_email || '-') + '</td><td>' + (i.registration_type === 'agent' ? '代理开通' : '自助注册') + '</td><td>' + formatDate(i.created_at) + '</td></tr>').join('') + '</table>';
  }
  
  // 最近订单
  const or = await api('/admin/orders?pageSize=5');
  if (or.success && or.data.items.length) {
    document.getElementById('recentOrders').innerHTML = '<table><tr><th>订单号</th><th>类型</th><th>金额</th><th>状态</th></tr>' +
      or.data.items.map(i => '<tr><td>' + (i.order_no || '-') + '</td><td>' + (i.order_type || '-') + '</td><td>¥' + (i.amount / 100).toFixed(2) + '</td><td>' + statusBadge(i.payment_status === 'paid' ? 'active' : i.payment_status === 'pending' ? 'pending' : '') + '</td></tr>').join('') + '</table>';
  }
})();
</script>
${navScript('dashboard')}`;

  return pageLayout('全局看板', NAV, SIDEBAR_LOGO,
    `<span>总控管理员</span><a href="#" onclick="logout()" class="logout">退出</a>`,
    body);
}

// ===== 企业管理 =====
export function adminCompaniesPage(): string {
  const body = `
<div class="card">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
    <h3 style="margin:0">全部企业</h3>
    <div style="display:flex;gap:8px;">
      <select id="statusFilter" onchange="loadComps()"><option value="">全部状态</option><option value="active">正常</option><option value="frozen">冻结</option><option value="refund_pending">退款中</option></select>
      <select id="regFilter" onchange="loadComps()"><option value="">全部注册方式</option><option value="self">自主注册</option><option value="agent">代理开通</option></select>
      <button class="btn btn-outline btn-sm" onclick="exportCsv('companies')">📥 导出CSV</button>
    </div>
  </div>
  <div class="search-bar"><input type="text" id="searchInput" placeholder="搜索企业名称、品牌、邮箱..." oninput="loadComps()"></div>
  <div id="comp-table"><div class="empty"><div class="icon">⏳</div><p>加载中...</p></div></div>
  <div id="comp-pagination" class="pagination"></div>
</div>
<script>
let cp = 1;
async function loadComps() {
  const q = document.getElementById('searchInput').value;
  const st = document.getElementById('statusFilter').value;
  const rf = document.getElementById('regFilter').value;
  const r = await api('/admin/companies?page=' + cp + '&pageSize=20&search=' + encodeURIComponent(q) + '&status=' + st + '&registrationType=' + rf);
  if (!r.success) return;
  const data = r.data;
  document.getElementById('comp-table').innerHTML = data.items.length
    ? '<table><tr><th>企业</th><th>品牌</th><th>邮箱</th><th>会员到期</th><th>AI套餐</th><th>状态</th><th>操作</th></tr>' +
      data.items.map(i => '<tr><td>' + (i.company_name || '-') + '</td><td>' + (i.brand_name || '-') + '</td><td>' + (i.contact_email || '-') + '</td><td>' + (i.membership_expires_at ? new Date(i.membership_expires_at).toLocaleDateString() : '-') + '</td><td>' + (i.ai_package_type || '-') + '</td><td>' + (i.status === 'refund_pending' ? '<span class="badge badge-warning">退款中</span>' : statusBadge(i.status === 'active' ? 'active' : 'pending')) + '</td><td>' +
        (i.status === 'refund_pending'
          ? '<button class="btn btn-sm btn-success" onclick="approveRefund(\'' + i.id + '\')">审核通过</button> <button class="btn btn-sm btn-danger" onclick="rejectRefund(\'' + i.id + '\')">拒绝</button>'
          : '<button class="btn btn-sm btn-outline" onclick="showToast(\'详情页开发中\')">查看</button>') +
        '</td></tr>').join('') + '</table>'
    : '<div class="empty"><p>暂无企业</p></div>';
  
  if (data.totalPages > 1) {
    let phtml = '';
    for (let i = 1; i <= data.totalPages; i++) {
      phtml += '<a href="#" onclick="cp=' + i + ';loadComps();return false" class="' + (i === cp ? 'active' : '') + '">' + i + '</a>';
    }
    document.getElementById('comp-pagination').innerHTML = phtml;
  }
}
async function exportCsv(type) {
  const token = localStorage.getItem('token');
  const res = await fetch('/api/admin/export/' + type, {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  if (res.ok) {
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = type + '.csv';
    a.click();
    window.URL.revokeObjectURL(url);
    showToast('导出成功');
  } else {
    showToast('导出失败', 'error');
  }
}

async function approveRefund(id) {
  if (!confirm('确定通过此退款申请？费用将退还到代理商余额。')) return;
  const r = await api('/admin/refunds/' + id + '/approve', { method: 'POST' });
  if (r.success) { showToast('退款已审核通过'); loadComps(); }
  else showToast(r.error || '操作失败', 'error');
}

async function rejectRefund(id) {
  if (!confirm('确定拒绝此退款申请？企业状态将恢复正常。')) return;
  const r = await api('/admin/refunds/' + id + '/reject', { method: 'POST' });
  if (r.success) { showToast('退款申请已拒绝'); loadComps(); }
  else showToast(r.error || '操作失败', 'error');
}

loadComps();
</script>
${navScript('companies')}`;

  return pageLayout('企业管理', NAV, SIDEBAR_LOGO,
    `<span>总控管理员</span><a href="#" onclick="logout()" class="logout">退出</a>`,
    body);
}

// ===== 代理商管理 =====
export function adminAgentsPage(): string {
  const body = `
<div class="card">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
    <h3 style="margin:0">代理商列表</h3>
    <button class="btn btn-primary btn-sm" onclick="showAddAgent()">➕ 添加代理商</button>
  </div>
  <div id="agent-table"><div class="empty"><div class="icon">⏳</div><p>加载中...</p></div></div>
  <div id="agent-pagination" class="pagination"></div>
</div>

<div class="modal-overlay" id="addAgentModal">
  <div class="modal">
    <h3>添加代理商</h3>
    <div class="form-group"><label>用户名</label><input type="text" id="agentUsername" placeholder="例如: agent01"></div>
    <div class="form-group"><label>邮箱</label><input type="email" id="agentEmail" placeholder="agent@example.com"></div>
    <div class="form-group"><label>密码</label><input type="password" id="agentPassword" placeholder="至少6位"></div>
    <div class="actions">
      <button class="btn btn-outline" onclick="closeAgentModal()">取消</button>
      <button class="btn btn-primary" onclick="addAgent()">添加</button>
    </div>
  </div>
</div>

<script>
let ap = 1;
async function loadAgents() {
  const r = await api('/admin/agents?page=' + ap + '&pageSize=20');
  if (!r.success) return;
  const data = r.data;
  document.getElementById('agent-table').innerHTML = data.items.length
    ? '<table><tr><th>用户名</th><th>邮箱</th><th>余额</th><th>开户费</th><th>名下企业</th><th>状态</th><th>操作</th></tr>' +
      data.items.map(i => '<tr><td>' + (i.username || '-') + '</td><td>' + (i.email || '-') + '</td><td>¥' + ((i.balance || 0) / 100).toFixed(2) + '</td><td>' + (i.paid_8888 ? '✅' : '❌') + '</td><td>' + (i.companyCount || 0) + '</td><td>' + statusBadge(i.status === 'active' ? 'active' : 'pending') + '</td><td><button class="btn btn-sm btn-outline" onclick="showToast(\'详情页开发中\')">编辑</button></td></tr>').join('') + '</table>'
    : '<div class="empty"><p>暂无代理商</p></div>';
  
  if (data.totalPages > 1) {
    let phtml = '';
    for (let i = 1; i <= data.totalPages; i++) {
      phtml += '<a href="#" onclick="ap=' + i + ';loadAgents();return false" class="' + (i === ap ? 'active' : '') + '">' + i + '</a>';
    }
    document.getElementById('agent-pagination').innerHTML = phtml;
  }
}

function showAddAgent() { document.getElementById('addAgentModal').classList.add('show'); }
function closeAgentModal() { document.getElementById('addAgentModal').classList.remove('show'); }

async function addAgent() {
  const username = document.getElementById('agentUsername').value.trim();
  const email = document.getElementById('agentEmail').value.trim();
  const password = document.getElementById('agentPassword').value;
  if (!username || !email || !password) return showToast('请填写完整信息', 'error');
  const r = await api('/admin/agents', { method: 'POST', body: JSON.stringify({ username, email, password }) });
  if (r.success) { showToast('代理商添加成功'); closeAgentModal(); loadAgents(); }
  else showToast(r.error || '添加失败', 'error');
}

loadAgents();
</script>
${navScript('agents')}`;

  return pageLayout('代理商管理', NAV, SIDEBAR_LOGO,
    `<span>总控管理员</span><a href="#" onclick="logout()" class="logout">退出</a>`,
    body);
}

// ===== 财务管理 =====
export function adminFinancePage(): string {
  const body = `
<div class="stats">
  <div class="stat"><div class="label">总订单数</div><div class="value" id="totalOrders">-</div></div>
  <div class="stat"><div class="label">总营收</div><div class="value" id="totalRevenue">-</div></div>
  <div class="stat"><div class="label">本月营收</div><div class="value" id="monthRevenue">-</div></div>
  <div class="stat"><div class="label">待处理退款</div><div class="value" id="pendingRefund">-</div></div>
</div>

<div class="card">
  <h3>订单列表</h3>
  <div class="search-bar">
    <select id="orderTypeFilter" onchange="loadOrders()">
      <option value="">全部类型</option><option value="agent_registration">代理商开户</option><option value="company_fee">企业年费</option><option value="ai_daily">AI日套餐</option><option value="ai_monthly">AI月套餐</option>
    </select>
    <select id="orderStatusFilter" onchange="loadOrders()">
      <option value="">全部状态</option><option value="paid">已支付</option><option value="pending">待支付</option><option value="refunded">已退款</option>
    </select>
    <button class="btn btn-outline btn-sm" onclick="exportCsv('publish-records')">📥 发布记录CSV</button>
  </div>
  <div id="finance-table"><div class="empty"><div class="icon">⏳</div><p>加载中...</p></div></div>
  <div id="finance-pagination" class="pagination"></div>
</div>

<script>
(async() => {
  const sr = await api('/admin/stats');
  if (sr.success) {
    const s = sr.data;
    document.getElementById('totalOrders').textContent = s.totalOrders || 0;
    document.getElementById('totalRevenue').textContent = '¥' + ((s.totalRevenue || 0) / 100).toFixed(2);
    document.getElementById('monthRevenue').textContent = '¥' + ((s.monthRevenue || 0) / 100).toFixed(2);
    document.getElementById('pendingRefund').textContent = s.pendingRefund || 0;
  }
})();

let fp = 1;
async function loadOrders() {
  const type = document.getElementById('orderTypeFilter').value;
  const status = document.getElementById('orderStatusFilter').value;
  const r = await api('/admin/orders?page=' + fp + '&pageSize=20&type=' + type + '&status=' + status);
  if (!r.success) return;
  const data = r.data;
  document.getElementById('finance-table').innerHTML = data.items.length
    ? '<table><tr><th>订单号</th><th>类型</th><th>金额</th><th>支付方式</th><th>状态</th><th>时间</th></tr>' +
      data.items.map(i => '<tr><td>' + (i.order_no || '-') + '</td><td>' + (i.order_type || '-') + '</td><td>¥' + (i.amount / 100).toFixed(2) + '</td><td>' + (i.payment_method || '-') + '</td><td>' + statusBadge(i.payment_status === 'paid' ? 'active' : i.payment_status === 'pending' ? 'pending' : '') + '</td><td>' + formatDate(i.created_at) + '</td></tr>').join('') + '</table>'
    : '<div class="empty"><p>暂无订单</p></div>';
  
  if (data.totalPages > 1) {
    let phtml = '';
    for (let i = 1; i <= data.totalPages; i++) {
      phtml += '<a href="#" onclick="fp=' + i + ';loadOrders();return false" class="' + (i === fp ? 'active' : '') + '">' + i + '</a>';
    }
    document.getElementById('finance-pagination').innerHTML = phtml;
  }
}
loadOrders();
</script>
${navScript('finance')}`;

  return pageLayout('财务管理', NAV, SIDEBAR_LOGO,
    `<span>总控管理员</span><a href="#" onclick="logout()" class="logout">退出</a>`,
    body);
}

// ===== 预约管理 =====
export function adminReservationsPage(): string {
  const body = `
<div class="card">
  <h3>增值预约工单</h3>
  <div class="search-bar">
    <select id="resStatusFilter" onchange="loadReservations()">
      <option value="">全部状态</option><option value="pending">待处理</option><option value="contacted">已联系</option><option value="completed">已完成</option>
    </select>
  </div>
  <div id="reservation-table"><div class="empty"><div class="icon">⏳</div><p>加载中...</p></div></div>
  <div id="reservation-pagination" class="pagination"></div>
</div>
<script>
let rp = 1;
async function loadReservations() {
  const status = document.getElementById('resStatusFilter').value;
  const r = await api('/admin/reservations?page=' + rp + '&pageSize=20&status=' + status);
  if (!r.success) return;
  const data = r.data;
  document.getElementById('reservation-table').innerHTML = data.items.length
    ? '<table><tr><th>申请人</th><th>联系方式</th><th>服务类型</th><th>状态</th><th>创建时间</th><th>操作</th></tr>' +
      data.items.map(i => '<tr><td>' + (i.applicant_name || '-') + '</td><td>' + (i.contact || '-') + '</td><td>类型' + (i.service_type || '-') + '</td><td>' + statusBadge(i.status === 'completed' ? 'active' : i.status === 'contacted' ? 'pending' : '') + '</td><td>' + formatDate(i.created_at) + '</td><td><button class="btn btn-sm btn-outline" onclick="markContacted(\'' + i.id + '\')">标记已联系</button></td></tr>').join('') + '</table>'
    : '<div class="empty"><p>暂无预约工单</p></div>';
  
  if (data.totalPages > 1) {
    let phtml = '';
    for (let i = 1; i <= data.totalPages; i++) {
      phtml += '<a href="#" onclick="rp=' + i + ';loadReservations();return false" class="' + (i === rp ? 'active' : '') + '">' + i + '</a>';
    }
    document.getElementById('reservation-pagination').innerHTML = phtml;
  }
}

async function markContacted(id) {
  const r = await api('/admin/reservations/' + id, { method: 'PATCH', body: JSON.stringify({ status: 'contacted' }) });
  if (r.success) { showToast('已标记为已联系'); loadReservations(); }
  else showToast(r.error || '操作失败', 'error');
}

loadReservations();
</script>
${navScript('reservations')}`;

  return pageLayout('预约管理', NAV, SIDEBAR_LOGO,
    `<span>总控管理员</span><a href="#" onclick="logout()" class="logout">退出</a>`,
    body);
}

// ===== 系统配置 =====
export function adminConfigPage(): string {
  const body = `
<div class="card">
  <h3>系统配置</h3>
  <p style="color:#6b7280;font-size:14px;margin-bottom:16px;">修改定价等核心配置后立即生效。</p>
  <div id="config-table"><div class="empty"><div class="icon">⏳</div><p>加载中...</p></div></div>
</div>
<script>
async function loadConfig() {
  const r = await api('/admin/config');
  if (!r.success) return;
  const items = r.data || [];
  document.getElementById('config-table').innerHTML = items.length
    ? '<table><tr><th>配置项</th><th>值（分）</th><th>说明</th><th>操作</th></tr>' +
      items.map(i => '<tr><td><strong>' + (i.config_key || '-') + '</strong></td><td><input type="number" id="cfg_' + i.config_key + '" value="' + i.config_value + '" style="width:100px;padding:4px 8px;border:1px solid #d1d5db;border-radius:4px;"></td><td style="color:#6b7280;font-size:13px;">' + (i.description || '-') + '</td><td><button class="btn btn-sm btn-primary" onclick="updateConfig(\'' + i.config_key + '\')">保存</button></td></tr>').join('') + '</table>'
    : '<div class="empty"><p>暂无配置</p></div>';
}

async function updateConfig(key) {
  const value = document.getElementById('cfg_' + key).value;
  const r = await api('/admin/config/' + key, { method: 'PUT', body: JSON.stringify({ value }) });
  if (r.success) showToast('配置已更新');
  else showToast(r.error || '更新失败', 'error');
}

loadConfig();
</script>
${navScript('config')}`;

  return pageLayout('系统配置', NAV, SIDEBAR_LOGO,
    `<span>总控管理员</span><a href="#" onclick="logout()" class="logout">退出</a>`,
    body);
}

// ===== 退款管理 =====
export function adminRefundsPage(): string {
  const body = `
<div class="card">
  <h3>🔄 退款申请管理</h3>
  <p style="color:#6b7280;font-size:14px;margin-bottom:16px;">代理商提交的企业注销退款申请，创建超过7天的企业不可退款。</p>
  <div id="refund-table"><div class="empty"><div class="icon">⏳</div><p>加载中...</p></div></div>
  <div id="refund-pagination" class="pagination"></div>
</div>
<script>
let rfp = 1;
async function loadRefunds() {
  const r = await api('/admin/refunds?page=' + rfp + '&pageSize=20');
  if (!r.success) return;
  const data = r.data;
  document.getElementById('refund-table').innerHTML = data.items.length
    ? '<table><tr><th>企业名称</th><th>代理商</th><th>注册费</th><th>创建时间</th><th>申请时间</th><th>操作</th></tr>' +
      data.items.map(i => '<tr><td>' + (i.company_name || '-') + '</td><td>' + (i.agent_name || '自助注册') + '</td><td>¥' + ((i.registration_fee || 0) / 100).toFixed(2) + '</td><td>' + formatDate(i.created_at) + '</td><td>' + formatDate(i.refund_requested_at) + '</td><td>' +
        '<button class="btn btn-sm btn-success" onclick="approveRefund(\'' + i.id + '\')">✅ 通过</button> ' +
        '<button class="btn btn-sm btn-danger" onclick="rejectRefund(\'' + i.id + '\')">❌ 拒绝</button></td></tr>').join('') + '</table>'
    : '<div class="empty"><p>暂无退款申请</p></div>';
  
  if (data.totalPages > 1) {
    let phtml = '';
    for (let i = 1; i <= data.totalPages; i++) {
      phtml += '<a href="#" onclick="rfp=' + i + ';loadRefunds();return false" class="' + (i === rfp ? 'active' : '') + '">' + i + '</a>';
    }
    document.getElementById('refund-pagination').innerHTML = phtml;
  }
}

async function approveRefund(id) {
  if (!confirm('确定通过此退款申请？费用将退还到代理商余额，企业将被禁用。')) return;
  const r = await api('/admin/refunds/' + id + '/approve', { method: 'POST' });
  if (r.success) { showToast('退款已审核通过'); loadRefunds(); }
  else showToast(r.error || '操作失败', 'error');
}

async function rejectRefund(id) {
  if (!confirm('确定拒绝此退款申请？企业状态将恢复为正常。')) return;
  const r = await api('/admin/refunds/' + id + '/reject', { method: 'POST' });
  if (r.success) { showToast('退款申请已拒绝'); loadRefunds(); }
  else showToast(r.error || '操作失败', 'error');
}

loadRefunds();
</script>
${navScript('refunds')}`;

  return pageLayout('退款管理', NAV, SIDEBAR_LOGO,
    `<span>总控管理员</span><a href="#" onclick="logout()" class="logout">退出</a>`,
    body);
}

// ===== 系统日志 =====
export function adminLogsPage(): string {
  const body = `
<div class="card">
  <h3>操作日志</h3>
  <div class="search-bar">
    <select id="logActionFilter" onchange="loadLogs()">
      <option value="">全部操作</option><option value="login">登录</option><option value="payment">支付</option><option value="ai_generate">AI生成</option><option value="publish">发布</option><option value="config_change">配置变更</option>
    </select>
    <select id="logTypeFilter" onchange="loadLogs()">
      <option value="">全部用户</option><option value="admin">管理员</option><option value="agent">代理商</option><option value="company">企业</option>
    </select>
  </div>
  <div id="log-table"><div class="empty"><div class="icon">⏳</div><p>加载中...</p></div></div>
  <div id="log-pagination" class="pagination"></div>
</div>
<script>
let lp = 1;
async function loadLogs() {
  const action = document.getElementById('logActionFilter').value;
  const userType = document.getElementById('logTypeFilter').value;
  const r = await api('/admin/logs?page=' + lp + '&pageSize=30&action=' + action + '&userType=' + userType);
  if (!r.success) return;
  const data = r.data;
  document.getElementById('log-table').innerHTML = data.items.length
    ? '<table><tr><th>时间</th><th>用户</th><th>操作</th><th>详情</th></tr>' +
      data.items.map(i => '<tr><td style="font-size:12px;color:#6b7280;">' + formatDate(i.created_at) + '</td><td>' + (i.user_type || '-') + '</td><td><span class="badge badge-info">' + (i.action || '-') + '</span></td><td style="font-size:13px;color:#6b7280;max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + (i.detail || '-') + '</td></tr>').join('') + '</table>'
    : '<div class="empty"><p>暂无日志</p></div>';
  
  if (data.totalPages > 1) {
    let phtml = '';
    for (let i = 1; i <= data.totalPages; i++) {
      phtml += '<a href="#" onclick="lp=' + i + ';loadLogs();return false" class="' + (i === lp ? 'active' : '') + '">' + i + '</a>';
    }
    document.getElementById('log-pagination').innerHTML = phtml;
  }
}
loadLogs();
</script>
${navScript('logs')}`;

  return pageLayout('系统日志', NAV, SIDEBAR_LOGO,
    `<span>总控管理员</span><a href="#" onclick="logout()" class="logout">退出</a>`,
    body);
}
