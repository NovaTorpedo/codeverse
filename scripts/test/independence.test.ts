import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The Phase 2 prompts folder is disposable: nothing may import, read or build from it.
const ALLOWED_MENTIONS = new Set(['.gitignore', '.bobignore', 'eslint.config.js', 'scripts/guard.mjs', 'scripts/test/independence.test.ts', 'scripts/verify-disposable.mjs']);
const FOLDER = ['bob', 'prompts'].join('-');

function trackedAndUntracked(): string[] {
  const out = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' });
  return out.split('\0').filter(Boolean);
}

describe('disposable prompts folder', () => {
  it('is not referenced by any project file', () => {
    const offenders = trackedAndUntracked().filter((f) => {
      if (ALLOWED_MENTIONS.has(f) || /\.(png|jpe?g|ico|woff2?)$/i.test(f)) return false;
      try {
        return readFileSync(f, 'utf8').includes(FOLDER);
      } catch {
        return false;
      }
    });
    expect(offenders).toEqual([]);
  });
});

describe('local-only folders', () => {
  it('are ignored by git', () => {
    for (const p of ['private/x', `${FOLDER}/x`, '.codeverse/raw/x', '.env']) {
      const res = execFileSync('git', ['check-ignore', '-q', p, '--no-index'], { encoding: 'utf8', stdio: 'pipe' });
      expect(res).toBe('');
    }
  });
});
