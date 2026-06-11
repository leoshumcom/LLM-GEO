import type { D1Database, R2Bucket, Queue } from '@cloudflare/workers-types';

// ===== 环境绑定 =====
export interface Env {
  DB: D1Database;
  R2_MEDIA: R2Bucket;
  AI_GENERATE_QUEUE: Queue<AiGenerateTask>;
  ENVIRONMENT: string;
  APP_URL: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  AGNES_API_BASE_URL: string;
  AGNES_API_KEY: string;
  AGNES_API_KEY_OLD: string;
  AGNES_API_KEY_NEW: string;
  SITE_NAME: string;
  SITE_DESCRIPTION: string;
  // 社媒 OAuth 配置（可选）
  TWITTER_CLIENT_ID?: string;
  TWITTER_CLIENT_SECRET?: string;
  FACEBOOK_APP_ID?: string;
  FACEBOOK_APP_SECRET?: string;
  LINKEDIN_CLIENT_ID?: string;
  LINKEDIN_CLIENT_SECRET?: string;
}

// ===== 用户角色 =====
export enum UserRole {
  ADMIN = 'admin',
  AGENT = 'agent',
  COMPANY = 'company',
  OPERATOR = 'operator',
}

// ===== JWT Payload =====
export interface JwtPayload {
  userId: string;
  role: UserRole;
  tenantId?: string;     // 企业租户ID (company/operator角色)
  agentId?: string;      // 代理商ID (agent角色)
}

// ===== AI 生成任务 =====
export interface AiGenerateTask {
  taskId: string;
  tenantId: string;
  keywordId: string;
  keyword: string;
  brandName: string;
  brandWebsite: string;
  contactInfo: string;
  modelType: 'text' | 'image' | 'video';
  provider: string;
}

// ===== API 统一响应 =====
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ===== 分页 =====
export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
