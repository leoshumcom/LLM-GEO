/**
 * 管理后台共用 HTML 构建工具
 * 
 * 使用纯 Hono JSX / html 渲染，无前端框架。
 * 所有页面通过 Worker 服务端渲染。
 */

/**
 * 全局 CSS 样式（管理后台共用）
 */
export const ADMIN_CSS = `
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f3f4f6; color: #1f2937; }

/* Layout */
.app { display: flex; min-height: 100vh; }
.sidebar { width: 260px; background: #1e293b; color: #e2e8f0; padding: 24px 0; flex-shrink: 0; position: sticky; top: 0; height: 100vh; overflow-y: auto; }
.sidebar .logo { padding: 0 20px 24px; border-bottom: 1px solid #334155; margin-bottom: 16px; }
.sidebar .logo h1 { font-size: 20px; color: #fff; }
.sidebar .logo p { font-size: 12px; color: #94a3b8; margin-top: 4px; }
.sidebar nav a { display: flex; align-items: center; gap: 10px; padding: 10px 20px; color: #94a3b8; text-decoration: none; font-size: 14px; transition: all .2s; }
.sidebar nav a:hover, .sidebar nav a.active { background: #334155; color: #fff; }
.sidebar nav a .badge { margin-left: auto; background: #3b82f6; color: #fff; font-size: 11px; padding: 2px 8px; border-radius: 10px; }

.main { flex: 1; }
.header { background: #fff; border-bottom: 1px solid #e5e7eb; padding: 16px 32px; display: flex; justify-content: space-between; align-items: center; }
.header h2 { font-size: 20px; font-weight: 600; }
.header .user { display: flex; align-items: center; gap: 12px; font-size: 14px; color: #6b7280; }
.header .logout { color: #ef4444; text-decoration: none; font-size: 13px; }

.content { padding: 24px 32px; }

/* Cards */
.card { background: #fff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,.08); padding: 24px; margin-bottom: 20px; }
.card h3 { font-size: 16px; font-weight: 600; margin-bottom: 16px; }

/* Stats Grid */
.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }
.stat { background: #fff; border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
.stat .label { font-size: 13px; color: #6b7280; margin-bottom: 4px; }
.stat .value { font-size: 28px; font-weight: 700; color: #1f2937; }
.stat .sub { font-size: 12px; color: #9ca3af; margin-top: 4px; }

/* Tables */
table { width: 100%; border-collapse: collapse; font-size: 14px; }
th { text-align: left; padding: 10px 12px; background: #f9fafb; color: #6b7280; font-weight: 500; border-bottom: 2px solid #e5e7eb; }
td { padding: 10px 12px; border-bottom: 1px solid #f3f4f6; }
tr:hover td { background: #f9fafb; }

/* Buttons */
.btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 8px; font-size: 14px; font-weight: 500; border: none; cursor: pointer; text-decoration: none; transition: all .2s; }
.btn-primary { background: #2563eb; color: #fff; }
.btn-primary:hover { background: #1d4ed8; }
.btn-success { background: #16a34a; color: #fff; }
.btn-success:hover { background: #15803d; }
.btn-danger { background: #dc2626; color: #fff; }
.btn-danger:hover { background: #b91c1c; }
.btn-sm { padding: 5px 10px; font-size: 12px; }
.btn-outline { background: transparent; border: 1px solid #d1d5db; color: #374151; }
.btn-outline:hover { background: #f3f4f6; }

/* Forms */
.form-group { margin-bottom: 16px; }
.form-group label { display: block; font-size: 14px; font-weight: 500; margin-bottom: 6px; color: #374151; }
.form-group input, .form-group select, .form-group textarea { width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; outline: none; transition: border .2s; }
.form-group input:focus, .form-group select:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,.1); }

.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

/* Pagination */
.pagination { display: flex; justify-content: center; gap: 8px; margin-top: 20px; }
.pagination a { padding: 6px 12px; border: 1px solid #d1d5db; border-radius: 6px; text-decoration: none; color: #374151; font-size: 13px; }
.pagination a.active { background: #2563eb; color: #fff; border-color: #2563eb; }

/* Badges */
.badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 12px; font-weight: 500; }
.badge-success { background: #dcfce7; color: #16a34a; }
.badge-warning { background: #fef3c7; color: #d97706; }
.badge-danger { background: #fee2e2; color: #dc2626; }
.badge-info { background: #dbeafe; color: #2563eb; }

/* Empty state */
.empty { text-align: center; padding: 60px 20px; color: #9ca3af; }
.empty .icon { font-size: 48px; margin-bottom: 16px; }
.empty p { font-size: 15px; }

/* Modal (simple overlay) */
.modal-overlay { display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,.4); z-index: 1000; align-items: center; justify-content: center; }
.modal-overlay.show { display: flex; }
.modal { background: #fff; border-radius: 12px; padding: 24px; max-width: 500px; width: 90%; max-height: 80vh; overflow-y: auto; }
.modal h3 { font-size: 18px; margin-bottom: 16px; }
.modal .actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 20px; }

/* Messages */
.toast { position: fixed; top: 20px; right: 20px; z-index: 9999; padding: 12px 20px; border-radius: 8px; font-size: 14px; display: none; }
.toast.show { display: block; animation: slideIn .3s ease; }
.toast.success { background: #16a34a; color: #fff; }
.toast.error { background: #dc2626; color: #fff; }
@keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }

/* Tabs */
.tabs { display: flex; gap: 0; border-bottom: 2px solid #e5e7eb; margin-bottom: 24px; }
.tabs a { padding: 10px 20px; font-size: 14px; font-weight: 500; color: #6b7280; text-decoration: none; border-bottom: 2px solid transparent; margin-bottom: -2px; transition: all .2s; }
.tabs a.active, .tabs a:hover { color: #2563eb; border-bottom-color: #2563eb; }

/* Search bar */
.search-bar { display: flex; gap: 12px; margin-bottom: 20px; align-items: center; }
.search-bar input { flex: 1; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; }
.search-bar select { padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; }

/* Content preview */
.content-preview { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-top: 12px; white-space: pre-wrap; font-size: 14px; line-height: 1.6; max-height: 400px; overflow-y: auto; }

/* Responsive */
@media (max-width: 768px) {
  .sidebar { display: none; }
  .content { padding: 16px; }
  .form-row { grid-template-columns: 1fr; }
  .stats { grid-template-columns: 1fr 1fr; }
}
`;

