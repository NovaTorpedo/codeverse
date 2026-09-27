#!/usr/bin/env node
// Local production preview of the static export, sending the same headers Render sends (from render.yaml).
// Binds to 127.0.0.1 only. Usage: node scripts/serve-static.mjs [--port 4173] [--dir apps/viewer/out]
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { parseRenderHeaders, pathMatches } from './security-headers.mjs';

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : dflt;
};
const root = path.resolve(arg('dir', 'apps/viewer/out'));
const port = Number(arg('port', '4173'));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.txt': 'text/plain', '.woff2': 'font/woff2' };

// render.yaml is read on every request so a rebuild + `npm run render:headers` needs no restart.
// HSTS is dropped locally (plain http on 127.0.0.1).
function headersFor(pathname) {
  const file = path.resolve('render.yaml');
  if (!existsSync(file)) throw new Error('render.yaml not found (run from the repo root)');
  const h = {};
  for (const rule of parseRenderHeaders(readFileSync(file, 'utf8'))) {
    if (rule.name !== 'Strict-Transport-Security' && pathMatches(rule.path, pathname)) h[rule.name] = rule.value;
  }
  return h;
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.join(root, path.normalize(rel).replace(/^([/\\])+/, ''));
  if (!file.startsWith(root)) {
    res.writeHead(403).end();
    return;
  }
  let target = file;
  if (!existsSync(target) && existsSync(`${file}.html`)) target = `${file}.html`;
  if (!existsSync(target) || statSync(target).isDirectory()) {
    target = path.join(root, '404.html');
    res.statusCode = 404;
  }
  for (const [k, v] of Object.entries(headersFor(url.pathname))) res.setHeader(k, v);
  res.setHeader('Content-Type', TYPES[path.extname(target)] ?? 'application/octet-stream');
  res.end(readFileSync(target));
});
server.listen(port, '127.0.0.1', () => console.log(`[preview] http://127.0.0.1:${port} serving ${path.relative(process.cwd(), root)} with render.yaml headers`));
