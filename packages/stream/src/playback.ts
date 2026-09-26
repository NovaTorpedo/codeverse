import type { Recording, RecEvent } from '@codeverse/schema';

export interface LaneState {
  id: string;
  label: string;
  kind: 'main' | 'subagent';
  subagentType?: string;
  active: boolean;
  /** Node the lane's probe is at, if any. */
  at?: string;
  action?: RecEvent['action'];
}

export interface PlaybackState {
  index: number;
  current?: RecEvent;
  visited: Set<string>;
  /** Targets touched by the current event. */
  active: string[];
  /** Files matched by the latest search result. */
  matched: string[];
  reasoning?: RecEvent;
  lanes: LaneState[];
  toolCalls: number;
  done: boolean;
}

export function duration(rec: Recording): number {
  return rec.events.at(-1)?.t ?? 0;
}

/** Index of the last event at or before time t (binary search). */
export function eventIndexAt(rec: Recording, t: number): number {
  let lo = 0;
  let hi = rec.events.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (rec.events[mid]!.t <= t) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}

/** Derived view of a recording at time t. Pure; safe to call every frame for moderate sizes. */
export function stateAt(rec: Recording, t: number): PlaybackState {
  const idx = eventIndexAt(rec, t);
  const visited = new Set<string>();
  const laneAt = new Map<string, { at?: string; action?: RecEvent['action'] }>();
  let reasoning: RecEvent | undefined;
  let matched: string[] = [];
  let toolCalls = 0;
  const open = new Set<string>(['main']);
  const actionOf = new Map<string, RecEvent['action']>();
  for (let i = 0; i <= idx; i++) {
    const ev = rec.events[i]!;
    if (ev.type === 'tool_use') {
      toolCalls++;
      if (ev.action !== 'search' && ev.action !== 'list') for (const x of ev.targets) visited.add(x);
      if (ev.targets.length) laneAt.set(ev.lane, { at: ev.targets[0], action: ev.action });
      matched = ev.action === 'search' || ev.action === 'list' ? ev.targets : [];
      if (ev.toolId) actionOf.set(ev.toolId, ev.action);
      if (ev.action === 'subagent' && ev.toolId) open.add(`sub:${ev.toolId}`);
    }
    if (ev.type === 'tool_result') {
      const a = ev.toolId ? actionOf.get(ev.toolId) : undefined;
      if (ev.targets.length && (a === 'search' || a === 'list')) matched = ev.targets;
      if (ev.toolId && open.has(`sub:${ev.toolId}`)) open.delete(`sub:${ev.toolId}`);
    }
    if (ev.type === 'message' && ev.role === 'assistant') reasoning = ev;
  }
  const current = idx >= 0 ? rec.events[idx] : undefined;
  const lanes: LaneState[] = rec.lanes.map((l) => ({
    id: l.id,
    label: l.label,
    kind: l.kind,
    subagentType: l.subagentType,
    active: open.has(l.id) || (l.kind === 'subagent' && l.endSeq === undefined && l.startSeq <= idx),
    at: laneAt.get(l.id)?.at,
    action: laneAt.get(l.id)?.action,
  }));
  return {
    index: idx,
    current,
    visited,
    active: current?.targets ?? [],
    matched,
    reasoning,
    lanes,
    toolCalls,
    done: idx === rec.events.length - 1,
  };
}

/** Human label for an event row in the flight recorder list. */
export function describeEvent(ev: RecEvent): string {
  const p = ev.parameters ?? {};
  const first = (k: string[]) => k.map((x) => p[x]).find((v) => typeof v === 'string') as string | undefined;
  switch (ev.type) {
    case 'message':
      return ev.isReasoning ? 'Thinking' : ev.role === 'user' ? 'Prompt' : 'Answer';
    case 'tool_use': {
      const arg = first(['path', 'file_path', 'relative_path', 'pattern', 'name_path', 'query', 'skill', 'description', 'command']);
      return `${ev.toolName ?? 'tool'}${arg ? ` · ${arg}` : ''}`;
    }
    case 'tool_result':
      return `${ev.status === 'success' || !ev.error ? 'Result' : 'Tool error'}${ev.targets.length ? ` · ${ev.targets.length} file${ev.targets.length > 1 ? 's' : ''}` : ''}`;
    case 'error':
      return `Limit reached${ev.error ? ` · ${ev.error}` : ''}`;
    case 'result':
      return `Finished · ${ev.status ?? ''}`;
    default:
      return `Event · ${ev.content ?? 'unknown'}`;
  }
}
