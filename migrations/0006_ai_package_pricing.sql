-- AI 加油包定价配置（分单位）
INSERT OR IGNORE INTO system_config (config_key, config_value, description, created_at, updated_at)
VALUES 
  ('ai_package_daily', '600', 'AI加油包日套餐价格（分），默认¥6', datetime('now'), datetime('now')),
  ('ai_package_monthly', '12000', 'AI加油包月套餐价格（分），默认¥120', datetime('now'), datetime('now')),
  ('ai_package_yearly', '120000', 'AI加油包年套餐价格（分），默认¥1,200', datetime('now'), datetime('now'));

-- 同步 system_config 表定义
-- 如果表不存在，创建它
CREATE TABLE IF NOT EXISTS system_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  config_key TEXT NOT NULL UNIQUE,
  config_value TEXT NOT NULL DEFAULT '',
  description TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
