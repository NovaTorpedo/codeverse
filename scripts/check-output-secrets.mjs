#!/usr/bin/env node
// Last gate before anything ships: scans the built site for secrets and personal data.
// Fails on: secret patterns (incl. AssemblyAI keys), any value from a local .env file, bare 32-hex keys,
// and personal terms (username, home path, email, private/leak-terms.txt). Never prints a matched value.
// Usage: node scripts/check-output-secrets.mjs [apps/viewer/out]
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { personalTerms, termMatchers } from './personal-terms.mjs';
import { findSecrets } from './secret-patterns.mjs';

const out = path.resolve(process.argv[2] ?? 'apps/viewer/out');
if (!existsSync(out)) {
  console.error(`[check:output] ${out} does not exist; build first`);
  process.exit(1);
}
const BINARY = /\.(png|jpe?g|gif|webp|ico|woff2?|ttf|pdf|mp4|glb|wasm)$/i;
// Obviously fake hex literals that appear in bundled source (scrubber tests), not keys.
const HEX_ALLOW = new Set(['0123456789abcdef0123456789abcdef']);

/** Values from .env files next to the repo root (names only are ever reported). */
function envValues() {
  const found = [];
  for (const name of readdirSync('.').filter((n) => /^\.env(\..+)?$/.test(n) && n !== '.env.example')) {
    for (const line of readFileSync(name, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*(?:export\s+)?([^#=\s][^=]*?)\s*=\s*(.*?)\s*$/);
      if (!m) continue;
      const value = m[2].replace(/^(['"])(.*)\1$/, '$2');
      if (value.length >= 8) found.push({ key: `${name}:${m[1]}`, value });
    }
  }
  return found;
}

const walk = (d) => readdirSync(d).flatMap((n) => (statSync(path.join(d, n)).isDirectory() ? walk(path.join(d, n)) : [path.join(d, n)]));
const secrets = envValues();
const terms = personalTerms();
const hasPersonalTerm = termMatchers(terms);
const problems = [];
let scanned = 0;

for (const file of walk(out)) {
  if (BINARY.test(file)) continue;
  const rel = path.relative(out, file).split(path.sep).join('/');
  const text = readFileSync(file, 'utf8');
  scanned++;
  for (const hit of findSecrets(text)) problems.push(`${rel}:${hit.line}: secret pattern (${hit.id})`);
  for (const s of secrets) if (text.includes(s.value)) problems.push(`${rel}: contains the value of ${s.key}`);
  for (const m of text.matchAll(/(?<![A-Za-z0-9])[a-f0-9]{32}(?![A-Za-z0-9])/g)) {
    if (!HEX_ALLOW.has(m[0])) problems.push(`${rel}: 32-hex string that could be an API key (offset ${m.index})`);
  }
  if (terms.length && hasPersonalTerm(text)) problems.push(`${rel}: contains a personal term (username, email or home path)`);
}

if (problems.length) {
  console.error(`[check:output] blocked, the build output contains:\n  ${[...new Set(problems)].join('\n  ')}`);
  process.exit(1);
}
console.log(`[check:output] ok (${scanned} file(s), ${secrets.length} local .env value(s) and ${terms.length} personal term(s) checked)`);
