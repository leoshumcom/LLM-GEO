import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import type { Env } from './types';

// 模块路由
import { authRouter } from './modules/auth/routes';
import { adminRouter } from './modules/admin/routes';
import { agentRouter } from './modules/agent/routes';
import { companyRouter } from './modules/company/routes';
import { apiRouter } from './modules/api/routes';
import { dashboardRouter } from './modules/dashboard/routes';
import { paymentRouter } from './modules/payment/routes';

const app = new Hono<{ Bindings: Env }>();

// ===== 全局中间件 =====
app.use('*', logger());
app.use('*', secureHeaders());
app.use('*', cors({
  origin: ['https://llmgeo.com', 'https://staging.llmgeo.com', 'http://localhost:8787'],
  credentials: true,
}));

// ===== 健康检查 =====
app.get('/', (c) => {
  return c.json({
    success: true,
    message: 'LLMGEO API is running',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  });
});

// ===== 挂载模块路由 =====
app.route('/api/auth', authRouter);
app.route('/api/admin', adminRouter);
app.route('/api/agent', agentRouter);
app.route('/api/company', companyRouter);
app.route('/api/dashboard', dashboardRouter);
app.route('/api/payment', paymentRouter);
app.route('/payment', paymentRouter);  // 支付成功页和通知回调
app.route('/api', apiRouter);       // 公开API（社媒回调等）

// ===== 404 处理 =====
app.notFound((c) => {
  return c.json({ success: false, error: 'Not Found' }, 404);
});

// ===== 全局错误处理 =====
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({ success: false, error: 'Internal Server Error' }, 500);
});

export default app;
