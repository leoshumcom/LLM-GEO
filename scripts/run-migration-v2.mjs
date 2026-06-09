// 直接执行 D1 迁移 — 每条完整的 CREATE TABLE 或 INSERT 作为独立语句
import { readFileSync } from 'fs';

const apiToken = process.env.CLOUDFLARE_API_TOKEN;
const accountId = 'aa42436ad09a92ec856aa353ae06b31e';
const databaseId = 'e65056f4-7ae1-4f1c-ac4c-94967875e80b';

// 读取 SQL 并按完整语句拆分（更精确）
const fullSql = readFileSync('migrations/0001_init.sql', 'utf-8');

// 提取所有 CREATE TABLE 语句（包含其后的索引）
const tableBlocks = [];
const insertBlocks = [];

// 按 CREATE TABLE + CREATE INDEX 和 INSERT 分组
const lines = fullSql.split('\n');
let currentBlock = '';
let inCreateTable = false;
let inInsert = false;

for (const line of lines) {
  const trimmed = line.trim();
  
  if (trimmed.startsWith('--') || trimmed === '' || trimmed.startsWith('/*')) {
    // 单独的注释行
    if (inCreateTable && !trimmed.startsWith('-- =')) {
      continue; // 跳过 CREATE TABLE 块内的注释
    }
    continue;
  }

  if (trimmed.toUpperCase().startsWith('CREATE TABLE')) {
    if (currentBlock) {
      tableBlocks.push(currentBlock);
    }
    currentBlock = trimmed;
    inCreateTable = true;
    inInsert = false;
  } else if (trimmed.toUpperCase().startsWith('CREATE INDEX')) {
    // 索引语句跟在当前表后面
    currentBlock += ';\n' + trimmed;
  } else if (trimmed.toUpperCase().startsWith('INSERT')) {
    if (currentBlock && inCreateTable) {
      tableBlocks.push(currentBlock);
    }
    currentBlock = trimmed;
    inCreateTable = false;
    inInsert = true;
  } else if (inCreateTable) {
    currentBlock += '\n' + trimmed;
  } else if (inInsert) {
    currentBlock += '\n' + trimmed;
  }
}

if (currentBlock) {
  if (inCreateTable) tableBlocks.push(currentBlock);
  if (inInsert) insertBlocks.push(currentBlock);
}

const allStatements = [...tableBlocks, ...insertBlocks];
console.log(`Found ${tableBlocks.length} table statements and ${insertBlocks.length} insert statements`);

async function run() {
  let success = 0;
  let failed = 0;

  for (let i = 0; i < allStatements.length; i++) {
    let sql = allStatements[i].trim();
    // 确保以分号结尾
    if (!sql.endsWith(';')) sql += ';';
    
    // 跳过空语句
    if (!sql || sql === ';') continue;

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
      const firstLine = sql.split('\n')[0].substring(0, 50);
      process.stdout.write(`✅ ${firstLine}\n`);
    } else {
      failed++;
      const errMsg = data.errors?.[0]?.message || 'unknown error';
      const firstLine = sql.split('\n')[0].substring(0, 50);
      console.log(`❌ ${firstLine}: ${errMsg}`);
    }
  }

  console.log(`\n✅ Complete! ${success} succeeded, ${failed} failed`);
}

run().catch(console.error);
