/**
 * 管理后台页面路由
 * 
 * 企业端：/company/*
 * 代理商端：/agent/*
 * 管理员端：/admin/*
 */

import { Hono } from 'hono';
import type { Env, JwtPayload } from '../types';
import { authMiddleware, requireRole } from '../middleware/auth';
import {
  companyDashboardPage,
  companyKeywordsPage,
  companyAiPage,
  companyPublishPage,
  companyProfilePage,
  companySocialPage,
  companyOperatorsPage,
  companyMediaPage,
} from './company/index';

export const pagesRouter = new Hono<{ Bindings: Env }>();

// ========== 企业端 ==========
pagesRouter.get('/company/dashboard', authMiddleware, requireRole('company', 'operator'), async (c) => {
  const user = c.get('user') as JwtPayload;
  const company = await getUserData(c.env.DB, user);
  const stats = await getCompanyStats(c.env.DB, user.tenantId!);
  return c.html(companyDashboardPage(company, stats));
});

pagesRouter.get('/company/keywords', authMiddleware, requireRole('company', 'operator'), async (c) => {
  const user = c.get('user') as JwtPayload;
  const company = await getUserData(c.env.DB, user);
  return c.html(companyKeywordsPage(company));
});

pagesRouter.get('/company/ai', authMiddleware, requireRole('company', 'operator'), async (c) => {
  const user = c.get('user') as JwtPayload;
  const company = await getUserData(c.env.DB, user);
  return c.html(companyAiPage(company));
});

pagesRouter.get('/company/publish', authMiddleware, requireRole('company', 'operator'), async (c) => {
  const user = c.get('user') as JwtPayload;
  const company = await getUserData(c.env.DB, user);
  return c.html(companyPublishPage(company));
});

pagesRouter.get('/company/profile', authMiddleware, requireRole('company', 'operator'), async (c) => {
  const user = c.get('user') as JwtPayload;
  const company = await getUserData(c.env.DB, user);
  return c.html(companyProfilePage(company));
});

pagesRouter.get('/company/social', authMiddleware, requireRole('company', 'operator'), async (c) => {
  const user = c.get('user') as JwtPayload;
  const company = await getUserData(c.env.DB, user);
  return c.html(companySocialPage(company));
});

pagesRouter.get('/company/operators', authMiddleware, requireRole('company'), async (c) => {
  const user = c.get('user') as JwtPayload;
  const company = await getUserData(c.env.DB, user);
  return c.html(companyOperatorsPage(company));
});

pagesRouter.get('/company/media', authMiddleware, requireRole('company', 'operator'), async (c) => {
  const user = c.get('user') as JwtPayload;
  const company = await getUserData(c.env.DB, user);
  return c.html(companyMediaPage(company));
});

// ========== 代理商端 ==========
pagesRouter.get('/agent/dashboard', authMiddleware, requireRole('agent'), async (c) => {
  const user = c.get('user') as JwtPayload;
  const agent = await getAgentData(c.env.DB, user);
  return c.html(agentDashboardPage(agent));
});

pagesRouter.get('/agent/companies', authMiddleware, requireRole('agent'), async (c) => {
  const user = c.get('user') as JwtPayload;
  const agent = await getAgentData(c.env.DB, user);
  return c.html(agentCompaniesPage(agent));
});

pagesRouter.get('/agent/balance', authMiddleware, requireRole('agent'), async (c) => {
  const user = c.get('user') as JwtPayload;
  const agent = await getAgentData(c.env.DB, user);
  return c.html(agentBalancePage(agent));
});

pagesRouter.get('/agent/orders', authMiddleware, requireRole('agent'), async (c) => {
  const user = c.get('user') as JwtPayload;
  const agent = await getAgentData(c.env.DB, user);
  return c.html(agentOrdersPage(agent));
});

pagesRouter.get('/agent/profile', authMiddleware, requireRole('agent'), async (c) => {
  const user = c.get('user') as JwtPayload;
  const agent = await getAgentData(c.env.DB, user);
  return c.html(agentProfilePage(agent));
});

