import { Hono } from 'hono';
import type { Env } from '../../types';
import { authMiddleware, requireRole } from '../../middleware/auth';

export const dashboardRouter = new Hono<{ Bindings: Env }>();

dashboardRouter.use('*', authMiddleware);

// 根据角色返回不同看板数据
dashboardRouter.get('/', (c) => {
  return c.json({ success: false, error: 'Not implemented yet' });
});
