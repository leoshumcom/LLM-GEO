const BASE = 'https://api.cloudflare.com/client/v4/accounts/aa42436ad09a92ec856aa353ae06b31e';
const HEADERS = {
  Authorization: 'Bearer ' + process.env.CLOUDFLARE_API_TOKEN,
  'Content-Type': 'application/json'
};

async function query(sql) {
  const resp = await fetch(BASE+'/d1/database/e65056f4-7ae1-4f1c-ac4c-94967875e80b/query', {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ sql, params: [] })
  });
  return resp.json();
}

async function main() {
  // Create missing agent_balance_log table
  const d = await query(`
    CREATE TABLE IF NOT EXISTS agent_balance_log (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      order_id TEXT,
      change_amount INTEGER NOT NULL,
      balance_before INTEGER NOT NULL,
      balance_after INTEGER NOT NULL,
      operation_type TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (agent_id) REFERENCES sys_agent(id)
    )
  `);
  if (d.success) {
    console.log('✅ Created agent_balance_log');
  } else {
    console.log('❌', d.errors?.[0]?.message);
  }

  // Create indexes for it
  for (const idx of [
    "CREATE INDEX IF NOT EXISTS idx_balance_agent ON agent_balance_log(agent_id)",
    "CREATE INDEX IF NOT EXISTS idx_balance_date ON agent_balance_log(created_at)"
  ]) {
    const r = await query(idx);
    console.log(r.success ? '✅' : '❌', idx.substring(0, 60));
  }

  // Verify all tables
  const d2 = await query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
  if (d2.success) {
    const tables = d2.result[0].results.map(r => r.name);
    console.log('\n=== All Tables (' + tables.length + ') ===');
    console.log(tables.join(', '));
  }
}

main().catch(e => console.error(e));
