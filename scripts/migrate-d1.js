const fs = require('fs');
const path = require('path');
const ACCOUNT_ID = 'aa42436ad09a92ec856aa353ae06b31e';
const DATABASE_ID = 'e65056f4-7ae1-4f1c-ac4c-94967875e80b';
const TOKEN = process.env.CLOUDFLARE_API_TOKEN;

const BASE = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}`;
const HEADERS = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

async function run() {
  const sqlPath = path.join(__dirname, '..', 'migrations', '0001_init.sql');
  const sql = fs.readFileSync(sqlPath, 'utf-8');

  // Split into individual statements
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('--') && s.length > 0);

  console.log(`Total ${statements.length} SQL statements to execute`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    // Print short preview
    const preview = stmt.substring(0, 60).replace(/\n/g, ' ');
    process.stdout.write(`[${i+1}/${statements.length}] ${preview}... `);

    try {
      const resp = await fetch(`${BASE}/d1/database/${DATABASE_ID}/query`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({ sql: stmt, params: [] })
      });
      const d = await resp.json();
      if (d.success) {
        console.log('✅');
        success++;
      } else {
        const err = d.errors?.[0]?.message || JSON.stringify(d.errors);
        console.log(`❌ ${err}`);
        failed++;
        // Don't stop, continue with next
      }
    } catch (e) {
      console.log(`❌ ${e.message}`);
      failed++;
    }
  }

  console.log(`\n=== Migration Complete ===`);
  console.log(`✅ Success: ${success}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Total: ${statements.length}`);
}

run().catch(e => console.error('Fatal:', e));
