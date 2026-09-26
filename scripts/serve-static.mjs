#!/usr/bin/env node
// Local production preview of the static export, applying out/_headers exactly like the host would.
// Binds to 127.0.0.1 only. Usage: node scripts/serve-static.mjs [--port 4173] [--dir apps/viewer/out]
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : dflt;
};
const root = path.resolve(arg('dir', 'apps/viewer/out'));
const port = Number(arg('port', '4173'));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.txt': 'text/plain', '.woff2': 'font/woff2' };

function headers() {
  const f = path.join(root, '_headers');
  if (!existsSync(f)) return {};
  return Object.fromEntries(
    readFileSync(f, 'utf8')
      .split('\n')
      .filter((l) => /^\s+[\w-]+:/.test(l))
      .map((l) => {
        const i = l.indexOf(':');
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
      })
      .filter(([k]) => k !== 'Strict-Transport-Security'),
  );
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
  const h = headers();
  for (const [k, v] of Object.entries(h)) res.setHeader(k, v);
  res.setHeader('Content-Type', TYPES[path.extname(target)] ?? 'application/octet-stream');
  res.end(readFileSync(target));
});
server.listen(port, '127.0.0.1', () => console.log(`[preview] http://127.0.0.1:${port} serving ${path.relative(process.cwd(), root)}`));
