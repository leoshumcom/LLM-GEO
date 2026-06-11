/**
 * 企业管理后台页面
 * 企业用户登录后看到的 Dashboard
 */
import { pageLayout, emptyState, statusBadge } from '../shared/layout';

const SIDEBAR_LOGO = `<h1>🔮 LLMGEO</h1><p>企业管理后台</p>`;

const NAV = `
<a href="/company/dashboard" class="active" data-nav="dashboard">📊 数据看板</a>
<a href="/company/keywords" data-nav="keywords">🔑 关键词管理</a>
<a href="/company/ai" data-nav="ai">🤖 AI 内容生成</a>
<a href="/company/publish" data-nav="publish">📤 发布记录</a>
<a href="/company/social" data-nav="social">🔗 社媒绑定</a>
<a href="/company/profile" data-nav="profile">🏢 企业资料</a>
<a href="/company/operators" data-nav="operators">👥 子账号</a>
<a href="/company/media" data-nav="media">🖼️ 素材库</a>
`;

function navScript(active: string): string {
  return `<script>
document.querySelectorAll('.sidebar nav a').forEach(a => {
  a.classList.toggle('active', a.dataset.nav === '${active}');
});
</script>`;
}

// ===== Dashboard =====
export function companyDashboardPage(user: any, stats: any): string {
  const body = `
<div class="stats">
  <div class="stat"><div class="label">关键词总数</div><div class="value">${stats.totalKeywords || 0}</div><div class="sub">待处理 ${stats.pendingKeywords || 0}</div></div>
  <div class="stat"><div class="label">已生成内容</div><div class="value">${stats.generatedContents || 0}</div><div class="sub">已发布 ${stats.publishedCount || 0}</div></div>
  <div class="stat"><div class="label">已绑定社媒</div><div class="value">${stats.socialCount || 0}</div></div>
  <div class="stat"><div class="label">会员状态</div><div class="value">${user.ai_package_type && user.ai_package_type !== 'none' ? '✅' : '❌'}</div><div class="sub">${user.membership_expires_at ? '到期: ' + new Date(user.membership_expires_at).toLocaleDateString() : '未开通'}</div></div>
</div>

<div class="card">
  <h3>快速操作</h3>
  <div style="display:flex;gap:12px;flex-wrap:wrap;">
    <a href="/company/keywords" class="btn btn-primary">➕ 添加关键词</a>
    <a href="/company/ai" class="btn btn-success">🤖 AI 生成内容</a>
    <a href="/company/social" class="btn btn-outline">🔗 绑定社媒</a>
  </div>
</div>

<div class="card">
  <h3>最近生成记录</h3>
  <div id="recent-contents"><div class="empty"><div class="icon">⏳</div><p>加载中...</p></div></div>
</div>

<script>
(async () => {
  const r = await api('/company/ai/generate?pageSize=5');
  if (r.success && r.data.items.length > 0) {
    document.getElementById('recent-contents').innerHTML = '<table><tr><th>关键词</th><th>状态</th><th>时间</th></tr>' +
      r.data.items.map(i => '<tr><td>' + (i.title || i.keyword) + '</td><td>${statusBadge('${i.status}')}</td><td>' + formatDate(i.created_at) + '</td></tr>').join('') + '</table>';
  } else {
    document.getElementById('recent-contents').innerHTML = '${emptyState('📝', '还没有生成记录，去添加关键词开始吧')}';
  }
})();
</script>
${navScript('dashboard')}`;

  return pageLayout('数据看板', NAV, SIDEBAR_LOGO,
    `<span>${user.company_name || ''}</span><span>${statusBadge(user.ai_package_type && user.ai_package_type !== 'none' ? 'active' : 'pending')}</span><a href="#" onclick="logout()" class="logout">退出</a>`,
    body);
}

