import { Hono } from 'hono';
import type { Env } from '../../types';
import { authMiddleware, requireRole } from '../../middleware/auth';

export const agentRouter = new Hono<{ Bindings: Env }>();

agentRouter.use('*', authMiddleware);
agentRouter.use('*', requireRole('agent'));

// 代理商看板
agentRouter.get('/dashboard', (c) => {
  return c.json({ success: false, error: 'Not implemented yet' });
});

// 名下企业管理
agentRouter.get('/companies', (c) => {
  return c.json({ success: false, error: 'Not implemented yet' });
});

// 代开企业租户
agentRouter.post('/companies', async (c) => {
  return c.json({ success: false, error: 'Not implemented yet' });
});

// 预存余额查询
agentRouter.get('/balance', (c) => {
  return c.json({ success: false, error: 'Not implemented yet' });
});

// 余额充值回调
agentRouter.post('/recharge', async (c) => {
  return c.json({ success: false, error: 'Not implemented yet' });
});

// 增值预约（免费）
agentRouter.post('/reservations', async (c) => {
  return c.json({ success: false, error: 'Not implemented yet' });
});
