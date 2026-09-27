import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { Recording } from '@codeverse/schema';
import { firstSentence, fmtClock, keyMoments, momentAt, storyClock } from './moments';

const repoRoot = path.resolve(__dirname, '../../../..');
const rec = Recording.parse(JSON.parse(readFileSync(path.join(repoRoot, 'worlds/shopfloor/recordings/payment-failed.recording.json'), 'utf8')));

describe('key moments of the real Bob Shell recording', () => {
  const moments = keyMoments(rec);
  const byId = new Map(moments.map((m) => [m.id, m]));

  it('finds every beat of the investigation in order, from the events alone', () => {
    expect(moments.map((m) => m.id)).toEqual(['start', 'ticket', 'logs', 'subagents', 'verify', 'rootcause', 'blocked', 'done']);
    for (let i = 1; i < moments.length; i++) expect(moments[i]!.seq).toBeGreaterThan(moments[i - 1]!.seq);
  });

  it('counts the parallel subagents and the blocked writes', () => {
    expect(byId.get('subagents')!.count).toBe(rec.lanes.filter((l) => l.kind === 'subagent').length);
    const blocked = byId.get('blocked')!;
    expect(blocked.count).toBeGreaterThan(0);
    expect(rec.events.find((e) => e.seq === blocked.seq)?.error).toMatch(/regex/);
  });

  it("quotes Bob's own root-cause sentence and the result stats", () => {
    const rc = byId.get('rootcause')!;
    expect(rc.detail).toMatch(/SSO/);
    expect(rc.detail!.length).toBeLessThanOrEqual(220);
    expect(byId.get('done')!.detail).toMatch(/38 tool calls · 2\.80 Bobcoins/);
  });

  it('resolves the moment at any event', () => {
    expect(momentAt(moments, 0)?.id).toBe('start');
    expect(momentAt(moments, byId.get('rootcause')!.seq + 1)?.id).toBe('rootcause');
  });
});

describe('story clock', () => {
  const clock = storyClock(rec, 34_000);
  it('plays the whole 8-minute session in about the target time', () => {
    expect(clock.total).toBeGreaterThan(30_000);
    expect(clock.total).toBeLessThan(38_000);
    expect(clock.toReal(0)).toBe(0);
    expect(clock.toReal(clock.total)).toBe(rec.events.at(-1)!.t);
  });

  it('is monotonic and round-trips real time', () => {
    let last = -1;
    for (let s = 0; s <= clock.total; s += 250) {
      const r = clock.toReal(s);
      expect(r).toBeGreaterThanOrEqual(last);
      last = r;
    }
    for (const e of rec.events) expect(Math.abs(clock.toReal(clock.toStory(e.t)) - e.t)).toBeLessThan(1);
  });
});

describe('text helpers', () => {
  it('takes a clean first sentence and formats clocks', () => {
    expect(firstSentence('**Root cause:** the `x` is null. More text.')).toBe('Root cause: the x is null.');
    expect(fmtClock(68_686)).toBe('1:09');
    expect(fmtClock(490_111)).toBe('8:10');
  });
});
