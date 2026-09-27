// Personal terms that must never be published: OS username, home path, git email, and the local
// private/leak-terms.txt list. Empty on CI and Render (their usernames are generic words like "render").
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import os from 'node:os';

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

export function personalTerms() {
  if (process.env.CI || process.env.RENDER) return [];
  const terms = new Set();
  const user = os.userInfo().username;
  if (user && user.length >= 3) terms.add(user.toLowerCase());
  try {
    const email = execFileSync('git', ['config', 'user.email'], { encoding: 'utf8' }).trim();
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

/** Word-bounded, case-insensitive matchers; backslash paths are normalised before matching. */
export function termMatchers(terms = personalTerms()) {
  const res = terms.map((t) => new RegExp(`(^|[^a-z0-9])${escapeRe(t)}([^a-z0-9]|$)`));
  return (text) => {
    const lower = text.toLowerCase().split('\\\\').join('/').split('\\').join('/');
    return res.some((re) => re.test(lower));
  };
}
