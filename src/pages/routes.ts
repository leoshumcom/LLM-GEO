/**
 * 管理后台页面路由
 * 
 * 企业端：/company/*
 * 代理商端：/agent/*
 * 管理员端：/admin/*
 */

import { Hono } from 'hono';
import type { Env, JwtPayload } from '../types';
import { registerPage, loginPage, faviconHandler } from './public/index';
import { authMiddleware, requireRole } from '../middleware/auth';
// 企业端页面
import {
  companyDashboardPage,
  companyKeywordsPage,
  companyAiPage,
  companyPublishPage,
  companyProfilePage,
  companySocialPage,
  companyOperatorsPage,
  companyMediaPage,
  companySitesPage,
  companyPackagesPage,
  companyAiConfigPage,
  companyReservationsPage,
} from './company/index';
// 代理商页面
import {
  agentDashboardPage,
  agentCompaniesPage,
  agentBalancePage,
  agentOrdersPage,
  agentProfilePage,
} from './agent/index';
// 管理员页面
import {
  adminDashboardPage,
  adminCompaniesPage,
  adminAgentsPage,
  adminFinancePage,
  adminReservationsPage,
  adminConfigPage,
  adminLogsPage,
  adminRefundsPage,
} from './admin/index';

export const pagesRouter = new Hono<{ Bindings: Env }>();

// ===== 公开页面（无需登录） =====
pagesRouter.get('/register', async (c) => {
  return c.html(registerPage());
});

pagesRouter.get('/login', async (c) => {
  return c.html(loginPage());
});

// ===== 数据注入中间件（获取用户/企业/代理商数据） =====
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

pagesRouter.get('/company/sites', authMiddleware, requireRole('company', 'operator'), async (c) => {
  const user = c.get('user') as JwtPayload;
  const company = await getUserData(c.env.DB, user);
  return c.html(companySitesPage(company));
});

pagesRouter.get('/company/packages', authMiddleware, requireRole('company', 'operator'), async (c) => {
  const user = c.get('user') as JwtPayload;
  const company = await getUserData(c.env.DB, user);
  return c.html(companyPackagesPage(company));
});

pagesRouter.get('/company/ai-config', authMiddleware, requireRole('company', 'operator'), async (c) => {
  const user = c.get('user') as JwtPayload;
  const company = await getUserData(c.env.DB, user);
  return c.html(companyAiConfigPage(company));
});

pagesRouter.get('/company/reservations', authMiddleware, requireRole('company', 'operator'), async (c) => {
  const user = c.get('user') as JwtPayload;
  const company = await getUserData(c.env.DB, user);
  return c.html(companyReservationsPage(company));
});

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
  return c.html(adminDashboardPage());
});

pagesRouter.get('/admin/companies', authMiddleware, requireRole('admin'), async (c) => {
  return c.html(adminCompaniesPage());
});

pagesRouter.get('/admin/agents', authMiddleware, requireRole('admin'), async (c) => {
  return c.html(adminAgentsPage());
});

pagesRouter.get('/admin/finance', authMiddleware, requireRole('admin'), async (c) => {
  return c.html(adminFinancePage());
});

pagesRouter.get('/admin/reservations', authMiddleware, requireRole('admin'), async (c) => {
  return c.html(adminReservationsPage());
});

pagesRouter.get('/admin/config', authMiddleware, requireRole('admin'), async (c) => {
  return c.html(adminConfigPage());
});

pagesRouter.get('/admin/logs', authMiddleware, requireRole('admin'), async (c) => {
  return c.html(adminLogsPage());
});

pagesRouter.get('/admin/refunds', authMiddleware, requireRole('admin'), async (c) => {
  return c.html(adminRefundsPage());
});