// ===== 关键词管理 =====
export function companyKeywordsPage(user: any): string {
  const body = `
<div class="card">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
    <h3 style="margin:0">关键词列表</h3>
    <div style="display:flex;gap:8px;">
      <button class="btn btn-primary btn-sm" onclick="showAddModal()">➕ 添加</button>
      <button class="btn btn-outline btn-sm" onclick="showBatchModal()">📋 批量导入</button>
    </div>
  </div>

  <div class="search-bar">
    <select id="statusFilter" onchange="loadKeywords()"><option value="">全部状态</option><option value="pending">待处理</option><option value="generating">生成中</option><option value="generated">已生成</option><option value="failed">失败</option></select>
    <input type="text" id="searchInput" placeholder="搜索关键词..." oninput="loadKeywords()">
  </div>

  <div id="keyword-table"><div class="empty"><div class="icon">⏳</div><p>加载中...</p></div></div>
  <div id="keyword-pagination" class="pagination"></div>
</div>

<!-- 添加单个关键词 Modal -->
<div class="modal-overlay" id="addModal">
  <div class="modal">
    <h3>添加关键词</h3>
    <div class="form-group"><label>关键词</label><input type="text" id="addKeyword" placeholder="例如: car led lights"></div>
    <div class="form-group"><label>分组（可选）</label><input type="text" id="addGroup" placeholder="例如: 车灯"></div>
    <div class="actions">
      <button class="btn btn-outline" onclick="closeModal('addModal')">取消</button>
      <button class="btn btn-primary" onclick="addKeyword()">确定</button>
    </div>
  </div>
</div>

<!-- 批量导入 Modal -->
<div class="modal-overlay" id="batchModal">
  <div class="modal">
    <h3>批量导入关键词</h3>
    <div class="form-group"><label>关键词（每行一个）</label><textarea id="batchKeywords" rows="8" placeholder="car led lights&#10;headlight bulbs&#10;fog lights"></textarea></div>
    <div class="form-group"><label>分组（可选）</label><input type="text" id="batchGroup" placeholder="例如: 车灯"></div>
    <div class="actions">
      <button class="btn btn-outline" onclick="closeModal('batchModal')">取消</button>
      <button class="btn btn-primary" onclick="batchImport()">导入</button>
    </div>
  </div>
</div>

<script>
let currentPage = 1;
async function loadKeywords() {
  const status = document.getElementById('statusFilter').value;
  const search = document.getElementById('searchInput').value;
  const r = await api('/company/keywords?page=' + currentPage + '&pageSize=20&status=' + status);
  if (!r.success) return;
  const data = r.data;
  const tbody = data.items.map(i => '<tr><td>' + i.keyword + '</td><td><span class="badge ' + (i.status === 'pending' ? 'badge-warning' : i.status === 'generating' ? 'badge-info' : i.status === 'generated' ? 'badge-success' : 'badge-danger') + '">' + i.status + '</span></td><td>' + (i.group_name || '-') + '</td><td>' + formatDate(i.created_at) + '</td><td><button class="btn btn-danger btn-sm" onclick="deleteKeyword(\'' + i.id + '\')">删除</button></td></tr>').join('');
  document.getElementById('keyword-table').innerHTML = data.items.length ? '<table><tr><th>关键词</th><th>状态</th><th>分组</th><th>添加时间</th><th>操作</th></tr>' + tbody + '</table>' : '<div class="empty"><p>暂无关键词</p></div>';
  
  if (data.totalPages > 1) {
    let p = '';
    for (let i = 1; i <= data.totalPages; i++) {
      p += '<a href="#" onclick="currentPage=' + i + ';loadKeywords();return false" class="' + (i === currentPage ? 'active' : '') + '">' + i + '</a>';
    }
    document.getElementById('keyword-pagination').innerHTML = p;
  }
}

function showAddModal() { document.getElementById('addModal').classList.add('show'); }
function showBatchModal() { document.getElementById('batchModal').classList.add('show'); }
function closeModal(id) { document.getElementById(id).classList.remove('show'); }

async function addKeyword() {
  const keyword = document.getElementById('addKeyword').value.trim();
  const groupName = document.getElementById('addGroup').value.trim();
  if (!keyword) return showToast('请输入关键词', 'error');
  const r = await api('/company/keywords', { method: 'POST', body: JSON.stringify({ keyword, groupName }) });
  if (r.success) { showToast('添加成功'); closeModal('addModal'); document.getElementById('addKeyword').value = ''; loadKeywords(); }
  else showToast(r.error || '添加失败', 'error');
}

async function batchImport() {
  const text = document.getElementById('batchKeywords').value.trim();
  const groupName = document.getElementById('batchGroup').value.trim();
  if (!text) return showToast('请输入关键词', 'error');
  const keywords = text.split('\\n').map(k => k.trim()).filter(k => k);
  const r = await api('/company/keywords/batch', { method: 'POST', body: JSON.stringify({ keywords, groupName }) });
  if (r.success) { showToast(r.message); closeModal('batchModal'); document.getElementById('batchKeywords').value = ''; loadKeywords(); }
  else showToast(r.error || '导入失败', 'error');
}

async function deleteKeyword(id) {
  if (!confirm('确定删除该关键词？')) return;
  const r = await api('/company/keywords/' + id, { method: 'DELETE' });
  if (r.success) { showToast('删除成功'); loadKeywords(); }
  else showToast(r.error || '删除失败', 'error');
}

loadKeywords();
</script>
${navScript('keywords')}`;

  return pageLayout('关键词管理', NAV, SIDEBAR_LOGO,
    `<span>${user.company_name || ''}</span><a href="#" onclick="logout()" class="logout">退出</a>`,
    body);
}

