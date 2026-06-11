const BASE = 'https://api.cloudflare.com/client/v4/accounts/aa42436ad09a92ec856aa353ae06b31e';
const TOKEN = process.env.CLOUDFLARE_API_TOKEN;

async function q(sql) {
  const r = await fetch(BASE+'/d1/database/e65056f4-7ae1-4f1c-ac4c-94967875e80b/query', {
    method: 'POST',
    headers: { Authorization: 'Bearer '+TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql, params: [] })
  });
  return (await r.json());
}

async function main() {
  let d = await q('SELECT id, code, name FROM sys_role');
  if (d.success) {
    console.log('Roles:', JSON.stringify(d.result[0].results));
  }

  d = await q('SELECT id, user_id, user_type, role_id FROM sys_user_role LIMIT 5');
  if (d.success) {
    console.log('User roles:', JSON.stringify(d.result[0].results));
  }

  d = await q("PRAGMA table_info(sys_role)");
  if (d.success) {
    console.log('sys_role schema:', d.result[0].results.map(r => r.name+':'+r.type).join(', '));
  }

  d = await q("PRAGMA table_info(sys_user_role)");
  if (d.success) {
    console.log('sys_user_role schema:', d.result[0].results.map(r => r.name+':'+r.type).join(', '));
  }

  d = await q("PRAGMA foreign_key_list(sys_user_role)");
  if (d.success && d.result[0]?.results?.length) {
    console.log('FK constraints:', JSON.stringify(d.result[0].results));
  } else {
    console.log('No FK constraints found (might be different schema)');
  }

  // Try inserting directly to see the actual error
  const testId = crypto.randomUUID();
  d = await q("INSERT INTO sys_user_role (id, user_id, user_type, role_id, created_at) VALUES ('"+testId+"', 'test-user', 'company', 'role_company', datetime('now'))");
  console.log('Direct insert:', d.success ? '✅' : '❌', JSON.stringify(d.errors?.[0]));
}
main().catch(e => console.error(e));
