import type { Recording } from '@codeverse/schema';
import { EMAIL, ENV_LINE, HOME_PATH, IBM_IDS, IPV4, IPV6, SECRET_PATTERNS, UUID } from './patterns';

export { SECRET_PATTERNS } from './patterns';

export interface ScrubOptions {
  /** Absolute path of the repository; rewritten to repo-relative paths. */
  repoRoot?: string;
  /** Extra literal terms to redact (usernames, hostnames, emails). */
  terms?: string[];
  /** Keep IP addresses such as 127.0.0.1 (never public ones). */
  keepLoopback?: boolean;
}

export type ScrubCounts = Record<string, number>;

/** Stable pseudonyms so identical ids (tool ids, task ids) stay linked after scrubbing. */
const pseudonyms = new WeakMap<ScrubCounts, Map<string, string>>();
function pseudonym(counts: ScrubCounts, value: string): string {
  let map = pseudonyms.get(counts);
  if (!map) {
    map = new Map();
    pseudonyms.set(counts, map);
  }
  let p = map.get(value.toLowerCase());
  if (!p) {
    p = `id-${map.size + 1}`;
    map.set(value.toLowerCase(), p);
  }
  return p;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function rootVariants(root: string): string[] {
  const fwd = root.replace(/\\/g, '/').replace(/\/+$/, '');
  const back = fwd.replace(/\//g, '\\');
  const variants = new Set([fwd, back, back.replace(/\\/g, '\\\\'), `file://${fwd}`, `file:///${fwd}`]);
  const drive = /^([A-Za-z]):/.exec(fwd);
  if (drive) variants.add(`/${drive[1]!.toLowerCase()}${fwd.slice(2)}`);
  return [...variants].sort((a, b) => b.length - a.length);
}

function redactEnvBlocks(text: string, counts: ScrubCounts): string {
  const lines = text.split('\n');
  const out: string[] = [];
  let run: string[] = [];
  const flush = () => {
    if (run.length >= 3) {
      out.push('[environment redacted]');
      counts.env = (counts.env ?? 0) + 1;
    } else out.push(...run);
    run = [];
  };
  for (const l of lines) {
    if (ENV_LINE.test(l)) run.push(l);
    else {
      flush();
      out.push(l);
    }
  }
  flush();
  return out.join('\n');
}

/** Scrubs one string. Order matters: secrets first, then paths, then personal data. */
export function scrubText(input: string, opts: ScrubOptions = {}, counts: ScrubCounts = {}): string {
  let s = input;
  const bump = (k: string) => (counts[k] = (counts[k] ?? 0) + 1);
  for (const { id, re } of SECRET_PATTERNS) s = s.replace(new RegExp(re.source, re.flags), () => (bump(`secret:${id}`), '[secret redacted]'));
  s = redactEnvBlocks(s, counts);
  if (opts.repoRoot) {
    for (const v of rootVariants(opts.repoRoot)) {
      s = s.replace(new RegExp(escapeRe(v) + '(?:\\\\\\\\|\\\\|/)?', 'gi'), () => (bump('repo-path'), ''));
    }
  }
  s = s.replace(HOME_PATH, () => (bump('home-path'), '~'));
  s = s.replace(EMAIL, () => (bump('email'), '[email]'));
  s = s.replace(IPV4, (m) => (opts.keepLoopback && (m === '127.0.0.1' || m === '0.0.0.0') ? m : (bump('ip'), '[ip]')));
  s = s.replace(IPV6, (m) => (m.split(':').filter(Boolean).length < 3 ? m : (bump('ip'), '[ip]')));
  for (const re of IBM_IDS) s = s.replace(new RegExp(re.source, re.flags), () => (bump('ibm-id'), '[id redacted]'));
  s = s.replace(UUID, (m) => (bump('uuid'), pseudonym(counts, m)));
  for (const t of opts.terms ?? []) {
    if (t.length < 3) continue;
    s = s.replace(new RegExp(`(?<![A-Za-z0-9])${escapeRe(t)}(?![A-Za-z0-9])`, 'gi'), () => (bump('term'), '[redacted]'));
  }
  return s;
}

function scrubValue(v: unknown, opts: ScrubOptions, counts: ScrubCounts): unknown {
  if (typeof v === 'string') return scrubText(v, opts, counts);
  if (Array.isArray(v)) return v.map((x) => scrubValue(x, opts, counts));
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v)) {
      if (k === '__proto__' || k === 'constructor') continue;
      out[k] = scrubValue(val, opts, counts);
    }
    return out;
  }
  return v;
}

/** Returns a scrubbed copy of a recording (every string field), marked `scrubbed: true`. */
export function scrubRecording(rec: Recording, opts: ScrubOptions = {}): { recording: Recording; counts: ScrubCounts } {
  const counts: ScrubCounts = {};
  const copy = scrubValue(rec, opts, counts) as Recording;
  copy.id = rec.id;
  copy.recordedAt = rec.recordedAt;
  copy.target = rec.target;
  if (copy.result?.stats && 'task_id' in copy.result.stats) copy.result.stats.task_id = '[task]';
  copy.scrubbed = true;
  return { recording: copy, counts };
}

/** Scrubs any JSON document (investigation, semantic layer, tour) the same way. */
export function scrubDocument<T>(doc: T, opts: ScrubOptions = {}): { doc: T; counts: ScrubCounts } {
  const counts: ScrubCounts = {};
  return { doc: scrubValue(doc, opts, counts) as T, counts };
}

/** Leak detector for the public build: returns human-readable findings. */
export function findLeaks(text: string, terms: string[] = []): string[] {
  const findings: string[] = [];
  for (const { id, re } of SECRET_PATTERNS) if (new RegExp(re.source, re.flags).test(text)) findings.push(`secret pattern ${id}`);
  const PLACEHOLDER_USERS = /[\\/](x|someone|alice|bob|user|example|runner)$/i;
  const homes = (text.match(new RegExp(HOME_PATH.source, 'g')) ?? []).filter((m) => !PLACEHOLDER_USERS.test(m));
  if (homes.length) findings.push(`home-directory path (${homes.length})`);
  const emails = (text.match(EMAIL) ?? []).filter((e) => !/@example\.(test|com|org)$/i.test(e));
  if (emails.length) findings.push(`email address (${emails.length})`);
  for (const t of terms) if (t.length >= 3 && new RegExp(`(?<![A-Za-z0-9])${escapeRe(t)}(?![A-Za-z0-9])`, 'i').test(text)) findings.push(`private term "${t.slice(0, 2)}…"`);
  return findings;
}
