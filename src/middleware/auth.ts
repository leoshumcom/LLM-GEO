import { createMiddleware } from 'hono/factory';
import { jwtVerify, SignJWT } from 'jose';
import type { Env, JwtPayload, ApiResponse } from '../types';

// ===== 生成 JWT Token =====
export async function generateToken(
  payload: JwtPayload,
  secret: string,
  expiresIn: string = '7d'
): Promise<string> {
  const secretKey = new TextEncoder().encode(secret);
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secretKey);
}

// ===== 验证 JWT Token =====
export async function verifyToken(
  token: string,
  secret: string
): Promise<JwtPayload | null> {
  try {
    const secretKey = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, secretKey);
    return payload as unknown as JwtPayload;
  } catch {
    return null;
  }
}

// ===== 认证中间件（通用） =====
export const authMiddleware = createMiddleware<{ Bindings: Env }>(async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'Unauthorized: Missing token' } as ApiResponse, 401);
  }

  const token = authHeader.slice(7);
  const payload = await verifyToken(token, c.env.JWT_SECRET);

  if (!payload) {
    return c.json({ success: false, error: 'Unauthorized: Invalid or expired token' } as ApiResponse, 401);
  }

  // 将用户信息注入请求上下文
  c.set('user', payload);
  await next();
});

// ===== 角色授权中间件工厂 =====
export function requireRole(...roles: string[]) {
  return createMiddleware<{ Bindings: Env }>(async (c, next) => {
    const user = c.get('user') as JwtPayload | undefined;
    if (!user) {
      return c.json({ success: false, error: 'Unauthorized' } as ApiResponse, 401);
    }
    if (!roles.includes(user.role)) {
      return c.json({ success: false, error: 'Forbidden: Insufficient permissions' } as ApiResponse, 403);
    }
    await next();
  });
}

// ===== 租户隔离中间件 =====
// 确保企业/运营商只能访问自己的数据
export const tenantIsolationMiddleware = createMiddleware<{ Bindings: Env }>(async (c, next) => {
  const user = c.get('user') as JwtPayload | undefined;
  if (!user) {
    return c.json({ success: false, error: 'Unauthorized' } as ApiResponse, 401);
  }

  // admin 和 agent 不受租户隔离限制（但agent受代理商隔离限制）
  if (user.role === 'admin') {
    await next();
    return;
  }

  // 从请求参数中提取 tenantId
  const requestTenantId = c.req.query('tenant_id') || c.req.param('tenant_id');

  // 如果请求中指定了 tenantId，检查是否匹配
  if (requestTenantId && user.tenantId && requestTenantId !== user.tenantId) {
    return c.json({ success: false, error: 'Forbidden: Cross-tenant access denied' } as ApiResponse, 403);
  }

  await next();
});
