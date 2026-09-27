#!/usr/bin/env node
// After `next build` (static export): hash every inline <script>, add a strict CSP <meta> to each page,
// write out/_headers (local preview, Cloudflare Pages) and keep render.yaml's CSP in step with the build.
//
// Render serves headers from render.yaml, which is committed, so its CSP carries the script hashes of the
// committed source (`npm run render:headers` refreshes them; the build id is pinned so they stay stable).
// If a build ever produces different inline scripts than render.yaml allows (a different OS or toolchain),
// the inline scripts are moved into same-origin files instead, which the header's 'self' still allows:
// the site keeps working under the same strict policy and never needs 'unsafe-inline'.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCsp, CACHE_RULES, metaCsp, parseRenderHeaders, RENDER_BEGIN, RENDER_END, renderHeaderBlock, scriptHashesIn, SECURITY_HEADERS } from './security-headers.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(process.argv[2] ?? path.join(repoRoot, 'apps/viewer/out'));
const renderFile = path.join(repoRoot, 'render.yaml');
const syncRender = process.env.CODEVERSE_RENDER_SYNC === '1';
const forceExternal = process.env.CODEVERSE_CSP_EXTERNAL === '1';

const walk = (d) => readdirSync(d).flatMap((n) => (statSync(path.join(d, n)).isDirectory() ? walk(path.join(d, n)) : [path.join(d, n)]));
const pages = walk(out).filter((f) => f.endsWith('.html'));
const INLINE = /<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g;
const sha = (s, enc) => createHash('sha256').update(s, 'utf8').digest(enc);

const hashes = new Set();
for (const file of pages) {
  for (const m of readFileSync(file, 'utf8').matchAll(INLINE)) if (m[2]) hashes.add(`'sha256-${sha(m[2], 'base64')}'`);
}
const built = [...hashes].sort();

let external = forceExternal;
if (syncRender) {
  const yaml = readFileSync(renderFile, 'utf8');
  const start = yaml.indexOf(RENDER_BEGIN);
  const end = yaml.indexOf(RENDER_END);
  if (start < 0 || end < start) throw new Error('render.yaml: generated header markers not found');
  const lineStart = yaml.lastIndexOf('\n', start) + 1;
  const indent = yaml.slice(lineStart, start);
  writeFileSync(renderFile, yaml.slice(0, lineStart) + renderHeaderBlock(built, indent) + yaml.slice(end + RENDER_END.length));
  console.log(`[csp] render.yaml headers updated (${built.length} script hash(es))`);
} else if (existsSync(renderFile)) {
  const cspHeader = parseRenderHeaders(readFileSync(renderFile, 'utf8')).find((h) => h.name === 'Content-Security-Policy');
  const allowed = new Set(cspHeader ? scriptHashesIn(cspHeader.value) : []);
  if (!built.every((h) => allowed.has(h))) {
    external = true;
    console.warn('[csp] this build has inline scripts render.yaml does not list: moving them to same-origin files (run `npm run render:headers` to refresh the hashes)');
  }
}

let moved = 0;
if (external) {
  const dir = path.join(out, '_next', 'static', 'inline');
  mkdirSync(dir, { recursive: true });
  for (const file of pages) {
    const html = readFileSync(file, 'utf8').replace(INLINE, (_all, attrs, body) => {
      if (!body) return _all;
      const name = `${sha(body, 'hex').slice(0, 20)}.js`;
      writeFileSync(path.join(dir, name), body);
      moved++;
      return `<script${attrs} src="/_next/static/inline/${name}"></script>`;
    });
    writeFileSync(file, html);
  }
}
const scriptHashes = external ? [] : built;

for (const file of pages) {
  let html = readFileSync(file, 'utf8');
  html = html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, '');
  html = html.replace(/<head>/, `<head><meta http-equiv="Content-Security-Policy" content="${metaCsp(scriptHashes)}">`);
  writeFileSync(file, html);
}

const headerLines = [
  '/*',
  `  Content-Security-Policy: ${buildCsp(scriptHashes)}`,
  ...Object.entries(SECURITY_HEADERS).map(([k, v]) => `  ${k}: ${v}`),
  ...CACHE_RULES.flatMap((r) => [r.path, `  Cache-Control: ${r.value}`]),
];
writeFileSync(path.join(out, '_headers'), `${headerLines.join('\n')}\n`);
console.log(
  `[csp] ${pages.length} page(s), ${built.length} inline script hash(es)` +
    (external ? `, ${moved} inline script(s) moved to same-origin files` : ', all listed in render.yaml') +
    `; wrote meta CSP and ${path.relative(process.cwd(), path.join(out, '_headers'))}`,
);
