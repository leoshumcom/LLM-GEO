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
  // Check tables
  let d = await query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
  if (d.success) {
    console.log('=== TABLES ===');
    d.result[0].results.forEach(r => console.log(' ' + r.name));
  } else {
    console.log('❌', d.errors?.[0]?.message);
  }

  // Check existing data
  d = await query("SELECT id, config_key, config_value FROM system_config LIMIT 10");
  if (d.success && d.result[0]?.results?.length) {
    console.log('\n=== SYSTEM CONFIG ===');
    d.result[0].results.forEach(r => console.log(' ' + r.config_key + ' = ' + r.config_value));
  } else {
    console.log('\n=== SYSTEM CONFIG: empty or failed ===');
  }

  d = await query("SELECT id, code, name FROM sys_role LIMIT 10");
  if (d.success && d.result[0]?.results?.length) {
    console.log('\n=== ROLES ===');
    d.result[0].results.forEach(r => console.log(' ' + r.code + ' = ' + r.name));
  } else {
    console.log('\n=== ROLES: empty or failed ===');
  }
}

main().catch(e => console.error(e));
