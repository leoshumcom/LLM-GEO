const BASE = 'https://api.cloudflare.com/client/v4/accounts/aa42436ad09a92ec856aa353ae06b31e';
const TOKEN = process.env.CLOUDFLARE_API_TOKEN;

async function q(sql) {
  const r = await fetch(BASE+'/d1/database/e65056f4-7ae1-4f1c-ac4c-94967875e80b/query', {
    method: 'POST',
    headers: { Authorization: 'Bearer '+TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql, params: [] })
  });
  return await r.json();
}

async function main() {
  // Test login hash match for boss@newfirm.com
  const encoder = new TextEncoder();
  const pwdData = encoder.encode('boss123456' + 'llmgeo_salt_2024');
  const hashBuf = await crypto.subtle.digest('SHA-256', pwdData);
  const hashArr = Array.from(new Uint8Array(hashBuf));
  const hashHex = hashArr.map(b => b.toString(16).padStart(2, '0')).join('');
  console.log('expected hash:', hashHex);

  const d = await q(`SELECT id, password_hash, tenant_id, company_name FROM sys_company WHERE contact_email = 'boss@newfirm.com'`);
  if (d.success && d.result[0]?.results?.length) {
    const row = d.result[0].results[0];
    console.log('stored hash:', row.password_hash);
    console.log('Match:', row.password_hash === hashHex ? '✅' : '❌');
  } else {
    console.log('User not found');
  }

  // Now try a manual login SELECT
  const d2 = await q(`SELECT id, tenant_id FROM sys_company WHERE contact_email = 'boss@newfirm.com' AND password_hash = '${hashHex}'`);
  if (d2.success && d2.result[0]?.results?.length) {
    console.log('Manual login match: ✅');
  } else {
    console.log('Manual login match: ❌');
    console.log('Result:', JSON.stringify(d2.result?.[0]));
  }

  // Test batch insert
  const tenantId = 'tenant_26e14503';
  const id1 = crypto.randomUUID();
  const id2 = crypto.randomUUID();
  const d3 = await q(`INSERT OR IGNORE INTO company_keyword (id, tenant_id, keyword, group_name, status, created_at, updated_at) VALUES ('${id1}', '${tenantId}', 'debug test 1', 'test', 'pending', datetime('now'), datetime('now')), ('${id2}', '${tenantId}', 'debug test 2', 'test', 'pending', datetime('now'), datetime('now'))`);
  console.log('Batch insert:', d3.success ? '✅' : '❌');
  if (!d3.success) {
    console.log('Error:', d3.errors?.[0]?.message);
  }
}
main().catch(e => console.error(e));