// ===== AI 内容生成 =====
export function companyAiPage(user: any): string {
  const body = `
<div class="card">
  <h3>AI 内容生成</h3>
  <p style="color:#6b7280;margin-bottom:16px;font-size:14px;">选择待处理的关键词，AI 将自动生成 SEO 优化文章。</p>
  <div id="pending-keywords"><div class="empty"><div class="icon">⏳</div><p>加载中...</p></div></div>
  <div style="margin-top:16px;display:flex;gap:8px;">
    <button class="btn btn-primary" onclick="generateSelected()" id="generateBtn" disabled>🤖 生成选中的内容</button>
    <button class="btn btn-outline" onclick="selectAll()">全选</button>
    <button class="btn btn-outline" onclick="deselectAll()">取消全选</button>
  </div>
</div>

<div class="card">
  <h3>生成记录</h3>
  <div class="search-bar">
    <select id="genStatusFilter" onchange="loadGenerated()"><option value="">全部</option><option value="pending">排队中</option><option value="completed">完成</option><option value="failed">失败</option></select>
  </div>
  <div id="generated-table"><div class="empty"><div class="icon">⏳</div><p>加载中...</p></div></div>
</div>

<script>
let selectedKws = new Set();

async function loadPending() {
  const r = await api('/company/keywords?status=pending&pageSize=100');
  if (!r.success) return;
  const items = r.data.items;
  document.getElementById('pending-keywords').innerHTML = items.length
    ? '<table><tr><th style="width:40px"><input type="checkbox" id="checkAll" onchange="toggleAll(this)"></th><th>关键词</th><th>分组</th><th>添加时间</th></tr>' +
      items.map(i => '<tr><td><input type="checkbox" value="' + i.id + '" onchange="toggleKw(this)"></td><td>' + i.keyword + '</td><td>' + (i.group_name || '-') + '</td><td>' + formatDate(i.created_at) + '</td></tr>').join('') + '</table>'
    : '<div class="empty"><p>没有待处理的关键词，先去添加关键词吧</p></div>';
}

function toggleAll(cb) {
  document.querySelectorAll('#pending-keywords input[type=checkbox]').forEach(c => { c.checked = cb.checked; });
  updateSelected();
}

function toggleKw(cb) {
  if (cb.checked) selectedKws.add(cb.value);
  else selectedKws.delete(cb.value);
  updateSelected();
}

function selectAll() {
  document.querySelectorAll('#pending-keywords input[type=checkbox]').forEach(c => { c.checked = true; selectedKws.add(c.value); });
  updateSelected();
}

function deselectAll() {
  document.querySelectorAll('#pending-keywords input[type=checkbox]').forEach(c => { c.checked = false; });
  selectedKws.clear();
  updateSelected();
}

function updateSelected() {
  const btn = document.getElementById('generateBtn');
  btn.disabled = selectedKws.size === 0;
  btn.textContent = '🤖 生成选中内容 (' + selectedKws.size + ')';
}

async function generateSelected() {
  if (selectedKws.size === 0) return;
  const btn = document.getElementById('generateBtn');
  btn.disabled = true;
  btn.textContent = '⏳ 生成中...';
  const r = await api('/company/ai/generate', { method: 'POST', body: JSON.stringify({ keywordIds: Array.from(selectedKws), provider: 'agnes' }) });
  if (r.success) { showToast(r.message || '生成任务已提交'); selectedKws.clear(); loadPending(); loadGenerated(); }
  else showToast(r.error || '提交失败', 'error');
  btn.disabled = false;
  btn.textContent = '🤖 生成选中的内容';
}

let genPage = 1;
async function loadGenerated() {
  const status = document.getElementById('genStatusFilter').value;
  const r = await api('/company/ai/generate?page=' + genPage + '&pageSize=20&status=' + status);
  if (!r.success) return;
  const items = r.data.items;
  document.getElementById('generated-table').innerHTML = items.length
    ? '<table><tr><th>标题/关键词</th><th>状态</th><th>模型</th><th>时间</th><th>操作</th></tr>' +
      items.map(i => '<tr><td>' + (i.title || i.keyword) + '</td><td>' + '${statusBadge('${i.status}')}' + '</td><td>' + (i.provider || '-') + '</td><td>' + formatDate(i.created_at) + '</td><td>' + (i.status === 'completed' ? '<button class="btn btn-sm btn-outline" onclick="viewContent(\'' + i.id + '\')">查看</button>' : '') + '</td></tr>').join('') + '</table>'
    : '<div class="empty"><p>暂无生成记录</p></div>';
}

async function viewContent(id) {
  const r = await api('/company/ai/generate/' + id);
  if (!r.success || !r.data) return;
  const d = r.data;
  const win = window.open('', '_blank');
  win.document.write('<!DOCTYPE html><html><head><title>' + (d.title || d.keyword) + '</title><meta charset="utf-8"><style>body{max-width:800px;margin:40px auto;padding:0 20px;font-family:sans-serif;line-height:1.8}h1{color:#1f2937;border-bottom:2px solid #e5e7eb;padding-bottom:12px}pre{background:#f9fafb;padding:16px;border-radius:8px;overflow-x:auto}</style></head><body>' + d.content + '</body></html>');
  win.document.close();
}

loadPending();
loadGenerated();
</script>
${navScript('ai')}`;

  return pageLayout('AI 内容生成', NAV, SIDEBAR_LOGO,
    `<span>${user.company_name || ''}</span><a href="#" onclick="logout()" class="logout">退出</a>`,
    body);
}

