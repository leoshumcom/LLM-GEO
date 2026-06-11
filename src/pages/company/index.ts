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
<a href="/company/sites" data-nav="sites">🌐 站群发布</a>
<a href="/company/social" data-nav="social">🔗 社媒 & 渠道</a>
<a href="/company/ai-config" data-nav="ai_config">⚙️ 模型配置</a>
<a href="/company/profile" data-nav="profile">🏢 企业资料</a>
<a href="/company/operators" data-nav="operators">👥 子账号</a>
<a href="/company/media" data-nav="media">🖼️ 素材库</a>
<a href="/company/packages" data-nav="packages">💳 购买套餐</a>
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
  const body = `
<div class="card">
  <h3>🌍 社媒 & 发布渠道管理</h3>
  <p style="color:#6b7280;font-size:14px;margin-bottom:16px;">
    配置发布渠道后，AI 生成的内容可自动/手动发布。支持三种方式：
  </p>
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;margin-bottom:16px;">
    <div style="background:#f0f9ff;padding:12px;border-radius:8px;text-align:center;">
      <div style="font-size:24px;">🌐</div>
      <strong style="font-size:13px;">浏览器扫码登录</strong>
      <p style="font-size:11px;color:#6b7280;">扫码后系统存 Cookie，自动发布</p>
    </div>
    <div style="background:#fefce8;padding:12px;border-radius:8px;text-align:center;">
      <div style="font-size:24px;">🔑</div>
      <strong style="font-size:13px;">API Key 直连</strong>
      <p style="font-size:11px;color:#6b7280;">WordPress / 自定义 API</p>
    </div>
    <div style="background:#f0fdf4;padding:12px;border-radius:8px;text-align:center;">
      <div style="font-size:24px;">📋</div>
      <strong style="font-size:13px;">手动复制</strong>
      <p style="font-size:11px;color:#6b7280;">生成内容模板，自行粘贴发布</p>
    </div>
  </div>
</div>

<div class="card">
  <h3>📡 已配置渠道</h3>
  <div id="channel-list"><div class="empty"><div class="icon">⏳</div><p>加载中...</p></div></div>
</div>

<div class="card">
  <h3>➕ 添加新渠道</h3>

  <!-- 选项卡 -->
  <div style="display:flex;gap:0;margin-bottom:16px;border-bottom:2px solid #e5e7eb;">
    <button class="tab-btn active" id="tab-browser" onclick="switchTab('browser')" style="padding:10px 20px;border:none;background:none;cursor:pointer;border-bottom:2px solid #2563eb;margin-bottom:-2px;font-weight:600;color:#2563eb;">🌐 浏览器扫码</button>
    <button class="tab-btn" id="tab-apikey" onclick="switchTab('apikey')" style="padding:10px 20px;border:none;background:none;cursor:pointer;color:#6b7280;">🔑 API Key</button>
    <button class="tab-btn" id="tab-manual" onclick="switchTab('manual')" style="padding:10px 20px;border:none;background:none;cursor:pointer;color:#6b7280;">📋 手动复制</button>
  </div>

  <!-- 浏览器扫码 Tab -->
  <div id="panel-browser">
    <p style="color:#6b7280;font-size:14px;margin-bottom:12px;">
      选择平台后，系统会生成一个临时登录链接。您在浏览器中扫码登录后，系统自动获取凭证并存储，后续可自动发布内容。
    </p>
    <div style="display:flex;gap:12px;flex-wrap:wrap;">
      <button class="btn btn-outline" onclick="showBrowserLogin('twitter')">🐦 Twitter (X)</button>
      <button class="btn btn-outline" onclick="showBrowserLogin('facebook')">📘 Facebook</button>
      <button class="btn btn-outline" onclick="showBrowserLogin('linkedin')">💼 LinkedIn</button>
      <button class="btn btn-outline" onclick="showBrowserLogin('instagram')">📷 Instagram</button>
      <button class="btn btn-outline" onclick="showBrowserLogin('tiktok')">🎵 TikTok</button>
      <button class="btn btn-outline" onclick="showBrowserLogin('youtube')">▶️ YouTube</button>
      <button class="btn btn-outline" onclick="showBrowserLogin('xiaohongshu')">📕 小红书</button>
      <button class="btn btn-outline" onclick="showBrowserLogin('weibo')">📢 微博</button>
      <button class="btn btn-outline" onclick="showBrowserLogin('wechat')">💬 微信公众号</button>
      <button class="btn btn-outline" onclick="showBrowserLogin('bilibili')">📺 B站</button>
      <button class="btn btn-outline" onclick="showBrowserLogin('zhihu')">❓ 知乎</button>
      <button class="btn btn-outline" onclick="showBrowserLogin('douyin')">🎶 抖音</button>
    </div>
    <div id="browser-login-area" style="display:none;margin-top:16px;">
      <div style="background:#f9fafb;border-radius:8px;padding:20px;text-align:center;border:1px dashed #d1d5db;">
        <p id="browserLoginHint" style="color:#374151;font-size:14px;margin-bottom:12px;">请在新窗口登录您的账号，完成验证后系统将自动获取凭证。</p>
        <div id="browserLoginQr" style="display:none;margin:16px 0;">
          <p style="font-size:13px;color:#6b7280;">或者扫描二维码</p>
          <div style="width:180px;height:180px;background:#e5e7eb;margin:8px auto;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#9ca3af;font-size:13px;">二维码将在此显示</div>
        </div>
        <button class="btn btn-primary" onclick="startBrowserLogin()">🖥️ 打开登录窗口</button>
        <button class="btn btn-success" onclick="confirmCookieSaved()" style="margin-left:8px;">✅ 已登录，确认保存</button>
      </div>
    </div>
  </div>

  <!-- API Key Tab -->
  <div id="panel-apikey" style="display:none;">
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;margin-bottom:16px;">
      <div class="card" style="cursor:pointer;text-align:center;padding:20px;" onclick="showChannelModal('wordpress')">
        <div style="font-size:36px;margin-bottom:8px;">🌐</div>
        <strong>WordPress</strong>
        <p style="font-size:12px;color:#6b7280;">REST API / 应用密码</p>
      </div>
      <div class="card" style="cursor:pointer;text-align:center;padding:20px;" onclick="showChannelModal('custom_api')">
        <div style="font-size:36px;margin-bottom:8px;">🔌</div>
        <strong>自定义 API</strong>
        <p style="font-size:12px;color:#6b7280;">任意 HTTP 接口</p>
      </div>
    </div>
  </div>

  <!-- 手动复制 Tab -->
  <div id="panel-manual" style="display:none;">
    <div class="card" style="cursor:pointer;text-align:center;padding:20px;" onclick="showChannelModal('manual_copy')">
      <div style="font-size:36px;margin-bottom:8px;">📋</div>
      <strong>手动复制渠道</strong>
      <p style="font-size:12px;color:#6b7280;">无需配置，发布时提供内容模板</p>
    </div>
  </div>
</div>

<!-- 添加 API Key 渠道弹窗 -->
<div class="modal" id="channelModal">
  <div class="modal-content" style="max-width:500px;">
    <span class="close" onclick="closeChModal()">&times;</span>
    <h3 id="channelModalTitle">添加发布渠道</h3>
    <div class="form-group">
      <label>渠道名称</label>
      <input type="text" id="chDisplayName" placeholder="例如：我的博客站">
    </div>
    <div id="chExtraFields">
      <div class="form-group">
        <label>API 地址</label>
        <input type="text" id="chApiUrl" placeholder="https://example.com/wp-json/wp/v2/posts">
      </div>
      <div class="form-group">
        <label>API Key / 应用密码</label>
        <input type="text" id="chApiKey" placeholder="输入 API 令牌或密码">
      </div>
      <div class="form-group">
        <label>API Secret（可选）</label>
        <input type="text" id="chApiSecret" placeholder="输入额外密钥">
      </div>
    </div>
    <button class="btn btn-primary" onclick="createChannel()">确认添加</button>
  </div>
</div>

<script>
let currentChannelType = '';
let browserPlatform = '';

function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.style.color = '#6b7280';
    b.style.borderBottomColor = 'transparent';
    b.style.fontWeight = '400';
  });
  document.getElementById('panel-browser').style.display = 'none';
  document.getElementById('panel-apikey').style.display = 'none';
  document.getElementById('panel-manual').style.display = 'none';

  if (tab === 'browser') {
    const btn = document.getElementById('tab-browser');
    btn.style.color = '#2563eb'; btn.style.borderBottomColor = '#2563eb'; btn.style.fontWeight = '600';
    document.getElementById('panel-browser').style.display = 'block';
  } else if (tab === 'apikey') {
    const btn = document.getElementById('tab-apikey');
    btn.style.color = '#2563eb'; btn.style.borderBottomColor = '#2563eb'; btn.style.fontWeight = '600';
    document.getElementById('panel-apikey').style.display = 'block';
  } else {
    const btn = document.getElementById('tab-manual');
    btn.style.color = '#2563eb'; btn.style.borderBottomColor = '#2563eb'; btn.style.fontWeight = '600';
    document.getElementById('panel-manual').style.display = 'block';
  }
}

function showBrowserLogin(platform) {
  browserPlatform = platform;
  const names = { twitter: 'Twitter (X)', facebook: 'Facebook', linkedin: 'LinkedIn', instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', xiaohongshu: '小红书', weibo: '微博', wechat: '微信公众号', bilibili: 'B站', zhihu: '知乎', douyin: '抖音' };
  document.getElementById('browserLoginHint').textContent = '请在新窗口登录您的 ' + (names[platform] || platform) + ' 账号，完成验证后点击「已登录，确认保存」。';
  document.getElementById('browser-login-area').style.display = 'block';
}

async function startBrowserLogin() {
  const names = { twitter: 'Twitter (X)', facebook: 'Facebook', linkedin: 'LinkedIn', instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', xiaohongshu: '小红书', weibo: '微博', wechat: '微信公众号', bilibili: 'B站', zhihu: '知乎', douyin: '抖音' };
  showToast('正在打开 ' + (names[browserPlatform] || browserPlatform) + ' 登录页面...', 'info');
  // 这里后续对接浏览器模拟登录服务
  // 当前为演示流程：用户手动登录后，调用 confirmCookieSaved
  window.open('https://' + browserPlatform + '.com/login', '_blank');
}

async function confirmCookieSaved() {
  if (!browserPlatform) return showToast('请先选择一个平台', 'error');
  const names = { twitter: 'Twitter (X)', facebook: 'Facebook', linkedin: 'LinkedIn', instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', xiaohongshu: '小红书', weibo: '微博', wechat: '微信公众号', bilibili: 'B站', zhihu: '知乎', douyin: '抖音' };
  const r = await api('/company/social/channel', {
    method: 'POST',
    body: JSON.stringify({
      platform: browserPlatform,
      displayName: names[browserPlatform] || browserPlatform,
      apiKey: 'browser_session',
      apiSecret: '',
      apiBaseUrl: ''
    })
  });
  if (r.success) {
    showToast('✅ ' + (names[browserPlatform] || browserPlatform) + ' 绑定成功！');
    document.getElementById('browser-login-area').style.display = 'none';
    browserPlatform = '';
    loadChannels();
  } else {
    showToast(r.error || '绑定失败', 'error');
  }
}

function showChannelModal(type) {
  currentChannelType = type;
  const names = { wordpress: 'WordPress', custom_api: '自定义 API', manual_copy: '手动复制' };
  document.getElementById('channelModalTitle').textContent = '添加 ' + names[type] + ' 渠道';
  document.getElementById('chExtraFields').style.display = type === 'manual_copy' ? 'none' : 'block';
  document.getElementById('chApiUrl').value = type === 'wordpress' ? 'https://' : '';
  document.getElementById('chApiKey').value = '';
  document.getElementById('chApiSecret').value = '';
  document.getElementById('chDisplayName').value = '';
  document.getElementById('channelModal').classList.add('show');
}
function closeChModal() { document.getElementById('channelModal').classList.remove('show'); }

async function createChannel() {
  const name = document.getElementById('chDisplayName').value;
  if (!name) return showToast('请填写渠道名称', 'error');
  const body = {
    platform: currentChannelType,
    displayName: name,
    apiKey: document.getElementById('chApiKey').value,
    apiSecret: document.getElementById('chApiSecret').value,
    apiBaseUrl: document.getElementById('chApiUrl').value,
  };
  const r = await api('/company/social/channel', { method: 'POST', body: JSON.stringify(body) });
  if (r.success) { showToast('渠道添加成功'); closeChModal(); loadChannels(); }
  else showToast(r.error || '添加失败', 'error');
}

async function loadChannels() {
  const r = await api('/company/social');
  if (!r.success) return;
  const items = r.data;
  const channelIcons = {
    wordpress: '🌐', custom_api: '🔌', manual_copy: '📋',
    twitter: '🐦', facebook: '📘', linkedin: '💼', instagram: '📷', tiktok: '🎵', youtube: '▶️',
    xiaohongshu: '📕', weibo: '📢', wechat: '💬', bilibili: '📺', zhihu: '❓', douyin: '🎶'
  };
  const channelNames = {
    wordpress: 'WordPress', custom_api: '自定义 API', manual_copy: '手动复制',
    twitter: 'Twitter (X)', facebook: 'Facebook', linkedin: 'LinkedIn', instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube',
    xiaohongshu: '小红书', weibo: '微博', wechat: '微信公众号', bilibili: 'B站', zhihu: '知乎', douyin: '抖音'
  };

  document.getElementById('channel-list').innerHTML = items.length
    ? '<table><tr><th>类型</th><th>名称</th><th>方式</th><th>状态</th><th>创建时间</th><th>操作</th></tr>' +
      items.map(i => '<tr><td>' + (channelIcons[i.platform] || '🔗') + '</td><td>' + (i.platform_user_name || '-') + '</td><td>' +
        (channelNames[i.platform] || i.platform) + '</td><td>' + '${statusBadge('' + (i.status === 'active' ? 'active' : 'pending'))}' +
        '</td><td>' + formatDate(i.created_at) + '</td><td><button class="btn btn-danger btn-sm" onclick="unbind(\'' + i.platform + '\')">删除</button></td></tr>').join('') + '</table>'
    : '<div class="empty"><p>暂无发布渠道，请在上方添加</p></div>';
}

async function unbind(platform) {
  if (!confirm('确定删除此发布渠道？')) return;
  const r = await api('/company/social/' + platform, { method: 'DELETE' });
  if (r.success) { showToast('删除成功'); loadChannels(); }
  else showToast(r.error || '删除失败', 'error');
}

loadChannels();
</script>
${navScript('social')}`;

  return pageLayout('社媒 & 发布渠道', NAV, SIDEBAR_LOGO,
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

// ===== 站群发布（WordPress 站点管理） =====
export function companySitesPage(user: any): string {
  const body = `
<div class="card">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
    <h3 style="margin:0">站群站点管理</h3>
    <button class="btn btn-primary btn-sm" onclick="showAddSite()">➕ 添加站点</button>
  </div>
  <p style="color:#6b7280;font-size:14px;margin-bottom:16px;">添加你的 WordPress 站点后，AI 生成的内容可一键发布到这些站点。</p>
  <div id="site-list"><div class="empty"><div class="icon">⏳</div><p>加载中...</p></div></div>
</div>

<div class="card">
  <h3>发布内容</h3>
  <p style="color:#6b7280;font-size:14px;margin-bottom:16px;">选择已完成的 AI 生成内容，发布到选中的站点。</p>
  <div class="search-bar">
    <select id="pubSiteFilter" onchange="loadContentForPublish()"><option value="">选择站点...</option></select>
    <button class="btn btn-success" onclick="batchPublishSelected()" id="batchPubBtn" disabled>📤 发布选中内容</button>
  </div>
  <div id="content-for-publish"><div class="empty"><div class="icon">⏳</div><p>加载完成的内容...</p></div></div>
</div>

<!-- 添加站点 Modal -->
<div class="modal-overlay" id="addSiteModal">
  <div class="modal">
    <h3>添加 WordPress 站点</h3>
    <div class="form-group"><label>站点名称</label><input type="text" id="siteName" placeholder="例如: 我的车灯站"></div>
    <div class="form-group"><label>站点 URL</label><input type="text" id="siteUrl" placeholder="例如: https://bona-official.com"></div>
    <div class="form-row">
      <div class="form-group"><label>WordPress 用户名</label><input type="text" id="siteUser" placeholder="管理员用户名"></div>
      <div class="form-group"><label>应用密码</label><input type="password" id="sitePass" placeholder="在WP后台生成的应用密码"></div>
    </div>
    <p style="color:#6b7280;font-size:12px;margin-bottom:16px;">💡 在 WordPress 后台 → 用户 → 应用密码中生成一个专用密码</p>
    <div class="actions">
      <button class="btn btn-outline" onclick="closeSiteModal()">取消</button>
      <button class="btn btn-primary" onclick="addSite()">添加并测试连接</button>
    </div>
  </div>
</div>

<script>
let sitePage = 1;
async function loadSites() {
  const r = await api('/publish/sites');
  if (!r.success) return;
  const items = r.data || [];
  document.getElementById('site-list').innerHTML = items.length
    ? '<table><tr><th>站点名称</th><th>URL</th><th>类型</th><th>状态</th><th>操作</th></tr>' +
      items.map(i => '<tr><td>' + (i.site_name || '-') + '</td><td><a href="' + i.site_url + '" target="_blank" style="font-size:13px;">' + i.site_url + '</a></td><td>' + (i.site_type || 'wordpress') + '</td><td>' + (i.status === 'active' ? '<span class="badge badge-success">正常</span>' : '<span class="badge badge-danger">异常</span>') + '</td><td>' +
        '<button class="btn btn-sm btn-outline" onclick="testSite(\'' + i.id + '\')">测试</button> ' +
        '<button class="btn btn-sm btn-danger" onclick="deleteSite(\'' + i.id + '\')">删除</button></td></tr>').join('') + '</table>'
    : '<div class="empty"><p>还没有添加站点，点击上方按钮添加</p></div>';
  
  // 填充发布筛选
  const sel = document.getElementById('pubSiteFilter');
  sel.innerHTML = '<option value="">选择站点...</option>' + items.filter(i => i.status === 'active').map(i => '<option value="' + i.id + '">' + i.site_name + '</option>').join('');
}

function showAddSite() { document.getElementById('addSiteModal').classList.add('show'); }
function closeSiteModal() { document.getElementById('addSiteModal').classList.remove('show'); }

async function addSite() {
  const siteName = document.getElementById('siteName').value.trim();
  const siteUrl = document.getElementById('siteUrl').value.trim();
  const wpUsername = document.getElementById('siteUser').value.trim();
  const wpPassword = document.getElementById('sitePass').value.trim();
  if (!siteName || !siteUrl || !wpUsername || !wpPassword) return showToast('请填写完整信息', 'error');
  const btn = event.target; btn.disabled = true; btn.textContent = '⏳ 测试连接中...';
  const r = await api('/publish/sites', { method: 'POST', body: JSON.stringify({ siteName, siteUrl, wpUsername, wpPassword }) });
  if (r.success) { showToast(r.message || '站点添加成功'); closeSiteModal(); loadSites(); }
  else showToast(r.error || '添加失败', 'error');
  btn.disabled = false; btn.textContent = '添加并测试连接';
}

async function testSite(id) {
  const r = await api('/publish/sites/' + id + '/test');
  if (r.success && r.data.ok) showToast('连接正常');
  else showToast('连接失败: ' + (r.data?.error || '未知错误'), 'error');
  loadSites();
}

async function deleteSite(id) {
  if (!confirm('确定删除该站点？')) return;
  const r = await api('/publish/sites/' + id, { method: 'DELETE' });
  if (r.success) { showToast('删除成功'); loadSites(); }
  else showToast(r.error || '删除失败', 'error');
}

let selectedContentForPub = new Set();
async function loadContentForPublish() {
  selectedContentForPub.clear();
  const r = await api('/company/ai/generate?pageSize=100');
  if (!r.success) return;
  const items = (r.data?.items || []).filter(i => i.status === 'completed');
  document.getElementById('content-for-publish').innerHTML = items.length
    ? '<table><tr><th style="width:40px"><input type="checkbox" onchange="toggleAllContent(this)"></th><th>标题/关键词</th><th>完成时间</th></tr>' +
      items.map(i => '<tr><td><input type="checkbox" value="' + i.id + '" onchange="toggleContent(this)"></td><td>' + (i.title || i.keyword) + '</td><td>' + formatDate(i.created_at) + '</td></tr>').join('') + '</table>'
    : '<div class="empty"><p>没有已完成的内容</p></div>';
}

function toggleAllContent(cb) {
  document.querySelectorAll('#content-for-publish input[type=checkbox]').forEach(c => { c.checked = cb.checked; updateContentPub(); });
}

function toggleContent(cb) {
  if (cb.checked) selectedContentForPub.add(cb.value);
  else selectedContentForPub.delete(cb.value);
  updateContentPub();
}

function updateContentPub() {
  const btn = document.getElementById('batchPubBtn');
  const site = document.getElementById('pubSiteFilter').value;
  btn.disabled = selectedContentForPub.size === 0 || !site;
  btn.textContent = selectedContentForPub.size > 0 ? '📤 发布 ' + selectedContentForPub.size + ' 篇内容' : '📤 发布选中内容';
}

async function batchPublishSelected() {
  const siteId = document.getElementById('pubSiteFilter').value;
  if (!siteId) return showToast('请先选择一个站点', 'error');
  if (selectedContentForPub.size === 0) return showToast('请选择内容', 'error');
  const btn = document.getElementById('batchPubBtn');
  btn.disabled = true; btn.textContent = '⏳ 发布中...';
  const r = await api('/publish/now', { method: 'POST', body: JSON.stringify({ contentId: Array.from(selectedContentForPub)[0], siteIds: [siteId] }) });
  if (r.success) { showToast(r.message); loadContentForPublish(); }
  else showToast(r.error || '发布失败', 'error');
  btn.disabled = false; btn.textContent = '📤 发布选中内容';
}

loadSites();
loadContentForPublish();
</script>
${navScript('sites')}`;

  return pageLayout('站群发布', NAV, SIDEBAR_LOGO,
    `<span>${user.company_name || ''}</span><a href="#" onclick="logout()" class="logout">退出</a>`,
    body);
}

// ===== 购买套餐 =====
export function companyPackagesPage(user: any): string {
  const body = `
<div class="card">
  <h3>当前套餐</h3>
  <div style="display:flex;gap:24px;flex-wrap:wrap;">
    <div style="flex:1;min-width:200px;padding:20px;background:#f0f9ff;border-radius:12px;border:1px solid #bae6fd;">
      <p style="color:#0369a1;font-size:13px;margin-bottom:4px;">AI 套餐</p>
      <p style="font-size:24px;font-weight:700;">${user.ai_package_type && user.ai_package_type !== 'none' ? '已开通' : '未开通'}</p>
      <p style="color:#6b7280;font-size:13px;">${user.ai_package_expires_at ? '到期: ' + new Date(user.ai_package_expires_at).toLocaleDateString() : '尚未购买'}</p>
    </div>
    <div style="flex:1;min-width:200px;padding:20px;background:#f0fdf4;border-radius:12px;border:1px solid #bbf7d0;">
      <p style="color:#15803d;font-size:13px;margin-bottom:4px;">会员到期</p>
      <p style="font-size:24px;font-weight:700;">${user.membership_expires_at ? new Date(user.membership_expires_at).toLocaleDateString() : '未开通'}</p>
      <p style="color:#6b7280;font-size:13px;">${user.registration_type === 'agent' ? '由代理商代开' : '自助注册'}</p>
    </div>
  </div>
</div>

<div class="card">
  <h3>AI 模型套餐</h3>
  <p style="color:#6b7280;font-size:14px;margin-bottom:20px;">购买后可无限使用 AI 生成内容功能，按天或按月。</p>
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px;">
    <div style="border:2px solid #e5e7eb;border-radius:12px;padding:32px;text-align:center;transition:all .2s;" onmouseover="this.style.borderColor='#2563eb'" onmouseout="this.style.borderColor='#e5e7eb'">
      <div style="font-size:32px;margin-bottom:12px;">☀️</div>
      <h3 style="font-size:20px;margin-bottom:8px;">AI 日套餐</h3>
      <div style="font-size:36px;font-weight:700;color:#2563eb;margin:16px 0;">¥66</div>
      <p style="color:#6b7280;font-size:14px;margin-bottom:20px;">当天无限次 AI 内容生成<br>适合临时测试需求</p>
      <button class="btn btn-primary" onclick="buyPackage('ai_daily')" style="width:100%;justify-content:center;">立即购买</button>
    </div>
    <div style="border:2px solid #2563eb;border-radius:12px;padding:32px;text-align:center;position:relative;transition:all .2s;">
      <div style="position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:#2563eb;color:#fff;padding:4px 16px;border-radius:20px;font-size:12px;font-weight:600;">推荐</div>
      <div style="font-size:32px;margin-bottom:12px;">🌙</div>
      <h3 style="font-size:20px;margin-bottom:8px;">AI 月套餐</h3>
      <div style="font-size:36px;font-weight:700;color:#2563eb;margin:16px 0;">¥666</div>
      <p style="color:#6b7280;font-size:14px;margin-bottom:20px;">30天无限次 AI 内容生成<br>适合持续运营需求</p>
      <button class="btn btn-success" onclick="buyPackage('ai_monthly')" style="width:100%;justify-content:center;">立即购买</button>
    </div>
  </div>
</div>

<div class="card" id="payment-status" style="display:none;">
  <h3>💰 支付</h3>
  <div id="payment-content"></div>
</div>

<script>
async function buyPackage(packageType) {
  const names = { ai_daily: 'AI 日套餐 ¥66', ai_monthly: 'AI 月套餐 ¥666' };
  const btn = event.target;
  btn.disabled = true; btn.textContent = '⏳ 创建订单...';
  
  const r = await api('/payment/create', {
    method: 'POST',
    body: JSON.stringify({ packageType })
  });
  
  if (r.success) {
    const d = r.data;
    // 显示支付信息
    document.getElementById('payment-status').style.display = 'block';
    document.getElementById('payment-content').innerHTML = 
      '<p>订单号：<strong>' + d.orderNo + '</strong></p>' +
      '<p>金额：<strong>¥' + d.amount + '</strong></p>' +
      '<div style="margin:20px 0;text-align:center;">' +
        (d.qrcode ? '<img src="' + d.qrcode + '" style="width:200px;height:200px;border:1px solid #e5e7eb;border-radius:8px;"><p style="font-size:14px;color:#6b7280;margin-top:8px;">请使用微信/支付宝扫码支付</p>' : '') +
        '<p><a href="' + (d.payUrl || '#') + '" target="_blank" class="btn btn-success" style="justify-content:center;' + (d.qrcode ? 'margin-top:8px;' : '') + '">🔗 去支付</a></p>' +
      '</div>' +
      '<p style="font-size:13px;color:#6b7280;text-align:center;">支付完成后请等待几秒，系统自动生效</p>';
    showToast('订单已创建，请完成支付');
  } else {
    showToast(r.error || '创建订单失败', 'error');
  }
  
  btn.disabled = false; btn.textContent = '立即购买';
}
</script>
${navScript('packages')}`;

  return pageLayout('购买套餐', NAV, SIDEBAR_LOGO,
    `<span>${user.company_name || ''}</span><a href="#" onclick="logout()" class="logout">退出</a>`,
    body);
}

// ===== AI 模型配置 =====
export function companyAiConfigPage(user: any): string {
  const body = `
<div class="card">
  <h3>🤖 AI 模型配置</h3>
  <p style="color:#6b7280;font-size:14px;margin-bottom:16px;">
    配置自定义 AI 模型 API Key。如果使用平台公共套餐则无需配置。
    支持的模型厂商：
  </p>
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;">
    <span class="badge badge-info">DeepSeek</span>
    <span class="badge badge-info">豆包</span>
    <span class="badge badge-info">通义千问</span>
    <span class="badge badge-info">ChatGPT</span>
    <span class="badge badge-info">Agnes</span>
  </div>
</div>

<div class="card">
  <h3>模型列表</h3>
  <div id="model-config-list"><div class="empty"><div class="icon">⏳</div><p>加载中...</p></div></div>
</div>

<div class="card">
  <h3>添加/编辑模型配置</h3>
  <div class="form-group">
    <label>模型厂商</label>
    <select id="mcProvider">
      <option value="agnes">Agnes AI</option>
      <option value="deepseek">DeepSeek</option>
      <option value="doubao">豆包</option>
      <option value="tongyi">通义千问</option>
      <option value="chatgpt">ChatGPT</option>
      <option value="gemini">Gemini</option>
    </select>
  </div>
  <div class="form-group">
    <label>API Key</label>
    <input type="password" id="mcApiKey" placeholder="sk-...">
  </div>
  <div class="form-group">
    <label>模型名称（可选）</label>
    <input type="text" id="mcModelName" placeholder="如 gpt-4o, deepseek-chat">
  </div>
  <div class="form-group">
    <label>API 地址（可选）</label>
    <input type="text" id="mcApiUrl" placeholder="https://api.openai.com/v1">
  </div>
  <button class="btn btn-primary" onclick="saveModelConfig()">保存配置</button>
</div>

<script>
async function loadModelConfigs() {
  const r = await api('/company/ai/config');
  if (!r.success) return;
  const items = r.data;
  const providerNames = { agnes: 'Agnes AI', deepseek: 'DeepSeek', doubao: '豆包', tongyi: '通义千问', chatgpt: 'ChatGPT', gemini: 'Gemini' };
  document.getElementById('model-config-list').innerHTML = items.length
    ? '<table><tr><th>厂商</th><th>模型</th><th>API 地址</th><th>状态</th><th>操作</th></tr>' +
      items.map(i => '<tr><td>' + (providerNames[i.provider] || i.provider) + '</td><td>' + (i.model_name || '-') + '</td><td>' + (i.api_base_url || '默认') + '</td><td>' + '${statusBadge('active')}' + '</td><td><button class="btn btn-danger btn-sm" onclick="deleteModel(\'' + i.provider + '\')">删除</button></td></tr>').join('') + '</table>'
    : '<div class="empty"><p>暂无自定义模型配置，使用平台公共套餐即可</p></div>';
}

async function saveModelConfig() {
  const provider = document.getElementById('mcProvider').value;
  const apiKey = document.getElementById('mcApiKey').value;
  if (!apiKey) return showToast('请填写 API Key', 'error');
  const modelName = document.getElementById('mcModelName').value;
  const apiBaseUrl = document.getElementById('mcApiUrl').value;

  const r = await api('/company/ai/config/' + provider, {
    method: 'PUT',
    body: JSON.stringify({ apiKey, modelName: modelName || undefined, apiBaseUrl: apiBaseUrl || undefined })
  });
  if (r.success) {
    showToast('配置已保存');
    document.getElementById('mcApiKey').value = '';
    document.getElementById('mcModelName').value = '';
    document.getElementById('mcApiUrl').value = '';
    loadModelConfigs();
  } else {
    showToast(r.error || '保存失败', 'error');
  }
}

async function deleteModel(provider) {
  if (!confirm('确定删除 ' + provider + ' 的配置？')) return;
  const r = await api('/company/ai/config/' + provider, { method: 'DELETE' });
  if (r.success) { showToast('已删除'); loadModelConfigs(); }
  else showToast(r.error || '删除失败', 'error');
}

loadModelConfigs();
</script>
${navScript('ai_config')}`;

  return pageLayout('AI 模型配置', NAV, SIDEBAR_LOGO,
    `<span>${user.company_name || ''}</span><a href="#" onclick="logout()" class="logout">退出</a>`,
    body);
}