// ========== 管理员端 ==========
pagesRouter.get('/admin/dashboard', authMiddleware, requireRole('admin'), async (c) => {
  const user = c.get('user') as JwtPayload;
  return c.html(adminDashboardPage());
});

pagesRouter.get('/admin/companies', authMiddleware, requireRole('admin'), async (c) => {
  const user = c.get('user') as JwtPayload;
  return c.html(adminCompaniesPage());
});

pagesRouter.get('/admin/agents', authMiddleware, requireRole('admin'), async (c) => {
  const user = c.get('user') as JwtPayload;
  return c.html(adminAgentsPage());
});

pagesRouter.get('/admin/finance', authMiddleware, requireRole('admin'), async (c) => {
  const user = c.get('user') as JwtPayload;
  return c.html(adminFinancePage());
});

pagesRouter.get('/admin/reservations', authMiddleware, requireRole('admin'), async (c) => {
  const user = c.get('user') as JwtPayload;
  return c.html(adminReservationsPage());
});

pagesRouter.get('/admin/config', authMiddleware, requireRole('admin'), async (c) => {
  const user = c.get('user') as JwtPayload;
  return c.html(adminConfigPage());
});

pagesRouter.get('/admin/logs', authMiddleware, requireRole('admin'), async (c) => {
  const user = c.get('user') as JwtPayload;
  return c.html(adminLogsPage());
});

// ========== Helper Functions ==========
async function getUserData(db: D1Database, user: JwtPayload): Promise<any> {
  if (user.role === 'company' || user.role === 'operator') {
    return db.prepare(
      `SELECT company_name, brand_name, website, contact_email, contact_phone, contact_whatsapp,
              membership_expires_at, ai_package_type, ai_package_expires_at, registration_type, status
       FROM sys_company WHERE tenant_id = ?`
    ).bind(user.tenantId).first() || {};
  }
  return {};
}

async function getAgentData(db: D1Database, user: JwtPayload): Promise<any> {
  return db.prepare(
    `SELECT id, username, email, balance, paid_8888, contact_phone, status FROM sys_agent WHERE id = ?`
  ).bind(user.userId).first() || {};
}

async function getCompanyStats(db: D1Database, tenantId: string): Promise<any> {
  const total = await db.prepare('SELECT COUNT(*) as c FROM company_keyword WHERE tenant_id = ?').bind(tenantId).first();
  const pending = await db.prepare("SELECT COUNT(*) as c FROM company_keyword WHERE tenant_id = ? AND status = 'pending'").bind(tenantId).first();
  const generated = await db.prepare("SELECT COUNT(*) as c FROM ai_generate_content WHERE tenant_id = ? AND status = 'completed'").bind(tenantId).first();
  const published = await db.prepare("SELECT COUNT(*) as c FROM publish_record WHERE tenant_id = ? AND status = 'published'").bind(tenantId).first();
  const social = await db.prepare("SELECT COUNT(*) as c FROM company_social_oauth WHERE tenant_id = ? AND status = 'active'").bind(tenantId).first();

  return {
    totalKeywords: total?.c || 0,
    pendingKeywords: pending?.c || 0,
    generatedContents: generated?.c || 0,
    publishedCount: published?.c || 0,
    socialCount: social?.c || 0,
  };
}

// 这些稍后从 agent/admin pages 导入
function agentDashboardPage(agent: any): string {
  return agentPlaceholder('📊 代理商看板', agent?.username || '代理商');
}
function agentCompaniesPage(agent: any): string {
  return agentPlaceholder('🏢 名下企业管理', agent?.username || '代理商');
}
function agentBalancePage(agent: any): string {
  return agentPlaceholder('💰 余额管理', agent?.username || '代理商');
}
function agentOrdersPage(agent: any): string {
  return agentPlaceholder('📋 订单历史', agent?.username || '代理商');
}
function agentProfilePage(agent: any): string {
  return agentPlaceholder('👤 个人资料', agent?.username || '代理商');
}
function adminDashboardPage(): string {
  return adminPlaceholder('📊 全局看板', '总控管理');
}
function adminCompaniesPage(): string {
  return adminPlaceholder('🏢 企业管理', '总控管理');
}
function adminAgentsPage(): string {
  return adminPlaceholder('🤝 代理商管理', '总控管理');
}
function adminFinancePage(): string {
  return adminPlaceholder('💰 财务管理', '总控管理');
}
function adminReservationsPage(): string {
  return adminPlaceholder('📅 预约管理', '总控管理');
}
function adminConfigPage(): string {
  return adminPlaceholder('⚙️ 系统配置', '总控管理');
}
function adminLogsPage(): string {
  return adminPlaceholder('📜 系统日志', '总控管理');
}

