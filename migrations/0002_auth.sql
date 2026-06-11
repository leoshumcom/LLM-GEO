-- =============================================
-- LLMGEO - 认证系统迁移（验证码表 + 密码字段补全）
-- =============================================

-- 验证码表
CREATE TABLE IF NOT EXISTS verification_codes (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  type TEXT NOT NULL,                -- register / reset_password / login
  used INTEGER NOT NULL DEFAULT 0,   -- 0 未使用, 1 已使用
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_vcode_email ON verification_codes(email, type);

-- 检查 sys_company 是否有 password_hash 字段，没有则添加
-- D1 不支持 ALTER TABLE ADD COLUMN IF NOT EXISTS，所以先尝试，忽略错误
ALTER TABLE sys_company ADD COLUMN password_hash TEXT;
ALTER TABLE sys_admin ADD COLUMN password_hash TEXT;
ALTER TABLE sys_agent ADD COLUMN password_hash TEXT;
