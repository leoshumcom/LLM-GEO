-- =============================================
-- LLMGEO - 站群发布模块（publish_site 表）
-- =============================================

CREATE TABLE IF NOT EXISTS publish_site (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  site_name TEXT NOT NULL,
  site_url TEXT NOT NULL,
  api_url TEXT NOT NULL,
  wp_username TEXT NOT NULL,
  wp_password TEXT NOT NULL,
  site_type TEXT NOT NULL DEFAULT 'wordpress',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_publish_site_tenant ON publish_site(tenant_id);