// ===== 发布记录 =====
export function companyPublishPage(user: any): string {
  const body = `
<div class="card">
  <h3>发布记录</h3>
  <div id="publish-table"><div class="empty"><div class="icon">⏳</div><p>加载中...</p></div></div>
</div>
<script>
let pubPage = 1;
async function loadPublishes() {
  const r = await api('/company/publish?page=' + pubPage + '&pageSize=20');
  if (!r.success) return;
  const items = r.data.items;
  document.getElementById('publish-table').innerHTML = items.length
    ? '<table><tr><th>关键词</th><th>平台</th><th>状态</th><th>链接</th><th>发布时间</th></tr>' +
      items.map(i => '<tr><td>' + (i.title || i.keyword) + '</td><td>' + (i.platform || '-') + '</td><td>' + '${statusBadge('${i.status}')}' + '</td><td>' + (i.platform_url ? '<a href="' + i.platform_url + '" target="_blank">查看</a>' : '-') + '</td><td>' + formatDate(i.published_at) + '</td></tr>').join('') + '</table>'
    : '<div class="empty"><p>暂无发布记录</p></div>';
}
loadPublishes();
</script>
${navScript('publish')}`;

  return pageLayout('发布记录', NAV, SIDEBAR_LOGO,
    `<span>${user.company_name || ''}</span><a href="#" onclick="logout()" class="logout">退出</a>`,
    body);
}