/**
 * 共用页面 HTML 模板
 */
export function pageLayout(
  title: string,
  sidebarNav: string,
  sidebarLogo: string,
  headerRight: string,
  body: string
): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} - LLMGEO</title>
  <style>${ADMIN_CSS}</style>
</head>
<body>
  <div class="app">
    <aside class="sidebar">
      <div class="logo">
        ${sidebarLogo}
      </div>
      <nav>${sidebarNav}</nav>
    </aside>
    <div class="main">
      <div class="header">
        <h2>${title}</h2>
        <div class="user">${headerRight}</div>
      </div>
      <div class="content">
        ${body}
      </div>
    </div>
  </div>
  <div id="toast" class="toast"></div>
  <script>
  async function api(path, opts={}) {
    const token = localStorage.getItem('token');
    opts.headers = { ...opts.headers, 'Content-Type': 'application/json' };
    if (token) opts.headers.Authorization = 'Bearer ' + token;
    const res = await fetch('/api' + path, opts);
    return res.json();
  }
  function showToast(msg, type='success') {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'toast ' + type + ' show';
    setTimeout(() => t.className = 'toast', 3000);
  }
  function logout() { localStorage.removeItem('token'); window.location.href = '/'; }
  function formatDate(d) {
    if (!d) return '-';
    try { return new Date(d).toLocaleDateString('zh-CN', {year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}); }
    catch { return d; }
  }
  </script>
</body>
</html>`;
}

/**
 * 空状态占位
 */
export function emptyState(icon: string, text: string): string {
  return `<div class="empty"><div class="icon">${icon}</div><p>${text}</p></div>`;
}

/**
 * 状态徽章
 */
export function statusBadge(status: string): string {
  const map: Record<string, string> = {
    active: 'badge-success',
    pending: 'badge-warning',
    generating: 'badge-info',
    generated: 'badge-success',
    completed: 'badge-success',
    failed: 'badge-danger',
    paid: 'badge-success',
    published: 'badge-success',
    contacted: 'badge-info',
    cancelled: 'badge-danger',
    frozen: 'badge-danger',
  };
  const cls = map[status] || 'badge-info';
  return `<span class="badge ${cls}">${status}</span>`;
}

/**
 * 分页器
 */
export function pagination(current: number, totalPages: number, baseUrl: string): string {
  if (totalPages <= 1) return '';
  let html = '<div class="pagination">';
  for (let i = Math.max(1, current - 2); i <= Math.min(totalPages, current + 2); i++) {
    html += `<a href="${baseUrl}&page=${i}" class="${i === current ? 'active' : ''}">${i}</a>`;
  }
  html += '</div>';
  return html;
}
