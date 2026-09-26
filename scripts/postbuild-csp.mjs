#!/usr/bin/env node
// After `next build` (static export): hash every inline <script>, add a strict CSP <meta> to each page,
// and write out/_headers (Cloudflare Pages / local preview) with the full header set.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const out = path.resolve(process.argv[2] ?? 'apps/viewer/out');
const walk = (d) => readdirSync(d).flatMap((n) => (statSync(path.join(d, n)).isDirectory() ? walk(path.join(d, n)) : [path.join(d, n)]));
const pages = walk(out).filter((f) => f.endsWith('.html'));

const hashes = new Set();
for (const file of pages) {
  const html = readFileSync(file, 'utf8');
  for (const m of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)) {
    hashes.add(`'sha256-${createHash('sha256').update(m[1], 'utf8').digest('base64')}'`);
  }
}

// three.js and React need neither eval nor inline scripts beyond the hashed Next bootstrap.
// Inline styles are required by framer-motion and drei <Html> positioning.
const directives = {
  'default-src': ["'self'"],
  'script-src': ["'self'", ...hashes],
  'style-src': ["'self'", "'unsafe-inline'"],
  'img-src': ["'self'", 'data:', 'blob:'],
  'font-src': ["'self'", 'data:'],
  'connect-src': ["'self'"],
  'worker-src': ["'self'", 'blob:'],
  'object-src': ["'none'"],
  'base-uri': ["'none'"],
  'form-action': ["'none'"],
  'frame-ancestors': ["'none'"],
};
const csp = Object.entries(directives)
  .map(([k, v]) => `${k} ${v.join(' ')}`)
  .join('; ');
const metaCsp = csp.replace(/; frame-ancestors [^;]+/, '');

for (const file of pages) {
  let html = readFileSync(file, 'utf8');
  html = html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, '');
  html = html.replace(/<head>/, `<head><meta http-equiv="Content-Security-Policy" content="${metaCsp}">`);
  writeFileSync(file, html);
}

export const HEADERS = {
  'Content-Security-Policy': csp,
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
};
writeFileSync(
  path.join(out, '_headers'),
  `/*\n${Object.entries(HEADERS)
    .map(([k, v]) => `  ${k}: ${v}`)
    .join('\n')}\n`,
);
console.log(`[csp] ${pages.length} page(s), ${hashes.size} inline script hash(es); wrote meta CSP and ${path.relative(process.cwd(), path.join(out, '_headers'))}`);
