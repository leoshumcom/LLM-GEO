import { Hono } from 'hono';
import type { Env } from '../../types';
import { authMiddleware, requireRole, tenantIsolationMiddleware } from '../../middleware/auth';

export const companyRouter = new Hono<{ Bindings: Env }>();

companyRouter.use('*', authMiddleware);
companyRouter.use('*', requireRole('company', 'operator'));
companyRouter.use('*', tenantIsolationMiddleware);

// 企业资料管理
companyRouter.get('/profile', (c) => {
  return c.json({ success: false, error: 'Not implemented yet' });
});

companyRouter.put('/profile', async (c) => {
  return c.json({ success: false, error: 'Not implemented yet' });
});

// 关键词管理
companyRouter.get('/keywords', (c) => {
  return c.json({ success: false, error: 'Not implemented yet' });
});

companyRouter.post('/keywords', async (c) => {
  return c.json({ success: false, error: 'Not implemented yet' });
});

companyRouter.post('/keywords/batch', async (c) => {
  return c.json({ success: false, error: 'Not implemented yet' });
});

companyRouter.delete('/keywords/:id', (c) => {
  return c.json({ success: false, error: 'Not implemented yet' });
});

// 社媒绑定管理
companyRouter.get('/social', (c) => {
  return c.json({ success: false, error: 'Not implemented yet' });
});

companyRouter.delete('/social/:platform', (c) => {
  return c.json({ success: false, error: 'Not implemented yet' });
});

// AI 生成任务
companyRouter.post('/ai/generate', async (c) => {
  return c.json({ success: false, error: 'Not implemented yet' });
});

// AI 模型配置
companyRouter.get('/ai/config', (c) => {
  return c.json({ success: false, error: 'Not implemented yet' });
});

companyRouter.put('/ai/config', async (c) => {
  return c.json({ success: false, error: 'Not implemented yet' });
});

// AI 套餐购买
companyRouter.post('/ai/package', async (c) => {
  return c.json({ success: false, error: 'Not implemented yet' });
});

// 发布记录
companyRouter.get('/publish', (c) => {
  return c.json({ success: false, error: 'Not implemented yet' });
});

// AI 素材库
companyRouter.get('/media', (c) => {
  return c.json({ success: false, error: 'Not implemented yet' });
});

// 增值预约
companyRouter.post('/reservations', async (c) => {
  return c.json({ success: false, error: 'Not implemented yet' });
});

// 子账号管理
companyRouter.get('/operators', (c) => {
  return c.json({ success: false, error: 'Not implemented yet' });
});

companyRouter.post('/operators', async (c) => {
  return c.json({ success: false, error: 'Not implemented yet' });
});
