import type { Recording, RecEvent } from '@codeverse/schema';

export type MomentId = 'start' | 'ticket' | 'logs' | 'subagents' | 'verify' | 'rootcause' | 'blocked' | 'done';

/** A key moment in a recorded Bob session, derived from the events themselves (never hand-placed). */
export interface Moment {
  id: MomentId;
  seq: number;
  t: number;
  title: string;
  /** Bob's own words or the numbers behind the moment. */
  detail?: string;
  count?: number;
}

const pathParam = (ev: RecEvent): string => {
  const p = ev.parameters ?? {};
  const v = [p.path, p.file_path, p.relative_path].find((x) => typeof x === 'string');
  return typeof v === 'string' ? v.replace(/\\/g, '/') : '';
};

/** Plain first sentence of an assistant message: markdown and code marks stripped, capped. */
export function firstSentence(text: string, max = 200): string {
  const clean = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[*_#>`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const m = clean.match(/^(.+?[.!?])(\s|$)/);
  const s = m ? m[1]! : clean;
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

/** The sentence after "Root cause …:" when Bob states it, else the message's first sentence. */
function rootCauseSentence(text: string): string {
  const flat = text.replace(/[*_`]/g, '').replace(/\s+/g, ' ');
  const m = flat.match(/root cause[^:]{0,40}:\s*(.+?[.!?])(\s|$)/i);
  const s = m ? m[1]! : firstSentence(text);
  return s.length > 220 ? `${s.slice(0, 219).trimEnd()}…` : s;
}

export function keyMoments(rec: Recording): Moment[] {
  const ev = rec.events;
  const out: Moment[] = [];
  const add = (m: Moment) => {
    if (!out.some((x) => x.id === m.id)) out.push(m);
  };
  const first = ev[0];
  if (first) add({ id: 'start', seq: first.seq, t: first.t, title: 'Bob receives the incident', detail: first.role === 'user' && first.content ? firstSentence(first.content, 160) : undefined });

  const actionByTool = new Map<string, RecEvent['action']>();
  for (const e of ev) if (e.type === 'tool_use' && e.toolId) actionByTool.set(e.toolId, e.action);

  const ticket = ev.find((e) => e.type === 'tool_use' && e.action === 'read' && /(^|\/)tickets\//.test(pathParam(e)));
  if (ticket) add({ id: 'ticket', seq: ticket.seq, t: ticket.t, title: 'Reads the incident ticket', detail: pathParam(ticket).split('/').pop() });
  const logs = ev.find((e) => e.type === 'tool_use' && e.action === 'read' && /(^|\/)logs\//.test(pathParam(e)));
  if (logs) add({ id: 'logs', seq: logs.seq, t: logs.t, title: 'Reads the production logs', detail: pathParam(logs).split('/').pop() });

  const sub = ev.find((e) => e.type === 'tool_use' && e.action === 'subagent');
  if (sub) {
    const burst = ev.filter((e) => e.type === 'tool_use' && e.action === 'subagent' && Math.abs(e.t - sub.t) < 2000).length;
    add({ id: 'subagents', seq: sub.seq, t: sub.t, count: burst, title: burst > 1 ? `Sends ${burst} subagents to check the suspects in parallel` : 'Sends a subagent to check a suspect' });
  }

  const after = sub ? sub.seq : 0;
  const reads = ev.filter((e) => e.seq > after && e.type === 'tool_use' && e.action === 'read' && e.targets.length > 0);
  const rootcause = ev.find((e) => e.seq > after && e.type === 'message' && e.role === 'assistant' && !e.isReasoning && /root cause/i.test(e.content ?? ''));
  const verifyReads = reads.filter((e) => !rootcause || e.seq < rootcause.seq);
  if (verifyReads[0]) {
    const files = new Set(verifyReads.flatMap((e) => e.targets));
    add({ id: 'verify', seq: verifyReads[0].seq, t: verifyReads[0].t, count: files.size, title: `Reads the ${files.size} suspect files itself` });
  }
  if (rootcause) add({ id: 'rootcause', seq: rootcause.seq, t: rootcause.t, title: 'States the root cause', detail: rootCauseSentence(rootcause.content ?? '') });

  const blocked = ev.filter((e) => e.type === 'tool_result' && e.status === 'error' && e.toolId && actionByTool.get(e.toolId) === 'write');
  if (blocked[0]) add({ id: 'blocked', seq: blocked[0].seq, t: blocked[0].t, count: blocked.length, title: 'Tries to save its report: the read-only mode blocks the write', detail: `${blocked.length} write attempt${blocked.length > 1 ? 's' : ''} blocked by the CodeVerse Cartographer mode` });

  const done = [...ev].reverse().find((e) => e.type === 'result');
  if (done) {
    const s = rec.result?.stats;
    const bits = [s?.tool_calls !== undefined ? `${s.tool_calls} tool calls` : '', s?.session_costs !== undefined ? `${s.session_costs.toFixed(2)} Bobcoins` : ''].filter(Boolean);
    add({ id: 'done', seq: done.seq, t: done.t, title: 'Finishes the investigation', detail: bits.join(' · ') || undefined });
  }
  return out.sort((a, b) => a.seq - b.seq);
}

/** The latest moment at or before event index `seq`. */
export function momentAt(moments: Moment[], seq: number): Moment | undefined {
  let cur: Moment | undefined;
  for (const m of moments) if (m.seq <= seq) cur = m;
  return cur;
}

/**
 * Story pace: the real recording runs 8+ minutes, mostly waiting on the model. Story time keeps every event in
 * order but caps each quiet gap and adds a short hold on key moments, so the whole session plays in `targetMs`.
 * Knots map story time to real time piecewise-linearly (holds are flat).
 */
export interface StoryClock {
  total: number;
  toReal(story: number): number;
  toStory(real: number): number;
}

const HOLD: Partial<Record<MomentId, number>> = { subagents: 3200, rootcause: 2800, blocked: 2000 };

export function storyClock(rec: Recording, targetMs = 34_000, holdMs = 1600): StoryClock {
  const times = [...new Set(rec.events.map((e) => e.t))].sort((a, b) => a - b);
  const holds = new Map<number, number>();
  for (const m of keyMoments(rec)) holds.set(m.t, Math.max(holds.get(m.t) ?? 0, HOLD[m.id] ?? holdMs));
  if (times.length < 2) return { total: 0, toReal: () => times[0] ?? 0, toStory: () => 0 };
  const build = (cap: number) => {
    const knots: Array<[number, number]> = [[0, times[0]!]];
    let s = 0;
    for (let i = 0; i < times.length; i++) {
      const r = times[i]!;
      if (i > 0) {
        s += Math.min(r - times[i - 1]!, cap);
        knots.push([s, r]);
      }
      const hold = holds.get(r);
      if (hold) {
        s += hold;
        knots.push([s, r]);
      }
    }
    return knots;
  };
  // Binary-search the gap cap so the story lasts about targetMs.
  let lo = 50;
  let hi = Math.max(60_000, times.at(-1)! - times[0]!);
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (build(mid).at(-1)![0] > targetMs) hi = mid;
    else lo = mid;
  }
  const knots = build(lo);
  const total = knots.at(-1)![0];
  const toReal = (story: number) => {
    const s = Math.max(0, Math.min(total, story));
    for (let i = 1; i < knots.length; i++) {
      const [s1, r1] = knots[i]!;
      if (s <= s1) {
        const [s0, r0] = knots[i - 1]!;
        return s1 === s0 ? r1 : r0 + ((s - s0) / (s1 - s0)) * (r1 - r0);
      }
    }
    return knots.at(-1)![1];
  };
  const toStory = (real: number) => {
    for (let i = 1; i < knots.length; i++) {
      const [s1, r1] = knots[i]!;
      if (real <= r1) {
        const [s0, r0] = knots[i - 1]!;
        return r1 === r0 ? s0 : s0 + ((real - r0) / (r1 - r0)) * (s1 - s0);
      }
    }
    return total;
  };
  return { total, toReal, toStory };
}

export const fmtClock = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
