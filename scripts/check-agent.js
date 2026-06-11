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
  const tables = ['sys_agent', 'sys_company', 'balance_logs', 'finance_order', 'agent_balance_log'];
  for (const t of tables) {
    const d = await q('PRAGMA table_info(' + t + ')');
    if (d.success && d.result[0]?.results?.length) {
      console.log('\n=== ' + t + ' ===');
      d.result[0].results.forEach(function(c) {
        console.log('  ' + c.name + ':' + c.type + (c.pk ? ' PK' : ''));
      });
    } else {
      console.log('\n=== ' + t + ' === not found');
    }
  }
}
main().catch(e => console.error(e));
