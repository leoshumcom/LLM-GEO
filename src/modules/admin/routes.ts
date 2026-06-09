import { Hono } from 'hono';
import type { Env } from '../../types';
import { authMiddleware, requireRole } from '../../middleware/auth';

export const adminRouter = new Hono<{ Bindings: Env }>();

// 所有管理员路由需要认证 + admin角色
adminRouter.use('*', authMiddleware);
adminRouter.use('*', requireRole('admin'));

// 全局数据看板
adminRouter.get('/dashboard', (c) => {
  return c.json({ success: false, error: 'Not implemented yet' });
});

// 代理商管理
adminRouter.get('/agents', (c) => {
  return c.json({ success: false, error: 'Not implemented yet' });
});

// 财务管理
adminRouter.get('/finance', (c) => {
  return c.json({ success: false, error: 'Not implemented yet' });
});

// 系统配置管理
adminRouter.get('/config', (c) => {
  return c.json({ success: false, error: 'Not implemented yet' });
});

// 全量数据导出
adminRouter.get('/export/:type', (c) => {
  return c.json({ success: false, error: 'Not implemented yet' });
});

// 系统日志
adminRouter.get('/logs', (c) => {
  return c.json({ success: false, error: 'Not implemented yet' });
});
