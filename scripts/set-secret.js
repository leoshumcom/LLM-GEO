const ACCOUNT_ID = 'aa42436ad09a92ec856aa353ae06b31e';
const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const jwtSecret = 'llmgeo_jwt_' + crypto.randomUUID().replace(/-/g, '');

async function main() {
  // Try PATCH first
  let r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/scripts/llmgeo/secrets`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'JWT_SECRET', type: 'secret_text', value: jwtSecret })
  });
  let d = await r.json();
  if (d.success) {
    console.log('✅ JWT_SECRET updated via PATCH');
    process.exit(0);
  }

  // Try DELETE first then PUT
  r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/scripts/llmgeo/secrets/JWT_SECRET`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${TOKEN}` }
  });
  d = await r.json();
  console.log('DELETE:', d.success ? '✅' : '❌', d.errors?.[0]?.message || '');

  // PUT new secret
  r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/scripts/llmgeo/secrets`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'JWT_SECRET', type: 'secret_text', value: jwtSecret })
  });
  d = await r.json();
  console.log('PUT:', d.success ? '✅' : '❌', d.errors?.[0]?.message || '');
  if (d.success) {
    console.log('JWT_SECRET =', jwtSecret);
  }
}
main().catch(e => console.error(e));
