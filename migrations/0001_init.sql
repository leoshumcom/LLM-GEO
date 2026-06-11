-- =============================================
-- LLMGEO - D1 数据库完整迁移（初始化）
-- =============================================

-- 1. 总控管理员表
CREATE TABLE IF NOT EXISTS sys_admin (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. 代理商账户表
CREATE TABLE IF NOT EXISTS sys_agent (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  balance INTEGER NOT NULL DEFAULT 0,          -- 预存余额（单位：分）
  paid_8888 INTEGER NOT NULL DEFAULT 0,        -- 是否已支付8888元开户费
  contact_phone TEXT,
  expiry_reminder INTEGER NOT NULL DEFAULT 1,   -- 到期提醒开关
  status TEXT NOT NULL DEFAULT 'active',        -- active / frozen / disabled
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 3. 企业租户表
CREATE TABLE IF NOT EXISTS sys_company (
  id TEXT PRIMARY KEY,
  agent_id TEXT,                                -- 关联代理商（代理商代开时非空）
  tenant_id TEXT NOT NULL UNIQUE,               -- 租户唯一标识
  company_name TEXT NOT NULL UNIQUE,            -- 企业名称（全局唯一）
  website TEXT,
  brand_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  contact_whatsapp TEXT,
  membership_expires_at TEXT,                   -- 会员年费到期时间
  ai_package_expires_at TEXT,                   -- AI套餐到期时间
  ai_package_type TEXT,                         -- none / daily / monthly
  registration_type TEXT NOT NULL DEFAULT 'agent',  -- agent（代理代开）/ self（自主注册）
  registration_fee INTEGER NOT NULL DEFAULT 88800,  -- 注册费用（分）
  status TEXT NOT NULL DEFAULT 'active',        -- active / frozen / disabled / refund_pending
  refund_requested_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (agent_id) REFERENCES sys_agent(id)
);

-- 4. 运营子账号表
CREATE TABLE IF NOT EXISTS sys_company_operator (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (company_id) REFERENCES sys_company(id)
);
CREATE INDEX idx_operator_company ON sys_company_operator(company_id);

-- 5. 角色表
CREATE TABLE IF NOT EXISTS sys_role (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,        -- admin / agent / company / operator
  name TEXT NOT NULL,               -- 总控管理员 / 代理商 / 企业用户 / 运营人员
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 6. 权限码表
CREATE TABLE IF NOT EXISTS sys_permission (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  module TEXT NOT NULL,             -- 所属模块
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 7. 用户角色关联表
CREATE TABLE IF NOT EXISTS sys_user_role (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_type TEXT NOT NULL,          -- admin / agent / company / operator
  role_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (role_id) REFERENCES sys_role(id)
);
CREATE INDEX idx_user_role_user ON sys_user_role(user_id, user_type);
CREATE INDEX idx_user_role_role ON sys_user_role(role_id);

-- 8. 企业关键词表
CREATE TABLE IF NOT EXISTS company_keyword (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  keyword TEXT NOT NULL,
  group_name TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',  -- pending / generated / published / failed
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES sys_company(tenant_id)
);
CREATE INDEX idx_keyword_tenant ON company_keyword(tenant_id);
CREATE INDEX idx_keyword_status ON company_keyword(status);

-- 9. 社媒授权令牌表
CREATE TABLE IF NOT EXISTS company_social_oauth (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  platform TEXT NOT NULL,           -- 平台标识：wechat / linkedin / youtube / x / facebook / instagram / tiktok / ...
  platform_user_id TEXT,           -- 平台返回的用户唯一ID
  platform_user_name TEXT,         -- 平台用户名
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TEXT,           -- access_token 过期时间
  scope TEXT,
  status TEXT NOT NULL DEFAULT 'active',  -- active / expired / revoked
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES sys_company(tenant_id),
  UNIQUE(tenant_id, platform)
);
CREATE INDEX idx_oauth_tenant ON company_social_oauth(tenant_id);
CREATE INDEX idx_oauth_platform ON company_social_oauth(platform);
CREATE INDEX idx_oauth_expires ON company_social_oauth(token_expires_at);

-- 10. 企业大模型配置表
CREATE TABLE IF NOT EXISTS ai_model_config (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  provider TEXT NOT NULL,           -- 模型厂商：doubao / tongyi / deepseek / chatgpt / gemini / grok / agnes
  api_key TEXT,
  api_base_url TEXT,
  model_name TEXT,
  is_platform_package INTEGER NOT NULL DEFAULT 0,  -- 是否使用平台通用套餐
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES sys_company(tenant_id),
  UNIQUE(tenant_id, provider)
);
CREATE INDEX idx_model_tenant ON ai_model_config(tenant_id);

-- 11. AI 生成文章主表
CREATE TABLE IF NOT EXISTS ai_generate_content (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  keyword_id TEXT,
  keyword TEXT,
  title TEXT,
  content TEXT,                     -- 生成的HTML/Markdown内容
  brand_name TEXT,
  brand_website TEXT,
  contact_info TEXT,
  provider TEXT NOT NULL,           -- 使用的模型
  media_ids TEXT,                   -- 关联素材ID（逗号分隔）
  status TEXT NOT NULL DEFAULT 'pending',  -- pending / completed / failed
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  FOREIGN KEY (tenant_id) REFERENCES sys_company(tenant_id),
  FOREIGN KEY (keyword_id) REFERENCES company_keyword(id)
);
CREATE INDEX idx_content_tenant ON ai_generate_content(tenant_id);
CREATE INDEX idx_content_status ON ai_generate_content(status);

-- 12. AI 多媒体素材表
CREATE TABLE IF NOT EXISTS ai_media_file (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  content_id TEXT,
  file_type TEXT NOT NULL,          -- image / video
  r2_path TEXT NOT NULL,            -- R2 存储路径
  file_size INTEGER DEFAULT 0,
  mime_type TEXT,
  width INTEGER,
  height INTEGER,
  duration INTEGER,                 -- 视频时长（秒）
  generated_by TEXT NOT NULL,       -- 生成模型
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES sys_company(tenant_id),
  FOREIGN KEY (content_id) REFERENCES ai_generate_content(id)
);
CREATE INDEX idx_media_tenant ON ai_media_file(tenant_id);

-- 13. 发布记录表
CREATE TABLE IF NOT EXISTS publish_record (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  content_id TEXT,
  platform TEXT NOT NULL,           -- 发布平台
  platform_url TEXT,                -- 发布后的外链URL
  channel_type TEXT NOT NULL,       -- social（社媒）/ site（站群）
  status TEXT NOT NULL DEFAULT 'pending',  -- pending / published / failed
  error_message TEXT,
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES sys_company(tenant_id),
  FOREIGN KEY (content_id) REFERENCES ai_generate_content(id)
);
CREATE INDEX idx_publish_tenant ON publish_record(tenant_id);
CREATE INDEX idx_publish_platform ON publish_record(platform);
CREATE INDEX idx_publish_status ON publish_record(status);
CREATE INDEX idx_publish_date ON publish_record(published_at);

-- 14. 全平台付费订单表
CREATE TABLE IF NOT EXISTS finance_order (
  id TEXT PRIMARY KEY,
  order_no TEXT NOT NULL UNIQUE,    -- 订单号
  order_type TEXT NOT NULL,         -- agent_registration / company_fee / ai_daily / ai_monthly / reservation
  amount INTEGER NOT NULL,          -- 金额（分）
  currency TEXT NOT NULL DEFAULT 'CNY',
  payment_method TEXT,              -- 支付方式
  payment_status TEXT NOT NULL DEFAULT 'pending',  -- pending / paid / refunded / cancelled
  paid_at TEXT,
  agent_id TEXT,
  tenant_id TEXT,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (agent_id) REFERENCES sys_agent(id),
  FOREIGN KEY (tenant_id) REFERENCES sys_company(tenant_id)
);
CREATE INDEX idx_order_agent ON finance_order(agent_id);
CREATE INDEX idx_order_tenant ON finance_order(tenant_id);
CREATE INDEX idx_order_status ON finance_order(payment_status);
CREATE INDEX idx_order_type ON finance_order(order_type);
CREATE INDEX idx_order_date ON finance_order(created_at);

-- 15. 代理商余额流水表
CREATE TABLE IF NOT EXISTS agent_balance_log (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  order_id TEXT,
  change_amount INTEGER NOT NULL,   -- 变动金额（分），正数为充值/退款，负数为扣款
  balance_before INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  operation_type TEXT NOT NULL,     -- recharge / deduct_company / refund / ai_package
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (agent_id) REFERENCES sys_agent(id)
);
CREATE INDEX idx_balance_agent ON agent_balance_log(agent_id);
CREATE INDEX idx_balance_date ON agent_balance_log(created_at);

-- 16. 增值预约工单表
CREATE TABLE IF NOT EXISTS reservation_form (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  agent_id TEXT,
  service_type TEXT NOT NULL,       -- 1-8 对应8类服务
  applicant_name TEXT NOT NULL,
  contact TEXT NOT NULL,
  requirement TEXT,
  people_count TEXT,                -- 使用人数档位
  expected_contact_time TEXT,       -- 期望联系时间
  payment_status TEXT NOT NULL DEFAULT 'pending',  -- pending / paid（代理商自动paid）
  order_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending / contacted / completed
  admin_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES sys_company(tenant_id),
  FOREIGN KEY (agent_id) REFERENCES sys_agent(id)
);
CREATE INDEX idx_reservation_tenant ON reservation_form(tenant_id);
CREATE INDEX idx_reservation_agent ON reservation_form(agent_id);
CREATE INDEX idx_reservation_status ON reservation_form(status);

-- 17. 系统全局配置表
CREATE TABLE IF NOT EXISTS system_config (
  id TEXT PRIMARY KEY,
  config_key TEXT NOT NULL UNIQUE,
  config_value TEXT NOT NULL,
  description TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 18. 系统操作日志表
CREATE TABLE IF NOT EXISTS system_log (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  user_type TEXT,
  action TEXT NOT NULL,             -- login / payment / ai_generate / publish / account_change / config_change
  target_type TEXT,
  target_id TEXT,
  detail TEXT,
  ip_address TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_log_user ON system_log(user_id);
CREATE INDEX idx_log_action ON system_log(action);
CREATE INDEX idx_log_date ON system_log(created_at);

-- =============================================
-- 初始化默认数据
-- =============================================

-- 插入默认角色
INSERT OR IGNORE INTO sys_role (id, code, name, description) VALUES
  ('role_admin', 'admin', '总控管理员', '平台拥有者，唯一超级权限'),
  ('role_agent', 'agent', '代理商', '付费代理商，分销开户'),
  ('role_company', 'company', '企业用户', '租户，使用AI内容生成和发布服务'),
  ('role_operator', 'operator', '运营人员', '企业子账号，编辑查看权限');

-- 初始化默认系统配置
INSERT OR IGNORE INTO system_config (id, config_key, config_value, description) VALUES
  ('cfg_agent_fee', 'agent_registration_fee', '888800', '代理商开户费（分）'),
  ('cfg_company_fee_agent', 'company_fee_agent', '88800', '代理商代开企业年费（分）'),
  ('cfg_company_fee_self', 'company_fee_self', '168800', '企业自主注册年费（分）'),
  ('cfg_ai_daily', 'ai_package_daily', '6600', 'AI日套餐价格（分）'),
  ('cfg_ai_monthly', 'ai_package_monthly', '66600', 'AI月套餐价格（分）'),
  ('cfg_free_trial_days', 'ai_free_trial_days', '7', 'AI免费试用天数'),
  ('cfg_reservation_fee', 'reservation_fee', '600', '增值预约费用（分）'),
  ('cfg_refund_days', 'refund_grace_days', '7', '企业注销退款宽限天数');
