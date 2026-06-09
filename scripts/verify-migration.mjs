// 验证 D1 迁移结果
const apiToken = process.env.CLOUDFLARE_API_TOKEN;
const accountId = 'aa42436ad09a92ec856aa353ae06b31e';
const databaseId = 'e65056f4-7ae1-4f1c-ac4c-94967875e80b';

async function query(sql) {
  const resp = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql }),
    }
  );
  return resp.json();
}

async function main() {
  // 验证表
  const tables = await query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
  if (tables.success) {
    console.log('📊 Tables created:');
    tables.result[0].results.forEach(r => console.log('   ✅', r.name));
    console.log(`   Total: ${tables.result[0].results.length} tables`);
  }

  // 验证系统配置
  const configs = await query("SELECT config_key, config_value FROM system_config ORDER BY config_key");
  if (configs.success) {
    console.log('\n⚙️  System configs:');
    configs.result[0].results.forEach(r => console.log('   ', r.config_key, '=', r.config_value));
  }
}

main().catch(console.error);
