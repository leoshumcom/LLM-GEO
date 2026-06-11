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
<div style="font-size:11px;color:#6b7280;padding:8px 20px 4px;text-transform:uppercase;letter-spacing:1px;">🌍 海外社媒</div>
<a href="/company/social?tab=overseas" style="padding-left:36px;font-size:13px;">Twitter / Facebook / LinkedIn / Instagram / TikTok / YouTube / Pinterest / Telegram / Medium / Blogger</a>
<div style="font-size:11px;color:#6b7280;padding:8px 20px 4px;text-transform:uppercase;letter-spacing:1px;">🇨🇳 国内社媒</div>
<a href="/company/social?tab=domestic" style="padding-left:36px;font-size:13px;">小红书 / 微博 / 微信 / B站 / 知乎 / 抖音</a>
<a href="/company/reservations" data-nav="reservations">📋 增值预约</a>
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
  // 计算 AI 套餐倒计时
  const aiExpiry = user.ai_package_expires_at ? new Date(user.ai_package_expires_at) : null;
  const now = new Date();
  const aiDaysLeft = aiExpiry ? Math.max(0, Math.ceil((aiExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))) : 0;
  const hasAi = user.ai_package_type && user.ai_package_type !== 'none';
  const aiProgress = hasAi && aiExpiry ? Math.min(100, (aiDaysLeft / 365) * 100) : 0;

  const body = `
<style>
.dashboard-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); gap:16px; margin-bottom:24px; }
.dash-card { background:#1f2937; border-radius:12px; padding:20px; border:1px solid #374151; }
.dash-card .label { color:#9ca3af; font-size:13px; margin-bottom:4px; }
.dash-card .value { color:#f9fafb; font-size:28px; font-weight:700; }
.dash-card .sub { color:#6b7280; font-size:12px; margin-top:4px; }
.dash-card.accent { border-left:3px solid #2563eb; }
.dash-card.warn { border-left:3px solid #f59e0b; }
.dash-card.success { border-left:3px solid #10b981; }
.chart-container { background:#1f2937; border-radius:12px; padding:20px; border:1px solid #374151; margin-bottom:16px; }
.chart-container h3 { margin:0 0 16px 0; font-size:15px; color:#e5e7eb; display:flex; align-items:center; gap:8px; }
.chart-row { display:flex; gap:12px; align-items:flex-end; min-height:120px; }
.chart-bar-wrapper { flex:1; display:flex; flex-direction:column; align-items:center; }
.chart-bar { width:100%; max-width:48px; border-radius:4px 4px 0 0; min-height:6px; transition:height 0.3s; }
.chart-bar:hover { opacity:0.8; }
.chart-label { font-size:11px; color:#9ca3af; margin-top:6px; }
.chart-count { font-size:13px; font-weight:600; color:#e5e7eb; margin-bottom:4px; }
.progress-bar { height:8px; background:#374151; border-radius:4px; overflow:hidden; margin:8px 0; }
.progress-fill { height:100%; border-radius:4px; transition:width 0.5s; }
.link-entry { display:flex; align-items:center; gap:8px; padding:10px 14px; background:#374151; border-radius:8px; margin-bottom:6px; cursor:pointer; }
.link-entry:hover { background:#4b5563; }
.link-entry .domain { color:#2563eb; font-size:13px; flex:1; }
.link-entry .url { color:#9ca3af; font-size:11px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:200px; }
.action-buttons { display:flex; gap:10px; flex-wrap:wrap; }
.action-btn { display:flex; align-items:center; gap:6px; padding:10px 18px; border-radius:8px; font-size:14px; font-weight:500; cursor:pointer; text-decoration:none; }
.action-btn.primary { background:#2563eb; color:#fff; }
.action-btn.success { background:#10b981; color:#fff; }
.action-btn.outline { background:transparent; border:1px solid #374151; color:#e5e7eb; }
.action-btn:hover { opacity:0.85; }
.empty-chart { display:flex; align-items:center; justify-content:center; min-height:120px; color:#6b7280; font-size:14px; }
</style>

<!-- 统计卡片 -->
<div class="dashboard-grid">
  <div class="dash-card accent">
    <div class="label">🔑 关键词总数</div>
    <div class="value">${stats.totalKeywords || 0}</div>
    <div class="sub">待处理 ${stats.pendingKeywords || 0}</div>
  </div>
  <div class="dash-card success">
    <div class="label">📄 已生成内容</div>
    <div class="value">${stats.generatedContents || 0}</div>
    <div class="sub">已发布 ${stats.publishedCount || 0}</div>
  </div>
  <div class="dash-card">
    <div class="label">🔗 已绑定社媒</div>
    <div class="value">${stats.socialCount || 0}</div>
    <div class="sub">16个平台可配置</div>
  </div>
  <div class="dash-card warn">
    <div class="label">🤖 AI 套餐</div>
    <div class="value">${hasAi ? (aiDaysLeft > 0 ? '⏳ ' + aiDaysLeft + '天' : '⚠️ 已过期') : '❌ 未开通'}</div>
    <div class="sub">${hasAi ? (user.ai_package_expires_at ? '到期 ' + new Date(user.ai_package_expires_at).toLocaleDateString() : '') : (user.membership_expires_at ? '会员至 ' + new Date(user.membership_expires_at).toLocaleDateString() : '')}
    </div>
  </div>
</div>

<div style="display:grid;grid-template-columns:2fr 1fr;gap:16px;">
  <!-- 左侧：发布量趋势 -->
  <div class="chart-container">
    <h3>📊 发布量趋势 <span id="trend-period-toggle" style="cursor:pointer;font-size:12px;color:#6b7280;font-weight:400;">7天▾</span></h3>
    <div id="publish-trend"><div class="empty-chart"><span>⏳ 加载中...</span></div></div>
  </div>

  <!-- 右侧：关键词状态 -->
  <div class="chart-container">
    <h3>🔵 关键词状态</h3>
    <div id="keyword-ring"><div class="empty-chart"><span>⏳ 加载中...</span></div></div>
  </div>
</div>

<!-- 快速操作 -->
<div class="chart-container">
  <h3>⚡ 快速操作</h3>
  <div class="action-buttons">
    <a href="/company/keywords" class="action-btn primary">➕ 添加关键词</a>
    <a href="/company/ai" class="action-btn success">🤖 AI 生成内容</a>
    <a href="/company/social" class="action-btn outline">🔗 绑定社媒</a>
    <a href="/company/ai-config" class="action-btn outline" style="border-color:#f59e0b;">⚙️ 模型配置</a>
    <a href="/company/packages" class="action-btn outline" style="border-color:#10b981;">💳 购买套餐</a>
  </div>
</div>

<!-- AI 套餐倒计时 -->
<div class="chart-container">
  <h3>⏱️ AI 套餐状态</h3>
  ${hasAi && aiDaysLeft > 0 ? `
  <div style="display:flex;align-items:center;gap:16px;">
    <div style="flex:1;">
      <div style="display:flex;justify-content:space-between;font-size:13px;color:#e5e7eb;margin-bottom:4px;">
        <span>${user.ai_package_type === 'daily' ? '日套餐' : '月套餐'}</span>
        <span>剩余 ${aiDaysLeft} 天</span>
      </div>
      <div class="progress-bar"><div class="progress-fill" style="width:${Math.min(100, (aiDaysLeft / 30) * 100)}%;background:${aiDaysLeft > 7 ? '#10b981' : aiDaysLeft > 3 ? '#f59e0b' : '#ef4444'};"></div></div>
    </div>
    <a href="/company/packages" class="action-btn outline" style="flex-shrink:0;padding:8px 16px;font-size:13px;">💳 续费</a>
  </div>
  ` : `
  <p style="color:#9ca3af;font-size:14px;">${hasAi ? 'AI 套餐已过期，请续费或配置自有 Key' : '尚未开通 AI 套餐'}</p>
  <a href="/company/packages" class="action-btn success" style="display:inline-flex;margin-top:8px;">💳 购买套餐</a>
  `}
</div>

<!-- 外链集合 -->
<div class="chart-container">
  <h3>🔗 外链集合 <span style="font-size:12px;color:#6b7280;font-weight:400;">最近10条</span></h3>
  <div id="link-collection"><div class="empty-chart"><span>⏳ 加载中...</span></div></div>
</div>

<!-- 最近生成记录 -->
<div class="chart-container">
  <h3>📝 最近生成记录</h3>
  <div id="recent-contents"><div class="empty-chart"><span>⏳ 加载中...</span></div></div>
</div>

<script>
(function() {
  let trendDays = 7;

  async function loadTrend() {
    const pr = await api('/company/publish?pageSize=200');
    if (!pr.success) return;
    const items = pr.data.items || [];

    // 生成近7/30天的日期序列
    const days = [];
    for (let i = trendDays - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d.toLocaleDateString('zh-CN'));
    }

    // 统计每天发布数
    const trend = {};
    items.forEach(i => {
      if (i.published_at) {
        const key = new Date(i.published_at).toLocaleDateString('zh-CN');
        trend[key] = (trend[key] || 0) + 1;
      }
    });

    const maxCount = Math.max(1, ...days.map(d => trend[d] || 0));
    const container = document.getElementById('publish-trend');

    if (days.length === 0 || maxCount === 0) {
      container.innerHTML = '<div class="empty-chart"><span>暂无发布数据</span></div>';
      return;
    }

    container.innerHTML = '<div class="chart-row">' +
      days.map(d => {
        const count = trend[d] || 0;
        const height = Math.max(6, (count / maxCount) * 100);
        return '<div class="chart-bar-wrapper"><div class="chart-count">' + count + '</div><div class="chart-bar" style="height:' + height + 'px;background:' + (count > 0 ? (count >= maxCount * 0.7 ? '#10b981' : '#2563eb') : '#374151') + ';"></div><div class="chart-label">' + d.slice(5) + '</div></div>';
      }).join('') + '</div>';

    // 切换按钮
    const toggle = document.getElementById('trend-period-toggle');
    if (toggle) {
      toggle.onclick = () => {
        trendDays = trendDays === 7 ? 30 : 7;
        toggle.textContent = trendDays + '天▾';
        loadTrend();
      };
    }
  }

  async function loadKeywordRing() {
    const r = await api('/company/keywords?pageSize=1000');
    if (!r.success) return;
    const items = r.data.items || [];
    const total = items.length;
    const pending = items.filter(i => i.status === 'pending').length;
    const generating = items.filter(i => i.status === 'generating').length;
    const generated = items.filter(i => i.status === 'generated').length;
    const failed = items.filter(i => i.status === 'failed').length;

    const pct = (n) => total ? Math.round((n / total) * 100) : 0;

    document.getElementById('keyword-ring').innerHTML = total > 0
      ? '<div style="margin-bottom:12px;"><div style="display:flex;gap:8px;flex-wrap:wrap;">' +
        '<span style="font-size:13px;color:#f59e0b;">待处理 ' + pending + '（' + pct(pending) + '%）</span>' +
        '<span style="font-size:13px;color:#2563eb;">生成中 ' + generating + '（' + pct(generating) + '%）</span>' +
        '<span style="font-size:13px;color:#10b981;">已完成 ' + generated + '（' + pct(generated) + '%）</span>' +
        '<span style="font-size:13px;color:#ef4444;">失败 ' + failed + '（' + pct(failed) + '%）</span>' +
        '</div></div>' +
        // 迷你进度条组
        '<div class="progress-bar" style="height:12px;"><div class="progress-fill" style="width:' + pct(pending) + '%;background:#f59e0b;float:left;"></div><div class="progress-fill" style="width:' + pct(generating) + '%;background:#2563eb;float:left;"></div><div class="progress-fill" style="width:' + pct(generated) + '%;background:#10b981;float:left;"></div><div class="progress-fill" style="width:' + pct(failed) + '%;background:#ef4444;float:left;"></div></div>' +
        '<p style="color:#6b7280;font-size:13px;margin-top:8px;">关键词总数: ' + total + '</p>'
      : '<div class="empty-chart"><span>暂无关键词，去 <a href="/company/keywords" style="color:#2563eb;">添加</a> 吧</span></div>';
  }

  async function loadLinks() {
    const r = await api('/company/publish?pageSize=10');
    if (!r.success) return;
    const items = r.data.items || [];
    const validLinks = items.filter(i => i.platform_url);

    document.getElementById('link-collection').innerHTML = validLinks.length > 0
      ? validLinks.map(i => '<div class="link-entry" onclick="window.open(\'' + i.platform_url + '\',\'_blank\')"><span class="domain">' + (i.platform || '站群') + '</span><span class="url">' + i.platform_url + '</span><span style="font-size:11px;color:' + (i.status === 'published' ? '#10b981' : '#f59e0b') + ';">' + (i.status === 'published' ? '✅' : '⏳') + '</span></div>').join('')
      : '<div class="empty-chart"><span>暂无外链数据</span></div>';
  }

  async function loadRecent() {
    const r = await api('/company/ai/generate?pageSize=5');
    if (!r.success) return;
    const items = r.data.items || [];
    document.getElementById('recent-contents').innerHTML = items.length > 0
      ? '<table style="width:100%;"><tr><th>标题/关键词</th><th>状态</th><th>时间</th></tr>' +
        items.map(i => '<tr><td>' + (i.title || i.keyword || '-') + '</td><td><span class="badge ' + (i.status === 'completed' ? 'badge-success' : i.status === 'pending' ? 'badge-warning' : i.status === 'failed' ? 'badge-danger' : 'badge-info') + '">' + (i.status === 'completed' ? '✅ 已完成' : i.status === 'pending' ? '⏳ 排队中' : i.status === 'failed' ? '❌ 失败' : '🔄 生成中') + '</span></td><td>' + formatDate(i.created_at) + '</td></tr>').join('') + '</table>'
      : '<div class="empty-chart"><span>📝 还没有生成记录，去 <a href="/company/keywords" style="color:#2563eb;">添加关键词</a> 开始吧</span></div>';
  }

  loadTrend();
  loadKeywordRing();
  loadLinks();
  loadRecent();
})();
</script>
${navScript('dashboard')}`;

  return pageLayout('数据看板', NAV, SIDEBAR_LOGO,
    `<span>${user.company_name || ''}</span>
    <span style="font-size:12px;color:${hasAi && aiDaysLeft > 0 ? '#10b981' : '#ef4444'};">${hasAi && aiDaysLeft > 0 ? '🤖 ' + aiDaysLeft + '天' : '⚠️ 无AI套餐'}</span>
    <a href="#" onclick="logout()" class="logout">退出</a>`,
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
      <button class="btn btn-outline" onclick="showBrowserLogin('pinterest')">📌 Pinterest</button>
      <button class="btn btn-outline" onclick="showBrowserLogin('telegram')">✈️ Telegram</button>
      <button class="btn btn-outline" onclick="showBrowserLogin('medium')">📝 Medium</button>
      <button class="btn btn-outline" onclick="showBrowserLogin('blogger')">📓 Blogger</button>
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
  const names = { twitter: 'Twitter (X)', facebook: 'Facebook', linkedin: 'LinkedIn', instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', xiaohongshu: '小红书', weibo: '微博', wechat: '微信公众号', bilibili: 'B站', zhihu: '知乎', douyin: '抖音', pinterest: 'Pinterest', telegram: 'Telegram', medium: 'Medium', blogger: 'Blogger' };
  document.getElementById('browserLoginHint').textContent = '请在新窗口登录您的 ' + (names[platform] || platform) + ' 账号，完成验证后点击「已登录，确认保存」。';
  document.getElementById('browser-login-area').style.display = 'block';
}

async function startBrowserLogin() {
  const names = { twitter: 'Twitter (X)', facebook: 'Facebook', linkedin: 'LinkedIn', instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', xiaohongshu: '小红书', weibo: '微博', wechat: '微信公众号', bilibili: 'B站', zhihu: '知乎', douyin: '抖音', pinterest: 'Pinterest', telegram: 'Telegram', medium: 'Medium', blogger: 'Blogger' };
  showToast('正在打开 ' + (names[browserPlatform] || browserPlatform) + ' 登录页面...', 'info');
  // 这里后续对接浏览器模拟登录服务
  // 当前为演示流程：用户手动登录后，调用 confirmCookieSaved
  window.open('https://' + browserPlatform + '.com/login', '_blank');
}

async function confirmCookieSaved() {
  if (!browserPlatform) return showToast('请先选择一个平台', 'error');
  const names = { twitter: 'Twitter (X)', facebook: 'Facebook', linkedin: 'LinkedIn', instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', xiaohongshu: '小红书', weibo: '微博', wechat: '微信公众号', bilibili: 'B站', zhihu: '知乎', douyin: '抖音', pinterest: 'Pinterest', telegram: 'Telegram', medium: 'Medium', blogger: 'Blogger' };
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
    xiaohongshu: '📕', weibo: '📢', wechat: '💬', bilibili: '📺', zhihu: '❓', douyin: '🎶',
    pinterest: '📌', telegram: '✈️', medium: '📝', blogger: '📓'
  };
  const channelNames = {
    wordpress: 'WordPress', custom_api: '自定义 API', manual_copy: '手动复制',
    twitter: 'Twitter (X)', facebook: 'Facebook', linkedin: 'LinkedIn', instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube',
    xiaohongshu: '小红书', weibo: '微博', wechat: '微信公众号', bilibili: 'B站', zhihu: '知乎', douyin: '抖音',
    pinterest: 'Pinterest', telegram: 'Telegram', medium: 'Medium', blogger: 'Blogger'
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
// ===== 子账号 & 角色管理 =====
export function companyOperatorsPage(user: any): string {
  const body = `
<div class="card">
  <h3>👥 子账号管理</h3>
  <p style="color:#6b7280;font-size:14px;margin-bottom:16px;">
    为企业成员分配独立登录账号，各自管理自己的内容，互不干扰。
  </p>
  <button class="btn btn-primary" onclick="showAddOperator()" style="margin-bottom:20px;">➕ 新建子账号</button>
  <div id="operator-list"><div class="empty"><div class="icon">⏳</div><p>加载中...</p></div></div>
</div>

<div class="card">
  <h3>🔐 角色说明</h3>
  <table>
    <tr><th>角色</th><th>权限范围</th><th>适用对象</th></tr>
    <tr><td><span class="badge badge-warning">company</span></td><td>全部企业管理权限（购买、配置、发布、子账号管理）</td><td>企业主 / 管理员</td></tr>
    <tr><td><span class="badge badge-info">operator</span></td><td>内容查看、关键词管理、AI 生成、发布操作</td><td>运营人员 / 内容编辑</td></tr>
  </table>
</div>

<!-- 新建/编辑子账号弹窗 -->
<div class="modal" id="operatorModal">
  <div class="modal-content" style="max-width:450px;">
    <span class="close" onclick="closeOpModal()">&times;</span>
    <h3 id="opModalTitle">新建子账号</h3>
    <div class="form-group">
      <label>用户名</label>
      <input type="text" id="opUsername" placeholder="用于登录的用户名" required>
    </div>
    <div class="form-group">
      <label>显示名称</label>
      <input type="text" id="opDisplayName" placeholder="如：小张">
    </div>
    <div class="form-group">
      <label>密码</label>
      <input type="password" id="opPassword" placeholder="至少6位" required>
    </div>
    <div class="form-group">
      <label>角色</label>
      <select id="opRole">
        <option value="operator">👤 运营人员（可管理内容和发布）</option>
      </select>
    </div>
    <button class="btn btn-primary" onclick="saveOperator()">保存</button>
  </div>
</div>

<script>
let editingOpId = '';

function showAddOperator() {
  editingOpId = '';
  document.getElementById('opModalTitle').textContent = '新建子账号';
  document.getElementById('opUsername').value = '';
  document.getElementById('opUsername').disabled = false;
  document.getElementById('opDisplayName').value = '';
  document.getElementById('opPassword').value = '';
  document.getElementById('operatorModal').classList.add('show');
}

function editOperator(op) {
  editingOpId = op.id;
  document.getElementById('opModalTitle').textContent = '编辑子账号';
  document.getElementById('opUsername').value = op.username;
  document.getElementById('opUsername').disabled = true;
  document.getElementById('opDisplayName').value = op.display_name || '';
  document.getElementById('opPassword').value = '';
  document.getElementById('operatorModal').classList.add('show');
}

function closeOpModal() { document.getElementById('operatorModal').classList.remove('show'); }

async function saveOperator() {
  const username = document.getElementById('opUsername').value.trim();
  const displayName = document.getElementById('opDisplayName').value.trim();
  const password = document.getElementById('opPassword').value;

  if (!username) return showToast('请输入用户名', 'error');

  if (editingOpId) {
    const body = {};
    if (displayName) body.displayName = displayName;
    if (password && password.length >= 6) body.password = password;
    if (Object.keys(body).length === 0) return showToast('没有要更新的内容', 'error');
    const r = await api('/company/operators/' + editingOpId, { method: 'PUT', body: JSON.stringify(body) });
    if (r.success) { showToast('子账号已更新'); closeOpModal(); loadOperators(); }
    else showToast(r.error || '更新失败', 'error');
  } else {
    if (!password || password.length < 6) return showToast('密码至少6位', 'error');
    const r = await api('/company/operators', {
      method: 'POST',
      body: JSON.stringify({ username, password, displayName: displayName || username })
    });
    if (r.success) { showToast('子账号创建成功！'); closeOpModal(); loadOperators(); }
    else showToast(r.error || '创建失败', 'error');
  }
}

async function deleteOperator(id, name) {
  if (!confirm('确定删除子账号「' + name + '」？不可恢复。')) return;
  const r = await api('/company/operators/' + id, { method: 'DELETE' });
  if (r.success) { showToast('已删除'); loadOperators(); }
  else showToast(r.error || '删除失败', 'error');
}

async function loadOperators() {
  const r = await api('/company/operators');
  if (!r.success) return;
  const items = r.data || [];
  document.getElementById('operator-list').innerHTML = items.length
    ? '<table><tr><th>用户名</th><th>显示名称</th><th>角色</th><th>创建时间</th><th>操作</th></tr>' +
      items.map(i => '<tr><td><code style="color:#2563eb;">' + i.username + '</code></td><td>' + (i.display_name || '-') + '</td><td><span class="badge badge-info">operator</span></td><td>' + formatDate(i.created_at) + '</td><td>' +
        '<button class="btn btn-sm btn-outline" onclick="editOperator(' + "'" + JSON.stringify(i).replace(/'/g,"\\'") + "'" + ')">✏️</button> ' +
        '<button class="btn btn-sm btn-danger" onclick="deleteOperator(\'' + i.id + '\',\'' + (i.display_name || i.username) + '\')">🗑️</button>' +
        '</td></tr>').join('') + '</table>'
    : '<div class="empty"><p>暂无子账号</p><p style="font-size:13px;color:#6b7280;">点击「新建子账号」为团队分配账号</p></div>';
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
  <h3>📊 当前状态</h3>
  <div style="display:flex;gap:24px;flex-wrap:wrap;">
    <div style="flex:1;min-width:200px;padding:20px;background:#f0f9ff;border-radius:12px;border:1px solid #bae6fd;">
      <p style="color:#0369a1;font-size:13px;margin-bottom:4px;">会员有效期</p>
      <p style="font-size:20px;font-weight:700;">${user.membership_expires_at ? new Date(user.membership_expires_at).toLocaleDateString('zh-CN') : '未开通'}</p>
      <p style="color:#6b7280;font-size:13px;">${user.registration_type === 'agent' ? '由代理商代开' : '自助注册'}</p>
    </div>
    <div style="flex:1;min-width:200px;padding:20px;background:#f0fdf4;border-radius:12px;border:1px solid #bbf7d0;">
      <p style="color:#15803d;font-size:13px;margin-bottom:4px;">AI 套餐状态</p>
      <p style="font-size:20px;font-weight:700;">${user.ai_package_type && user.ai_package_type !== 'none' ? '已开通' : '未开通'}</p>
      <p style="color:#6b7280;font-size:13px;">${user.ai_package_expires_at ? '到期: ' + new Date(user.ai_package_expires_at).toLocaleDateString('zh-CN') : '尚未购买'}</p>
    </div>
  </div>
</div>

<div class="card">
  <h3>🏢 企业版套餐</h3>
  <p style="color:#6b7280;font-size:14px;margin-bottom:20px;">开通或续费企业主版本体，包含全部功能模块。</p>
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px;">
    <div style="border:2px solid #e5e7eb;border-radius:12px;padding:32px;text-align:center;transition:all .2s;" onmouseover="this.style.borderColor='#e5e7eb'" onmouseout="this.style.borderColor='#e5e7eb'">
      <div style="font-size:32px;margin-bottom:12px;">🏪</div>
      <h3 style="font-size:20px;margin-bottom:8px;">企业自助版</h3>
      <div style="font-size:36px;font-weight:700;color:#2563eb;margin:16px 0;">¥1,688</div>
      <p style="color:#6b7280;font-size:13px;margin-bottom:20px;">/年 · 全功能<br>含站群发布、关键词管理、GEO内容生成、多用户</p>
      <button class="btn btn-primary" onclick="buyPackage('enterprise_yearly')" style="width:100%;justify-content:center;">立即续费</button>
    </div>
    <div style="border:2px solid #2563eb;border-radius:12px;padding:32px;text-align:center;position:relative;">
      <div style="position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:#2563eb;color:#fff;padding:4px 16px;border-radius:20px;font-size:12px;font-weight:600;">推荐</div>
      <div style="font-size:32px;margin-bottom:12px;">🚀</div>
      <h3 style="font-size:20px;margin-bottom:8px;">代理商版</h3>
      <div style="font-size:36px;font-weight:700;color:#2563eb;margin:16px 0;">¥8,888</div>
      <p style="color:#6b7280;font-size:13px;margin-bottom:20px;">一次性 · 不限客户数<br>含全部功能 + 子账号管理 + 充值系统</p>
      <p style="color:#9ca3af;font-size:13px;">联系客服开通</p>
    </div>
  </div>
</div>

<div class="card">
  <h3>🤖 AI 模型套餐</h3>
  <p style="color:#6b7280;font-size:14px;margin-bottom:20px;">购买后可无限使用 AI 生成内容功能。AI 套餐与企业版相互独立，可单独续费。</p>
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:20px;">
    <div style="border:2px solid #e5e7eb;border-radius:12px;padding:24px;text-align:center;transition:all .2s;" onmouseover="this.style.borderColor='#2563eb'" onmouseout="this.style.borderColor='#e5e7eb'">
      <div style="font-size:28px;margin-bottom:8px;">☀️</div>
      <h3 style="font-size:18px;margin-bottom:8px;">日套餐</h3>
      <div style="font-size:32px;font-weight:700;color:#2563eb;margin:12px 0;">¥66</div>
      <p style="color:#6b7280;font-size:13px;margin-bottom:16px;">当天无限次<br>适合临时测试</p>
      <button class="btn btn-primary btn-sm" onclick="buyAiPackage('ai_daily')" style="width:100%;justify-content:center;">购买</button>
    </div>
    <div style="border:2px solid #2563eb;border-radius:12px;padding:24px;text-align:center;position:relative;">
      <div style="position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:#2563eb;color:#fff;padding:4px 16px;border-radius:20px;font-size:12px;font-weight:600;">推荐</div>
      <div style="font-size:28px;margin-bottom:8px;">🌙</div>
      <h3 style="font-size:18px;margin-bottom:8px;">月套餐</h3>
      <div style="font-size:32px;font-weight:700;color:#2563eb;margin:12px 0;">¥666</div>
      <p style="color:#6b7280;font-size:13px;margin-bottom:16px;">30天无限使用<br>适合持续运营</p>
      <button class="btn btn-success btn-sm" onclick="buyAiPackage('ai_monthly')" style="width:100%;justify-content:center;">购买</button>
    </div>
    <div style="border:2px solid #e5e7eb;border-radius:12px;padding:24px;text-align:center;" onmouseover="this.style.borderColor='#2563eb'" onmouseout="this.style.borderColor='#e5e7eb'">
      <div style="font-size:28px;margin-bottom:8px;">🌸</div>
      <h3 style="font-size:18px;margin-bottom:8px;">季套餐</h3>
      <div style="font-size:32px;font-weight:700;color:#2563eb;margin:12px 0;">¥1,688</div>
      <p style="color:#6b7280;font-size:13px;margin-bottom:16px;">90天无限使用<br>最省心方案</p>
      <button class="btn btn-primary btn-sm" onclick="buyAiPackage('ai_quarterly')" style="width:100%;justify-content:center;">购买</button>
    </div>
    <div style="border:2px solid #e5e7eb;border-radius:12px;padding:24px;text-align:center;" onmouseover="this.style.borderColor='#2563eb'" onmouseout="this.style.borderColor='#e5e7eb'">
      <div style="font-size:28px;margin-bottom:8px;">🎆</div>
      <h3 style="font-size:18px;margin-bottom:8px;">年套餐</h3>
      <div style="font-size:32px;font-weight:700;color:#2563eb;margin:12px 0;">¥5,888</div>
      <p style="color:#6b7280;font-size:13px;margin-bottom:16px;">365天无限使用<br>企业级生产力</p>
      <button class="btn btn-primary btn-sm" onclick="buyAiPackage('ai_yearly')" style="width:100%;justify-content:center;">购买</button>
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
async function buyPackage(packageType) {
  const names = { enterprise_yearly: '企业版年费 ¥1,688' };
  const btn = event.target;
  btn.disabled = true; btn.textContent = '⏳ 创建订单...';
  const r = await api('/payment/create', {
    method: 'POST',
    body: JSON.stringify({ packageType })
  });
  if (r.success) showPayment(r, names[packageType]);
  else showToast(r.error || '创建失败', 'error');
  btn.disabled = false; btn.textContent = '立即续费';
}

async function buyAiPackage(packageType) {
  const names = { ai_daily: 'AI 日套餐 ¥66', ai_monthly: 'AI 月套餐 ¥666', ai_quarterly: 'AI 季套餐 ¥1,688', ai_yearly: 'AI 年套餐 ¥5,888' };
  const btn = event.target;
  btn.disabled = true; btn.textContent = '⏳ 创建订单...';
  const r = await api('/payment/create', {
    method: 'POST',
    body: JSON.stringify({ packageType })
  });
  if (r.success) showPayment(r, names[packageType]);
  else showToast(r.error || '创建失败', 'error');
  btn.disabled = false; btn.textContent = '购买';
}

function showPayment(r, name) {
  const d = r.data;
  document.getElementById('payment-status').style.display = 'block';
  document.getElementById('payment-content').innerHTML =
    '<p>📦 <strong>' + name + '</strong></p>' +
    '<p>订单号：<strong>' + d.orderNo + '</strong></p>' +
    '<p>金额：<strong class="text-primary">¥' + d.amount + '</strong></p>' +
    '<div style="margin:20px 0;text-align:center;">' +
      (d.qrcode ? '<img src="' + d.qrcode + '" style="width:200px;height:200px;border:1px solid #e5e7eb;border-radius:8px;"><p style="font-size:14px;color:#6b7280;margin-top:8px;">请使用微信/支付宝扫码支付</p>' : '') +
      '<p><a href="' + (d.payUrl || '#') + '" target="_blank" class="btn btn-success" style="justify-content:center;' + (d.qrcode ? 'margin-top:8px;' : '') + '">🔗 去支付</a></p>' +
    '</div>' +
    '<p style="font-size:13px;color:#6b7280;text-align:center;">支付完成后请等待几秒，系统自动生效</p>';
  showToast('订单已创建，请完成支付');
}

async function loadOrders() {
  const r = await api('/payment/orders');
  if (!r.success) return;
  const items = r.data?.items || [];
  const statusBadges = { pending: '<span class="badge badge-warning">待支付</span>', paid: '<span class="badge badge-success">已支付</span>', failed: '<span class="badge badge-danger">失败</span>', refunded: '<span class="badge">已退款</span>' };
  const typeNames = { ai_daily: 'AI日套餐', ai_monthly: 'AI月套餐', ai_quarterly: 'AI季套餐', ai_yearly: 'AI年套餐', enterprise_yearly: '企业版年费' };
  document.getElementById('order-history').innerHTML = items.length
    ? '<table><tr><th>订单号</th><th>类型</th><th>金额</th><th>状态</th><th>时间</th></tr>' +
      items.map(i => '<tr><td style="font-size:12px;">' + i.order_no + '</td><td>' + (typeNames[i.order_type] || i.order_type) + '</td><td>¥' + (i.amount / 100).toFixed(2) + '</td><td>' + (statusBadges[i.payment_status] || i.payment_status) + '</td><td>' + formatDate(i.created_at) + '</td></tr>').join('') + '</table>'
    : '<div class="empty"><p>暂无订单记录</p></div>';
}

loadOrders();
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
    配置自定义 AI 模型 API Key 后，系统将优先使用您的 Key 进行内容生成。
    如果未配置自有 Key，平台将使用您的 AI 套餐（加油包）。
    支持的模型厂商：
  </p>
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;">
    <span class="badge badge-info">DeepSeek</span>
    <span class="badge badge-info">豆包</span>
    <span class="badge badge-info">通义千问</span>
    <span class="badge badge-info">ChatGPT</span>
    <span class="badge badge-info">Gemini</span>
    <span class="badge badge-info">元宝</span>
    <span class="badge badge-info">Grok</span>
    <span class="badge badge-info">Agnes</span>
  </div>
  <div style="background:#1e3a5f;border-radius:8px;padding:12px 16px;border:1px solid #2563eb;">
    <p style="color:#93c5fd;font-size:13px;margin:0;">
      💡 配置自己的 API Key 后，AI 生成时会优先使用您的 Key，不消耗平台加油包额度。
      如您不配置 Key，系统将自动使用您的 AI 套餐（如有）。
    </p>
  </div>
</div>

<div class="card">
  <h3>已配置的模型列表</h3>
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
      <option value="yuanbao">元宝</option>
      <option value="grok">Grok</option>
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
  const providerNames = { agnes: 'Agnes AI', deepseek: 'DeepSeek', doubao: '豆包', tongyi: '通义千问', chatgpt: 'ChatGPT', gemini: 'Gemini', yuanbao: '元宝', grok: 'Grok' };
  document.getElementById('model-config-list').innerHTML = items.length
    ? '<table><tr><th>厂商</th><th>模型</th><th>API 地址</th><th>状态</th><th>操作</th></tr>' +
      items.map(i => '<tr><td>' + (providerNames[i.provider] || i.provider) + '</td><td>' + (i.model_name || '-') + '</td><td>' + (i.api_base_url || '默认') + '</td><td>' + '${statusBadge('active')}' + '</td><td><button class="btn btn-danger btn-sm" onclick="deleteModel(\'' + i.provider + '\')">删除</button></td></tr>').join('') + '</table>'
    : '<div class="empty"><p>暂无自定义模型配置，添加后将优先使用您的 Key</p></div>';
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

// ===== 增值预约 =====
const SERVICE_TYPES: Record<string, string> = {
  '1': '① 关键词研究 & 拓展 — 深度挖掘高价值长尾关键词',
  '2': '② 竞争对手 GEO 分析 — 解剖竞品排名策略和内容结构',
  '3': '③ AI 内容策略定制 — 量身打造 SEO 友好的内容矩阵',
  '4': '④ 多媒体内容制作 — 图片/视频/Infographic 一条龙',
  '5': '⑤ 站群架构规划 — 多站点矩阵搭建与权重传递策略',
  '6': '⑥ 外链建设服务 — 高质量 backlink 获取方案',
  '7': '⑦ 数据报告 & 优化建议 — 定期排名追踪与策略调整',
  '8': '⑧ 专属客户经理 — 一对一管家式服务',
};

export function companyReservationsPage(user: any): string {
  const serviceOptions = Object.entries(SERVICE_TYPES)
    .map(([k, v]) => `<option value="${k}">${v}</option>`).join('');

  const body = `
<div class="card">
  <h3>📋 增值服务预约</h3>
  <p style="color:#6b7280;font-size:14px;margin-bottom:16px;">需要更深入的服务？提交预约并支付 ¥6.00，完成后我们将与您联系。</p>
  <form onsubmit="submitReservation(event)" style="max-width:500px;">
    <div class="form-group">
      <label>服务类型</label>
      <select id="svcType" required>${serviceOptions}</select>
    </div>
    <div class="form-group">
      <label>联系人姓名</label>
      <input type="text" id="svcName" required placeholder="您的姓名">
    </div>
    <div class="form-group">
      <label>联系方式</label>
      <input type="text" id="svcContact" required placeholder="手机号 / 邮箱 / 微信号">
    </div>
    <div class="form-group">
      <label>需求描述（可选）</label>
      <textarea id="svcRequirement" rows="3" placeholder="详细描述您的需求..."></textarea>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      <div class="form-group">
        <label>使用人数</label>
        <select id="svcPeople">
          <option value="1人">1人</option>
          <option value="2-5人">2-5人</option>
          <option value="5-10人">5-10人</option>
          <option value="10人以上">10人以上</option>
        </select>
      </div>
      <div class="form-group">
        <label>期望联系时间</label>
        <input type="text" id="svcTime" placeholder="如：工作日上午">
      </div>
    </div>
    <button type="submit" class="btn btn-primary">提交预约并支付 ¥6</button>
  </form>
</div>

<div class="card">
  <h3>我的预约记录</h3>
  <div id="reservation-history"><div class="empty"><div class="icon">⏳</div><p>加载中...</p></div></div>
</div>

<!-- 支付弹窗 -->
<div class="modal-overlay" id="payResModal">
  <div class="modal" style="max-width:420px;">
    <h3>💰 支付预约费 ¥6.00</h3>
    <div id="payResContent" style="text-align:center;padding:16px 0;">
      <p style="color:#6b7280;font-size:14px;margin-bottom:16px;">扫码支付 ¥6.00</p>
      <div id="payResQrcode"></div>
      <div id="payResUrl" style="margin-top:12px;"></div>
    </div>
    <div class="actions">
      <button class="btn btn-success" onclick="checkResPayment()">我已支付，验证</button>
      <button class="btn btn-outline" onclick="closePayResModal()">关闭</button>
    </div>
  </div>
</div>

<script>
let currentResOrderNo = '';
let currentResPaymentCheckCount = 0;

async function submitReservation(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button');
  btn.disabled = true; btn.textContent = '⏳ 提交中...';
  const r = await api('/company/reservations', {
    method: 'POST',
    body: JSON.stringify({
      serviceType: document.getElementById('svcType').value,
      applicantName: document.getElementById('svcName').value,
      contact: document.getElementById('svcContact').value,
      requirement: document.getElementById('svcRequirement').value,
      peopleCount: document.getElementById('svcPeople').value,
      expectedTime: document.getElementById('svcTime').value,
    })
  });
  if (r.success) {
    if (r.data?.payUrl) {
      // 显示支付弹窗
      currentResOrderNo = r.data.orderNo;
      document.getElementById('payResQrcode').innerHTML = r.data.qrcode
        ? '<img src="' + r.data.qrcode + '" style="width:180px;height:180px;border:1px solid #e5e7eb;border-radius:8px;">'
        : '';
      document.getElementById('payResUrl').innerHTML = '<a href="' + r.data.payUrl + '" target="_blank" class="btn btn-success" style="justify-content:center;">🔗 去支付</a>';
      document.getElementById('payResModal').classList.add('show');
      showToast('预约已提交，请完成 ¥6 支付');
    } else {
      showToast('预约已提交，我们会尽快联系您！');
    }
    e.target.reset();
    loadReservations();
  } else {
    showToast(r.error || '提交失败', 'error');
  }
  btn.disabled = false; btn.textContent = '提交预约并支付 ¥6';
}

function closePayResModal() {
  document.getElementById('payResModal').classList.remove('show');
  currentResOrderNo = '';
  currentResPaymentCheckCount = 0;
}

async function checkResPayment() {
  if (!currentResOrderNo) return showToast('未找到订单', 'error');
  currentResPaymentCheckCount++;
  const r = await api('/payment/status/' + currentResOrderNo);
  if (r.success && r.data?.payment_status === 'paid') {
    showToast('✅ 支付成功！我们会尽快联系您！');
    closePayResModal();
    loadReservations();
  } else {
    if (currentResPaymentCheckCount < 5) {
      showToast('支付尚未确认，请稍后再试 (尝试 ' + currentResPaymentCheckCount + '/5)', 'info');
    } else {
      showToast('支付确认失败，请联系客服', 'error');
      closePayResModal();
    }
  }
}

const SERVICE_TYPE_NAMES = {
  '1': '关键词研究与拓展', '2': '竞争对手GEO分析', '3': 'AI内容策略定制',
  '4': '多媒体内容制作', '5': '站群架构规划', '6': '外链建设服务',
  '7': '数据报告与优化建议', '8': '专属客户经理'
};

async function loadReservations() {
  const r = await api('/company/reservations');
  if (!r.success) return;
  const items = r.data?.items || [];
  const statusBadges = { pending: '<span class="badge badge-warning">待处理</span>', contacted: '<span class="badge badge-info">已联系</span>', completed: '<span class="badge badge-success">已完成</span>', cancelled: '<span class="badge badge-danger">已取消</span>' };
  document.getElementById('reservation-history').innerHTML = items.length
    ? '<table><tr><th>服务类型</th><th>联系人</th><th>状态</th><th>支付</th><th>提交时间</th><th>操作</th></tr>' +
      items.map(i => '<tr><td>' + (SERVICE_TYPE_NAMES[i.service_type] || '类型' + i.service_type) + '</td><td>' + i.applicant_name + '</td><td>' + (statusBadges[i.status] || i.status) + '</td><td>' + (i.payment_status === 'paid' ? '<span class="badge badge-success">已支付</span>' : '<span class="badge badge-warning">待支付</span>') + '</td><td>' + formatDate(i.created_at) + '</td><td>' +
        (i.status === 'pending' ? '<button class="btn btn-danger btn-sm" onclick="cancelRes(\'' + i.id + '\')">取消</button>' : '-') + '</td></tr>').join('') + '</table>'
    : '<div class="empty"><p>暂无预约记录，请在上方提交</p></div>';
}

async function cancelRes(id) {
  if (!confirm('确定取消此预约？')) return;
  const r = await api('/company/reservations/' + id, { method: 'DELETE' });
  if (r.success) { showToast('已取消'); loadReservations(); }
  else showToast(r.error || '取消失败', 'error');
}

loadReservations();
</script>
${navScript('reservations')}`;

  return pageLayout('增值预约', NAV, SIDEBAR_LOGO,
    `<span>${user.company_name || ''}</span><a href="#" onclick="logout()" class="logout">退出</a>`,
    body);
}