// ===== 企业资料 =====
export function companyProfilePage(user: any): string {
  const body = `
<div class="card">
  <h3>企业资料</h3>
  <div class="form-row">
    <div class="form-group"><label>企业名称</label><input type="text" id="companyName" value="${user.company_name || ''}" disabled></div>
    <div class="form-group"><label>品牌名称</label><input type="text" id="brandName" value="${user.brand_name || ''}"></div>
  </div>
  <div class="form-row">
    <div class="form-group"><label>官网</label><input type="text" id="website" value="${user.website || ''}"></div>
    <div class="form-group"><label>联系电话</label><input type="text" id="phone" value="${user.contact_phone || ''}"></div>
  </div>
  <div class="form-group"><label>WhatsApp</label><input type="text" id="whatsapp" value="${user.contact_whatsapp || ''}"></div>
  <div class="form-group"><label>邮箱</label><input type="text" value="${user.contact_email || ''}" disabled></div>
  <button class="btn btn-primary" onclick="saveProfile()">保存修改</button>
</div>

<div class="card">
  <h3>会员信息</h3>
  <p>注册类型：${user.registration_type === 'agent' ? '代理商代开' : '自助注册'}</p>
  <p>会员到期：${user.membership_expires_at ? new Date(user.membership_expires_at).toLocaleDateString() : '未开通'}</p>
  <p>AI套餐：${user.ai_package_type && user.ai_package_type !== 'none' ? user.ai_package_type + '（到期：' + (user.ai_package_expires_at ? new Date(user.ai_package_expires_at).toLocaleDateString() : '未知') + '）' : '未购买'}</p>
</div>

<script>
async function saveProfile() {
  const r = await api('/company/profile', {
    method: 'PUT',
    body: JSON.stringify({
      brandName: document.getElementById('brandName').value,
      website: document.getElementById('website').value,
      phone: document.getElementById('phone').value,
      whatsapp: document.getElementById('whatsapp').value,
    })
  });
  if (r.success) showToast('保存成功');
  else showToast(r.error || '保存失败', 'error');
}
</script>
${navScript('profile')}`;

  return pageLayout('企业资料', NAV, SIDEBAR_LOGO,
    `<span>${user.company_name || ''}</span><a href="#" onclick="logout()" class="logout">退出</a>`,
    body);
}

// ===== 社媒绑定 =====
export function companySocialPage(user: any): string {
  const platformNames: Record<string, string> = {
    twitter: 'Twitter (X)',
    facebook: 'Facebook',
    linkedin: 'LinkedIn',
  };

  const body = `
<div class="card">
  <h3>社媒账号绑定</h3>
  <p style="color:#6b7280;font-size:14px;margin-bottom:16px;">绑定社媒账号后，AI 生成的内容可自动发布到对应平台。</p>
  <div id="social-list"><div class="empty"><div class="icon">⏳</div><p>加载中...</p></div></div>
</div>

<div class="card">
  <h3>绑定新账号</h3>
  <p style="color:#6b7280;font-size:14px;margin-bottom:16px;">点击下方平台按钮，跳转到对应平台进行授权。</p>
  <div style="display:flex;gap:12px;">
    <a class="btn btn-outline" onclick="showToast('请先在系统配置中设置Twitter API凭证', 'error')">🐦 Twitter</a>
    <a class="btn btn-outline" onclick="showToast('请先在系统配置中设置Facebook API凭证', 'error')">📘 Facebook</a>
    <a class="btn btn-outline" onclick="showToast('请先在系统配置中设置LinkedIn API凭证', 'error')">💼 LinkedIn</a>
  </div>
</div>

<script>
async function loadSocial() {
  const r = await api('/company/social');
  if (!r.success) return;
  const items = r.data;
  document.getElementById('social-list').innerHTML = items.length
    ? '<table><tr><th>平台</th><th>账号</th><th>状态</th><th>绑定时间</th><th>操作</th></tr>' +
      items.map(i => '<tr><td>' + (${JSON.stringify(platformNames)}[i.platform] || i.platform) + '</td><td>' + (i.platform_user_name || '-') + '</td><td>' + '${statusBadge('' + (i.status === 'active' ? 'active' : 'pending'))}' + '</td><td>' + formatDate(i.created_at) + '</td><td><button class="btn btn-danger btn-sm" onclick="unbind(\'' + i.platform + '\')">解绑</button></td></tr>').join('') + '</table>'
    : '<div class="empty"><p>尚未绑定任何社媒账号</p></div>';
}

async function unbind(platform) {
  if (!confirm('确定解绑 ' + platform + '？')) return;
  const r = await api('/company/social/' + platform, { method: 'DELETE' });
  if (r.success) { showToast('解绑成功'); loadSocial(); }
  else showToast(r.error || '解绑失败', 'error');
}

loadSocial();
</script>
${navScript('social')}`;

  return pageLayout('社媒绑定', NAV, SIDEBAR_LOGO,
    `<span>${user.company_name || ''}</span><a href="#" onclick="logout()" class="logout">退出</a>`,
    body);
}

