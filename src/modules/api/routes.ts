import { Hono } from 'hono';
import type { Env } from '../../types';

export const apiRouter = new Hono<{ Bindings: Env }>();

// 公开端点 - 社媒OAuth回调
apiRouter.get('/social/callback/:platform', (c) => {
  return c.json({ success: false, error: 'Not implemented yet' });
});

// 公开端点 - 支付回调
apiRouter.post('/payment/callback', async (c) => {
  return c.json({ success: false, error: 'Not implemented yet' });
});

// 公开端点 - 首页（SEO）
apiRouter.get('/articles', (c) => {
  return c.json({ success: false, error: 'Not implemented yet' });
});

apiRouter.get('/articles/:id', (c) => {
  return c.json({ success: false, error: 'Not implemented yet' });
});

// 公开端点 - 官网页面
apiRouter.get('/site/:page', (c) => {
  return c.json({ success: false, error: 'Not implemented yet' });
});

// 公开端点 - 价格页面
apiRouter.get('/pricing', (c) => {
  return c.json({ success: false, error: 'Not implemented yet' });
});

// 社媒发布webhook（供站群调用）
apiRouter.post('/publish/webhook', async (c) => {
  return c.json({ success: false, error: 'Not implemented yet' });
});