function agentPlaceholder(title: string, name: string): string {
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>${title} - LLMGEO</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>${basicCss()}</style></head>
<body>
<div class="app"><aside class="sidebar">
<div class="logo"><h1>🔮 LLMGEO</h1><p>代理商后台</p></div>
<nav>
<a href="/agent/dashboard" class="active">📊 数据看板</a>
<a href="/agent/companies">🏢 名下企业</a>
<a href="/agent/balance">💰 余额管理</a>
<a href="/agent/orders">📋 订单历史</a>
<a href="/agent/profile">👤 个人资料</a>
</nav></aside>
<div class="main">
<div class="header"><h2>${title}</h2><div class="user"><span>${name}</span><a href="#" onclick="logout()" class="logout">退出</a></div></div>
<div class="content"><div class="empty"><div class="icon">🚧</div><p>此页面开发中，敬请期待</p></div></div>
</div></div>
<script>function logout(){localStorage.removeItem('token');window.location.href='/';}</script>
</body></html>`;
}

function adminPlaceholder(title: string, name: string): string {
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>${title} - LLMGEO</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>${basicCss()}</style></head>
<body>
<div class="app"><aside class="sidebar">
<div class="logo"><h1>🔮 LLMGEO</h1><p>总控后台</p></div>
<nav>
<a href="/admin/dashboard" class="active">📊 全局看板</a>
<a href="/admin/companies">🏢 企业管理</a>
<a href="/admin/agents">🤝 代理商</a>
<a href="/admin/finance">💰 财务</a>
<a href="/admin/reservations">📅 预约</a>
<a href="/admin/config">⚙️ 配置</a>
<a href="/admin/logs">📜 日志</a>
</nav></aside>
<div class="main">
<div class="header"><h2>${title}</h2><div class="user"><span>${name}</span><a href="#" onclick="logout()" class="logout">退出</a></div></div>
<div class="content"><div class="empty"><div class="icon">🚧</div><p>此页面开发中，敬请期待</p></div></div>
</div></div>
<script>function logout(){localStorage.removeItem('token');window.location.href='/';}</script>
</body></html>`;
}

function basicCss(): string {
  return `
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#f3f4f6;color:#1f2937}
.app{display:flex;min-height:100vh}
.sidebar{width:260px;background:#1e293b;color:#e2e8f0;padding:24px 0;flex-shrink:0;height:100vh;position:sticky;top:0}
.sidebar .logo{padding:0 20px 24px;border-bottom:1px solid #334155;margin-bottom:16px}
.sidebar .logo h1{font-size:20px;color:#fff}
.sidebar .logo p{font-size:12px;color:#94a3b8;margin-top:4px}
.sidebar nav a{display:flex;align-items:center;gap:10px;padding:10px 20px;color:#94a3b8;text-decoration:none;font-size:14px}
.sidebar nav a:hover,.sidebar nav a.active{background:#334155;color:#fff}
.main{flex:1}
.header{background:#fff;border-bottom:1px solid #e5e7eb;padding:16px 32px;display:flex;justify-content:space-between;align-items:center}
.header h2{font-size:20px;font-weight:600}
.header .user{display:flex;align-items:center;gap:12px;font-size:14px;color:#6b7280}
.header .logout{color:#ef4444;text-decoration:none;font-size:13px}
.content{padding:40px 32px}
.empty{text-align:center;padding:60px 20px;color:#9ca3af}
.empty .icon{font-size:48px;margin-bottom:16px}
.empty p{font-size:15px}
`;
}
