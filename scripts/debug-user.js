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
  // Check users
  for (const email of ['hello@newco.com', 'boss@newfirm.com', 'demo@company.com']) {
    const d = await q(`SELECT id, contact_email as email, password_hash, company_name, tenant_id FROM sys_company WHERE contact_email = '${email}'`);
    if (d.success && d.result[0]?.results?.length) {
      console.log(email, ':', d.result[0].results[0].password_hash ? 'has hash ✅' : 'NULL ❌', 'tenant:', d.result[0].results[0].tenant_id);
    } else {
      console.log(email, ': not found');
    }
  }

  // Also check the 'new' test user from the registration with password_hash fix
  const d = await q(`SELECT contact_email, password_hash, company_name FROM sys_company WHERE contact_email LIKE '%@%' ORDER BY created_at DESC LIMIT 5`);
  if (d.success) {
    console.log('\nRecent registrations:');
    d.result[0].results.forEach(r => console.log(' ', r.contact_email, r.password_hash ? 'hash✅' : 'NULL❌'));
  }

  // Test the batch insert issue - check constraint
  const d2 = await q("PRAGMA table_info(company_keyword)");
  if (d2.success) {
    console.log('\ncompany_keyword cols:', d2.result[0].results.map(r => r.name+':'+r.type).join(', '));
  }

  // Check if UNIQUE constraint exists
  const d3 = await q("SELECT * FROM sqlite_master WHERE type='index' AND tbl_name='company_keyword'");
  if (d3.success) {
    console.log('\nIndexes on company_keyword:');
    d3.result[0].results.forEach(r => console.log(' ', r.name, r.sql ? r.sql.substring(0, 100) : ''));
  }
}
main().catch(e => console.error(e));
