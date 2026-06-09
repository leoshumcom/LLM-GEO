// D1 迁移初始化脚本
// 将 0001_init.sql 中的每条语句逐个发送到 Cloudflare API

import { readFileSync, writeFileSync } from 'fs';

const sql = readFileSync('migrations/0001_init.sql', 'utf-8');

// 按分号拆分，过滤空语句和注释
const statements = sql
  .split(';')
  .map(s => s.trim())
  .filter(s => s && !s.startsWith('--') && !s.startsWith('/*'));

console.log(`Found ${statements.length} statements to execute`);

// 输出 JSON 格式供其他工具处理
const output = statements.map(s => ({ sql: s + ';' }));
writeFileSync('migrations/statements.json', JSON.stringify(output, null, 2));
console.log('Written to migrations/statements.json');
