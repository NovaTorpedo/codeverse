#!/usr/bin/env node
// Proves the Phase 2 prompts folder can be deleted: moves it away, runs tests and a build, restores it.
import { execSync } from 'node:child_process';
import { existsSync, renameSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const folder = 'bob-prompts';
const parked = path.join(os.tmpdir(), `codeverse-parked-${process.pid}`);
const moved = existsSync(folder);
if (moved) renameSync(folder, parked);
let ok = false;
try {
  execSync('npm test', { stdio: 'inherit' });
  execSync('npm run build:preview', { stdio: 'inherit' });
  ok = true;
} finally {
  if (moved) renameSync(parked, folder);
}
console.log(ok ? '[disposable] tests and build pass without the prompts folder' : '[disposable] FAILED');
process.exit(ok ? 0 : 1);
