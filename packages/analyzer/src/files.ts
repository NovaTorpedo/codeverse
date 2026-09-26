import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

export const SOURCE_EXT = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'];

const SKIP_DIRS = new Set([
  'node_modules', '.git', '.next', 'out', 'dist', 'build', 'coverage', 'test-results', 'playwright-report',
  'private', 'bob-prompts', '.codeverse', '.vercel', '.turbo', '.bob',
]);

export const toPosix = (p: string) => p.split(path.sep).join('/');

/** Lists source files under `dir`, sorted, skipping build output, dependencies and local-only folders. */
export function listSourceFiles(dir: string, extraSkip: string[] = []): string[] {
  const out: string[] = [];
  const skip = new Set([...SKIP_DIRS, ...extraSkip]);
  const walk = (d: string) => {
    for (const name of readdirSync(d).sort()) {
      const full = path.join(d, name);
      const st = statSync(full);
      if (st.isDirectory()) {
        if (!skip.has(name) && !name.startsWith('.')) walk(full);
        else if (name === '.github') walk(full);
      } else if (SOURCE_EXT.includes(path.extname(name)) && !name.endsWith('.d.ts') && st.size < 1_000_000) {
        out.push(full);
      }
    }
  };
  walk(dir);
  return out;
}

export function readText(file: string): string {
  return readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}

/** Counts non-blank, non-comment-only lines. */
export function countLoc(text: string): number {
  let loc = 0;
  let inBlock = false;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (inBlock) {
      if (line.includes('*/')) inBlock = false;
      continue;
    }
    if (line.startsWith('//')) continue;
    if (line.startsWith('/*')) {
      if (!line.includes('*/')) inBlock = true;
      continue;
    }
    loc++;
  }
  return loc;
}
