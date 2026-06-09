import { Hono } from 'hono';
import type { Env } from '../../types';

export const authRouter = new Hono<{ Bindings: Env }>();

// POST /api/auth/login - 统一登录
authRouter.post('/login', async (c) => {
  const { username, password, role } = await c.req.json();
  // TODO: 验证登录逻辑
  return c.json({ success: false, error: 'Not implemented yet' });
});

// POST /api/auth/register - 企业自主注册
authRouter.post('/register', async (c) => {
  // TODO: 企业自主注册
  return c.json({ success: false, error: 'Not implemented yet' });
});

// POST /api/auth/reset-password - 密码重置
authRouter.post('/reset-password', async (c) => {
  // TODO: 密码重置
  return c.json({ success: false, error: 'Not implemented yet' });
});
