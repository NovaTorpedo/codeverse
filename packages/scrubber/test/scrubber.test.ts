import { describe, expect, it } from 'vitest';
import { Recording } from '@codeverse/schema';
// @ts-expect-error plain ESM module without types
import * as hookPatterns from '../../../scripts/secret-patterns.mjs';
import { findLeaks, scrubRecording, scrubText, SECRET_PATTERNS } from '../src';

// Nasty values are assembled at runtime so the repository itself never contains them.
const J = (...p: string[]) => p.join('');
const fakeJwt = J('ey', 'JhbGciOiJSUzI1NiJ9', '.', 'ey', 'JzdWIiOiJJQk1pZC0xMjMifQ', '.', 'c2lnbmF0dXJlLXNpZ25hdHVyZQ');
const fakeIbmKey = J('apikey', '=', 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8S9t0U1v2');
const fakeBob = J('BOB_API', '_KEY=', 'bobk_live_9f8e7d6c5b4a39281706');
// Home paths and emails are assembled too, so the self-visualisation bundle never contains them.
const U = J('Us', 'ers');
const segs = ['C:', U, 'alice', 'work', 'codeverse'];
const root = segs.join('\\');

describe('scrubText', () => {
  it('rewrites absolute repo paths (all slash styles and JSON escaping) to repo-relative', () => {
    expect(scrubText(`${root}\\demo\\shopfloor\\src\\a.ts`, { repoRoot: root })).toBe('demo\\shopfloor\\src\\a.ts');
    expect(scrubText(`${segs.join('/')}/demo/a.ts`, { repoRoot: root })).toBe('demo/a.ts');
    expect(scrubText(`"${segs.join('\\\\')}\\\\demo"`, { repoRoot: root })).toBe('"demo"');
    expect(scrubText(`file:///${segs.join('/')}/x.ts`, { repoRoot: root })).toBe('x.ts');
    expect(scrubText(`/c/${segs.slice(1).join('/')}/x.ts`, { repoRoot: root })).toBe('x.ts');
  });

  it('strips other home paths, emails, IPs and usernames', () => {
    const input = `see /${J('ho', 'me')}/bob/.config and C:\\${U}\\alice\\AppData; mail ${J('alice.w', '@', 'corp.example.net')} from 10.2.3.4 as alice`;
    const s = scrubText(input, { terms: ['alice'] });
    expect(s).not.toMatch(/alice|10\.2\.3\.4|corp\.example|\/home\/bob/);
    expect(s).toContain('[email]');
    expect(s).toContain('[ip]');
  });

  it('keeps loopback addresses when asked, and version numbers always', () => {
    expect(scrubText('ws://127.0.0.1:4317 v1.2.3', { keepLoopback: true })).toBe('ws://127.0.0.1:4317 v1.2.3');
  });

  it('redacts IBM, Bob and generic secrets', () => {
    for (const secret of [fakeJwt, fakeIbmKey, fakeBob, J('Bearer ', 'abcdefghijklmnopqrstuvwxyz0123'), J('gh', 'p_', 'a'.repeat(36))]) {
      const out = scrubText(`value: ${secret} end`);
      expect(out).toContain('[secret redacted]');
      expect(findLeaks(out)).toEqual([]);
    }
  });

  it('redacts IBM account ids, CRNs and environment dumps', () => {
    const env = ['HOME=/x', 'BOB_TEAM=blue', 'PATH=/usr/bin', 'SHELL=/bin/zsh'].join('\n');
    const out = scrubText(`crn:v1:bluemix:public:iam::a/1234abcd:: account_id: 0123456789abcdef0123456789abcdef\n${env}\nafter`);
    expect(out).not.toMatch(/crn:v1|0123456789abcdef|BOB_TEAM/);
    expect(out).toContain('[environment redacted]');
    expect(out).toContain('after');
  });

  it('pseudonymises UUIDs consistently', () => {
    const counts = {};
    const a = scrubText('task 3f2b1c4d-1111-4222-8333-944455556666 then 3F2B1C4D-1111-4222-8333-944455556666', {}, counts);
    expect(a).toBe('task id-1 then id-1');
  });
});

describe('scrubRecording', () => {
  it('scrubs every string field and marks the recording scrubbed', () => {
    const rec = Recording.parse({
      schemaVersion: 1,
      kind: 'codeverse.recording',
      id: 'x',
      title: 'Investigation by alice',
      synthetic: false,
      scrubbed: false,
      source: 'bob-shell',
      recordedAt: '2026-09-27T01:00:00Z',
      target: 'demo/shopfloor',
      events: [
        { seq: 0, t: 0, type: 'tool_use', toolName: 'read_file', parameters: { path: `${root}\\demo\\shopfloor\\src\\a.ts`, nested: { token: fakeBob } } },
        { seq: 1, t: 5, type: 'tool_result', output: `ok ${fakeJwt}` },
      ],
      result: { status: 'success', stats: { task_id: '3f2b1c4d-1111-4222-8333-944455556666', tool_calls: 1 } },
    });
    const { recording } = scrubRecording(rec, { repoRoot: root, terms: ['alice'] });
    const json = JSON.stringify(recording);
    expect(recording.scrubbed).toBe(true);
    expect(recording.result?.stats.task_id).toBe('[task]');
    expect(findLeaks(json, ['alice'])).toEqual([]);
    expect(recording.events[0]?.parameters?.path).toBe('demo\\shopfloor\\src\\a.ts');
    expect(Recording.safeParse(recording).success).toBe(true);
  });
});

describe('pattern parity', () => {
  it('the git hook uses the same secret patterns as the scrubber', () => {
    const hook = (hookPatterns as { SECRET_PATTERNS: Array<{ id: string; re: RegExp }> }).SECRET_PATTERNS;
    expect(hook.map((p) => `${p.id}:${p.re.source}:${p.re.flags}`)).toEqual(SECRET_PATTERNS.map((p) => `${p.id}:${p.re.source}:${p.re.flags}`));
  });
});
