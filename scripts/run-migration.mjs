// 执行 D1 迁移 — 逐条发送 SQL 到 Cloudflare API
import { readFileSync } from 'fs';

const statements = JSON.parse(readFileSync('migrations/statements.json', 'utf-8'));
const apiToken = process.env.CLOUDFLARE_API_TOKEN;
const accountId = 'aa42436ad09a92ec856aa353ae06b31e';
const databaseId = 'e65056f4-7ae1-4f1c-ac4c-94967875e80b';

async function run() {
  let success = 0;
  let failed = 0;

  for (let i = 0; i < statements.length; i++) {
    const { sql } = statements[i];
    const resp = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sql }),
      }
    );
    const data = await resp.json();
    if (data.success) {
      success++;
      process.stdout.write('.');
    } else {
      failed++;
      const errMsg = data.errors?.[0]?.message || 'unknown error';
      console.log(`\n❌ [${i + 1}/${statements.length}] Error: ${errMsg}`);
      console.log(`  SQL: ${sql.substring(0, 80)}...`);
    }
  }

  console.log(`\n\n✅ Complete! ${success} succeeded, ${failed} failed`);
}

run().catch(console.error);
