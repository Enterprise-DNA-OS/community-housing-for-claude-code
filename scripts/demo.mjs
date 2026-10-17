#!/usr/bin/env node
// Demo always uses its own embedded database, never the configured team database.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { REPO_ROOT } from './lib/db.mjs';

const env = { ...process.env, DATABASE_URL: '', DATA_DIR: path.join(REPO_ROOT, '.data/demo') };
for (const args of [['migrate.mjs'], ['seed.mjs'], ['housing.mjs', 'attention'], ['housing.mjs', 'arrears'], ['housing.mjs', 'kpis']]) {
  if (args[0] === 'housing.mjs') console.log(`\n== ${args[1]}\n`);
  const result = spawnSync(process.execPath, [path.join(REPO_ROOT, 'scripts', args[0]), ...args.slice(1)], { cwd: REPO_ROOT, env, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log('\nDemo database: .data/demo. Set DATA_DIR=.data/demo to explore these fictional records with any command.');
