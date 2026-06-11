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
  // Insert roles
  const roles = [
    ['role_admin', 'admin', '总控管理员', '平台拥有者，唯一超级权限'],
    ['role_agent', 'agent', '代理商', '付费代理商，分销开户'],
    ['role_company', 'company', '企业用户', '租户，使用AI内容生成和发布服务'],
    ['role_operator', 'operator', '运营人员', '企业子账号，编辑查看权限'],
  ];

  for (const [id, code, name, desc] of roles) {
    const d = await q(`INSERT OR IGNORE INTO sys_role (id, code, name, description, created_at) VALUES ('${id}', '${code}', '${name}', '${desc}', datetime('now'))`);
    console.log(`${code}:`, d.success ? '✅' : '❌', d.errors?.[0]?.message || '');
  }

  // Verify
  const d = await q('SELECT id, code, name FROM sys_role');
  if (d.success) {
    console.log('\nRoles now:', JSON.stringify(d.result[0].results));
  }

  // Test FK constraint
  const testId = crypto.randomUUID();
  const d2 = await q(`INSERT INTO sys_user_role (id, user_id, user_type, role_id, created_at) VALUES ('${testId}', 'test-user', 'company', 'role_company', datetime('now'))`);
  console.log('\nFK test:', d2.success ? '✅' : '❌', d2.errors?.[0]?.message || '');

  // Clean up test data
  if (d2.success) {
    await q(`DELETE FROM sys_user_role WHERE id = '${testId}'`);
  }
}
main().catch(e => console.error(e));
