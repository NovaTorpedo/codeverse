#!/usr/bin/env node
// Scans every blob reachable from any ref (full history) for secret patterns.
import { execFileSync } from 'node:child_process';
import { findSecrets } from './secret-patterns.mjs';

const git = (args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 });
let revs = '';
try { revs = git(['rev-list', '--all']).trim(); } catch { revs = ''; }
if (!revs) { console.log('[secrets] no commits yet'); process.exit(0); }
const blobs = new Map();
for (const line of git(['rev-list', '--all', '--objects']).split('\n')) {
  const [sha, ...rest] = line.split(' ');
  const path = rest.join(' ');
  if (sha && path && !blobs.has(sha)) blobs.set(sha, path);
}
const problems = [];
for (const [sha, path] of blobs) {
  if (/\.(png|jpe?g|gif|webp|ico|woff2?|ttf|pdf|mp4|glb)$/i.test(path)) continue;
  let type;
  try { type = git(['cat-file', '-t', sha]).trim(); } catch { continue; }
  if (type !== 'blob') continue;
  const text = git(['cat-file', '-p', sha]);
  for (const hit of findSecrets(text)) problems.push(`${path} (blob ${sha.slice(0, 8)}):${hit.line} ${hit.id}`);
}
// Commit metadata is public too: author and committer emails must be no-reply addresses.
const NOREPLY = /(@users\.noreply\.github\.com|^noreply@github\.com|^noreply@anthropic\.com)$/i;
const emails = new Set(git(['log', '--all', '--format=%ae%n%ce%n%(trailers:key=Co-authored-by,valueonly)']).split('\n').map((l) => (l.match(/<([^>]+)>/)?.[1] ?? l).trim()).filter(Boolean));
for (const e of emails) if (!NOREPLY.test(e)) problems.push(`commit metadata uses a non-noreply email (${e.replace(/^(.).*(@.*)$/, '$1…$2')})`);
if (problems.length) { console.error('[secrets] findings in history:\n  ' + problems.join('\n  ')); process.exit(1); }
console.log(`[secrets] ok (${blobs.size} objects scanned across full history)`);
