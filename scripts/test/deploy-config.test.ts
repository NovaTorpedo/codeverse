import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error plain ESM script without type declarations
import { buildCsp, CACHE_RULES, parseRenderHeaders, pathMatches, renderHeaderBlock, scriptHashesIn, SECURITY_HEADERS } from '../security-headers.mjs';

type Rule = { path: string; name: string; value: string };
const repoRoot = path.resolve(__dirname, '../..');
const renderYaml = readFileSync(path.join(repoRoot, 'render.yaml'), 'utf8');
const rules = parseRenderHeaders(renderYaml) as Rule[];

describe('render.yaml (Render static site)', () => {
  it('is a static site built with npm ci + the gated production build, publishing the export', () => {
    expect(renderYaml).toMatch(/type: web\s*\n\s*name: codeverse\s*\n\s*runtime: static/);
    expect(renderYaml).toMatch(/buildCommand: npm ci && npm run build\n/);
    expect(renderYaml).toMatch(/staticPublishPath: \.\/apps\/viewer\/out\n/);
    expect(renderYaml).not.toMatch(/envVars|NODE_VERSION|sync: false/);
  });

  it('sends every security header on every path, with the exact values the build uses', () => {
    for (const [name, value] of Object.entries(SECURITY_HEADERS as Record<string, string>)) {
      expect(rules.find((r) => r.path === '/*' && r.name === name)?.value, name).toBe(value);
    }
    for (const c of CACHE_RULES as Array<{ path: string; value: string }>) {
      expect(rules.find((r) => r.path === c.path && r.name === 'Cache-Control')?.value).toBe(c.value);
    }
  });

  it('has a strict CSP: hashed scripts only, no eval, no inline scripts, no framing', () => {
    const csp = rules.find((r) => r.path === '/*' && r.name === 'Content-Security-Policy')!.value;
    const hashes = scriptHashesIn(csp) as string[];
    expect(hashes.length).toBeGreaterThan(0);
    expect(csp).toBe(buildCsp(hashes));
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    const scriptSrc = csp.split(';').find((d) => d.trim().startsWith('script-src'))!;
    expect(scriptSrc).not.toMatch(/unsafe-inline|unsafe-eval|\*|https?:/);
  });

  it('round-trips the generated block and matches Render-style path globs', () => {
    const block = renderHeaderBlock(["'sha256-abc='"], '  ');
    expect((parseRenderHeaders(block) as Rule[]).length).toBe(1 + Object.keys(SECURITY_HEADERS).length + CACHE_RULES.length);
    expect(pathMatches('/*', '/')).toBe(true);
    expect(pathMatches('/*', '/data/worlds.json')).toBe(true);
    expect(pathMatches('/_next/static/chunks/*', '/_next/static/chunks/a.js')).toBe(true);
    expect(pathMatches('/_next/static/chunks/*', '/index.html')).toBe(false);
  });
});

describe('build output secret scan', () => {
  const script = path.join(repoRoot, 'scripts/check-output-secrets.mjs');
  const run = (cwd: string) => {
    try {
      execFileSync(process.execPath, [script, 'out'], { cwd, encoding: 'utf8', stdio: 'pipe', env: { ...process.env, CI: '1' } });
      return { code: 0, stderr: '' };
    } catch (e) {
      const err = e as { status: number; stderr: string };
      return { code: err.status, stderr: err.stderr };
    }
  };
  const site = (files: Record<string, string>, env?: string) => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'cv-out-'));
    mkdirSync(path.join(dir, 'out'));
    for (const [n, t] of Object.entries(files)) writeFileSync(path.join(dir, 'out', n), t);
    if (env) writeFileSync(path.join(dir, '.env'), env);
    return dir;
  };
  // Assembled at runtime so no key-shaped literal sits in this file.
  const fakeKey = ['9f8e7d6c', '5b4a3928', '17066f5e', '4d3c2b1a'].join('');

  it('passes a clean site', () => {
    const dir = site({ 'index.html': '<html>ok</html>', 'a.js': 'const x = 1;' });
    expect(run(dir).code).toBe(0);
    rmSync(dir, { recursive: true, force: true });
  });

  it('fails on an AssemblyAI-style key and on any .env value, without printing the value', () => {
    const dir = site({ 'a.js': `fetch(u, { headers: { authorization: "${fakeKey}" } })` });
    const r = run(dir);
    expect(r.code).toBe(1);
    expect(r.stderr).toMatch(/authorization-hex-key|32-hex/);
    expect(r.stderr).not.toContain(fakeKey);
    rmSync(dir, { recursive: true, force: true });

    const planted = ['correct', 'horse', 'battery', 'staple', '42'].join('-');
    const dir2 = site({ 'b.json': `{"note":"${planted}"}` }, `SOME_TOKEN = "${planted}"\r\n`);
    const r2 = run(dir2);
    expect(r2.code).toBe(1);
    expect(r2.stderr).toContain('.env:SOME_TOKEN');
    expect(r2.stderr).not.toContain(planted);
    rmSync(dir2, { recursive: true, force: true });
  });
});
