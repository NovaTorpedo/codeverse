#!/usr/bin/env node
// Repository guard: blocks local-only folders, non-allowlisted Markdown, secrets and personal data.
// Usage: node scripts/guard.mjs --staged | --all
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import os from 'node:os';
import { findSecrets } from './secret-patterns.mjs';

const mode = process.argv.includes('--all') ? 'all' : 'staged';
const git = (args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });

const files = (mode === 'staged'
  ? git(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'])
  : git(['ls-files', '-z'])
).split('\0').filter(Boolean);

const BLOCKED_PREFIXES = ['private/', 'bob-prompts/', '.codeverse/raw/', 'node_modules/', '.next/', 'out/', 'apps/viewer/public/data/'];
const MARKDOWN_ALLOW = [/^README\.md$/, /^AGENTS\.md$/, /^bob_sessions\//, /^\.bob\//];
const BINARY = /\.(png|jpe?g|gif|webp|ico|woff2?|ttf|pdf|mp4|glb)$/i;
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

function personalTerms() {
  const terms = new Set();
  const user = os.userInfo().username;
  if (user && user.length >= 3) terms.add(user.toLowerCase());
  try {
    const email = git(['config', 'user.email']).trim();
    if (email && !email.endsWith('users.noreply.github.com')) terms.add(email.toLowerCase());
  } catch {
    // no git email configured
  }
  const home = os.homedir().split('\\').join('/').toLowerCase();
  if (home.length > 3) terms.add(home);
  for (const t of (process.env.CODEVERSE_PRIVATE_TERMS || '').split(',')) if (t.trim()) terms.add(t.trim().toLowerCase());
  if (existsSync('private/leak-terms.txt')) {
    for (const t of readFileSync('private/leak-terms.txt', 'utf8').split(/\r?\n/)) {
      if (t.trim() && !t.startsWith('#')) terms.add(t.trim().toLowerCase());
    }
  }
  return [...terms];
}

const terms = process.env.CI ? [] : personalTerms();
const termRes = terms.map((t) => new RegExp(`(^|[^a-z0-9])${escapeRe(t)}([^a-z0-9]|$)`));
const problems = [];
let sessionShots = 0;

for (const f of files) {
  if (BLOCKED_PREFIXES.some((p) => f.startsWith(p))) { problems.push(`${f}: path is local-only and must never be committed`); continue; }
  if (/(^|\/)\.env(\.|$)/.test(f) && !f.endsWith('.env.example')) { problems.push(`${f}: env files must not be committed`); continue; }
  if (/\.mdx?$/i.test(f) && !MARKDOWN_ALLOW.some((re) => re.test(f))) { problems.push(`${f}: Markdown outside the allowlist (README.md, AGENTS.md, bob_sessions/, .bob/)`); continue; }
  if (f.startsWith('bob_sessions/')) {
    if (!/\.png$/i.test(f) && f !== 'bob_sessions/.gitkeep') problems.push(`${f}: bob_sessions/ holds PNG screenshots only`);
    else if (f !== 'bob_sessions/.gitkeep') sessionShots++;
    continue;
  }
  if (BINARY.test(f)) continue;
  let text;
  try {
    text = mode === 'staged' ? git(['show', `:${f}`]) : readFileSync(f, 'utf8');
  } catch {
    continue;
  }
  for (const hit of findSecrets(text)) problems.push(`${f}:${hit.line}: possible secret (${hit.id})`);
  const lower = text.toLowerCase().split('\\\\').join('/').split('\\').join('/');
  if (termRes.some((re) => re.test(lower))) problems.push(`${f}: contains a personal term (username, email or home path)`);
  if (f.startsWith('worlds/') && /"synthetic"\s*:\s*true/.test(text)) problems.push(`${f}: synthetic data inside a public world`);
}

if (sessionShots > 0 && mode === 'staged') {
  console.log(`\n[guard] ${sessionShots} screenshot(s) under bob_sessions/ staged. Check each one for emails, account IDs, tokens or local paths before committing.\n`);
}
if (problems.length) {
  console.error('[guard] blocked:\n  ' + [...new Set(problems)].join('\n  '));
  process.exit(1);
}
console.log(`[guard] ok (${files.length} file(s) checked, mode=${mode})`);
