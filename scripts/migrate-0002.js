const fs = require('fs');
const path = require('path');
const ACCOUNT_ID = 'aa42436ad09a92ec856aa353ae06b31e';
const DATABASE_ID = 'e65056f4-7ae1-4f1c-ac4c-94967875e80b';
const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const BASE = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}`;
const HEADERS = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

async function query(sql) {
  const resp = await fetch(BASE+'/d1/database/'+DATABASE_ID+'/query', {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ sql, params: [] })
  });
  return resp.json();
}

async function main() {
  // 1. Create verification_codes table
  let d = await query(`
    CREATE TABLE IF NOT EXISTS verification_codes (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      code TEXT NOT NULL,
      type TEXT NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  if (d.success) {
    console.log('✅ Created verification_codes table');
  } else {
    console.log('❌ verification_codes:', d.errors?.[0]?.message);
  }

  // 2. Create index
  d = await query(`
    CREATE INDEX IF NOT EXISTS idx_vcode_email ON verification_codes(email, type)
  `);
  if (d.success) {
    console.log('✅ Created verification_codes index');
  } else {
    console.log('❌ index:', d.errors?.[0]?.message);
  }

  // 3. Check if sys_company has password_hash
  d = await query("PRAGMA table_info(sys_company)");
  if (d.success) {
    const cols = d.result[0].results.map(r => r.name);
    console.log('sys_company columns:', cols.join(', '));
    
    if (!cols.includes('password_hash')) {
      // Add column
      d = await query("ALTER TABLE sys_company ADD COLUMN password_hash TEXT");
      console.log(d.success ? '✅ Added password_hash to sys_company' : '❌ ' + (d.errors?.[0]?.message || ''));
    } else {
      console.log('⏩ password_hash already exists in sys_company');
    }
  }

  // 4. Check sys_admin
  d = await query("PRAGMA table_info(sys_admin)");
  if (d.success) {
    const cols = d.result[0].results.map(r => r.name);
    console.log('sys_admin columns:', cols.join(', '));
    if (!cols.includes('password_hash')) {
      d = await query("ALTER TABLE sys_admin ADD COLUMN password_hash TEXT");
      console.log(d.success ? '✅ Added password_hash to sys_admin' : '❌ ' + (d.errors?.[0]?.message || ''));
    } else {
      console.log('⏩ password_hash already exists in sys_admin');
    }
  }

  // 5. Check sys_agent
  d = await query("PRAGMA table_info(sys_agent)");
  if (d.success) {
    const cols = d.result[0].results.map(r => r.name);
    console.log('sys_agent columns:', cols.join(', '));
    if (!cols.includes('password_hash')) {
      d = await query("ALTER TABLE sys_agent ADD COLUMN password_hash TEXT");
      console.log(d.success ? '✅ Added password_hash to sys_agent' : '❌ ' + (d.errors?.[0]?.message || ''));
    } else {
      console.log('⏩ password_hash already exists in sys_agent');
    }
  }

  console.log('\n✅ Migration 0002 complete!');
}

main().catch(e => console.error('Fatal:', e));
