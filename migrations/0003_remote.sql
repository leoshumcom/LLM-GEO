-- Run on remote D1 via: wrangler d1 execute llmgeo-db --remote --file=0003_migration.sql
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