// ===== 子账号管理 =====
export function companyOperatorsPage(user: any): string {
  const body = `
<div class="card">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
    <h3 style="margin:0">运营子账号</h3>
    <button class="btn btn-primary btn-sm" onclick="showAddOpModal()">➕ 创建子账号</button>
  </div>
  <div id="operator-list"><div class="empty"><div class="icon">⏳</div><p>加载中...</p></div></div>
</div>

<div class="modal-overlay" id="addOpModal">
  <div class="modal">
    <h3>创建运营子账号</h3>
    <div class="form-group"><label>用户名（登录用）</label><input type="text" id="opUsername" placeholder="例如: editor01"></div>
    <div class="form-group"><label>密码</label><input type="password" id="opPassword" placeholder="至少6位"></div>
    <div class="form-group"><label>显示名称</label><input type="text" id="opDisplayName" placeholder="例如: 编辑小明"></div>
    <div class="actions">
      <button class="btn btn-outline" onclick="closeOpModal()">取消</button>
      <button class="btn btn-primary" onclick="createOperator()">创建</button>
    </div>
  </div>
</div>

<script>
async function loadOperators() {
  const r = await api('/company/operators');
  if (!r.success) return;
  const items = r.data;
  document.getElementById('operator-list').innerHTML = items.length
    ? '<table><tr><th>用户名</th><th>显示名称</th><th>创建时间</th></tr>' +
      items.map(i => '<tr><td>' + i.username + '</td><td>' + (i.display_name || '-') + '</td><td>' + formatDate(i.created_at) + '</td></tr>').join('') + '</table>'
    : '<div class="empty"><p>暂无子账号</p></div>';
}

function showAddOpModal() { document.getElementById('addOpModal').classList.add('show'); }
function closeOpModal() { document.getElementById('addOpModal').classList.remove('show'); }

async function createOperator() {
  const username = document.getElementById('opUsername').value.trim();
  const password = document.getElementById('opPassword').value;
  const displayName = document.getElementById('opDisplayName').value.trim();
  if (!username || !password) return showToast('请填写用户名和密码', 'error');
  if (password.length < 6) return showToast('密码至少6位', 'error');
  const r = await api('/company/operators', { method: 'POST', body: JSON.stringify({ username, password, displayName }) });
  if (r.success) { showToast('子账号创建成功'); closeOpModal(); loadOperators(); }
  else showToast(r.error || '创建失败', 'error');
}

loadOperators();
</script>
${navScript('operators')}`;

  return pageLayout('子账号管理', NAV, SIDEBAR_LOGO,
    `<span>${user.company_name || ''}</span><a href="#" onclick="logout()" class="logout">退出</a>`,
    body);
}

// ===== 素材库 =====
export function companyMediaPage(user: any): string {
  const body = `
<div class="card">
  <h3>AI 素材库</h3>
  <div id="media-list"><div class="empty"><div class="icon">⏳</div><p>加载中...</p></div></div>
</div>
<script>
let mediaPage = 1;
async function loadMedia() {
  const r = await api('/company/media?page=' + mediaPage + '&pageSize=20');
  if (!r.success) return;
  const items = r.data.items;
  document.getElementById('media-list').innerHTML = items.length
    ? '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px;">' +
      items.map(i => '<div style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;"><img src="' + (i.url || '') + '" style="width:100%;height:150px;object-fit:cover;" onerror="this.src=\\'data:image/svg+xml,<svg xmlns=\\\"http://www.w3.org/2000/svg\\\"><rect fill=\\"%23f3f4f6\\\" width=\\"100%\\\" height=\\"100%\\\"/></svg>\\'"><div style="padding:8px;font-size:12px;color:#6b7280;"><span>' + i.file_type + '</span><span style="float:right">' + formatDate(i.created_at) + '</span></div></div>').join('') + '</div>'
    : '<div class="empty"><p>暂无素材</p></div>';
}
loadMedia();
</script>
${navScript('media')}`;

  return pageLayout('素材库', NAV, SIDEBAR_LOGO,
    `<span>${user.company_name || ''}</span><a href="#" onclick="logout()" class="logout">退出</a>`,
    body);
}
