import { Recording, SCHEMA_VERSION, type Lane, type RecEvent } from '@codeverse/schema';
import { filesInText, type GraphIndex, targetsForToolUse } from './mapper';
import { LineSplitter, parseLine } from './ndjson';
import { explicitLane, normalizeEvent } from './normalize';

export interface RecordingMeta {
  id: string;
  title: string;
  target: string;
  synthetic: boolean;
  source: Recording['source'];
  recordedAt?: string;
  command?: Recording['command'];
}

/**
 * Builds a Recording from Bob Shell stream-json lines as they arrive.
 * Subagent lanes: explicit parent/agent ids win; otherwise events between a
 * `spawn_subagent` call and its result go to the most recently opened lane.
 */
export class RecordingBuilder {
  private readonly splitter = new LineSplitter();
  readonly events: RecEvent[] = [];
  readonly lanes: Lane[] = [{ id: 'main', label: 'Bob', kind: 'main', startSeq: 0 }];
  private readonly openLanes: string[] = [];
  private readonly toolLane = new Map<string, string>();
  private startWall: number | undefined;
  private startStamp: number | undefined;
  result: Recording['result'];
  nonJsonLines = 0;

  constructor(
    private readonly index?: GraphIndex,
    private readonly now: () => number = () => Date.now(),
  ) {}

  /** Feed a raw stdout chunk. Returns the events completed by this chunk. */
  pushChunk(chunk: string): RecEvent[] {
    return this.splitter.push(chunk).flatMap((l) => this.pushLine(l));
  }

  end(): RecEvent[] {
    return this.splitter.flush().flatMap((l) => this.pushLine(l));
  }

  pushLine(line: string): RecEvent[] {
    const parsed = parseLine(line);
    if (!parsed.ok) {
      this.nonJsonLines++;
      return [];
    }
    return [this.pushObject(parsed.value)];
  }

  pushObject(raw: Record<string, unknown>): RecEvent {
    const t = this.offset(raw);
    const ev = normalizeEvent(raw, this.events.length, t);
    ev.lane = this.assignLane(raw, ev);
    if (this.index) {
      if (ev.type === 'tool_use') ev.targets = targetsForToolUse(this.index, ev);
      if (ev.type === 'tool_result') ev.targets = filesInText(this.index, ev.output);
    }
    if (ev.type === 'result') {
      const stats = raw.stats && typeof raw.stats === 'object' ? (raw.stats as Record<string, unknown>) : {};
      this.result = { status: ev.status ?? 'unknown', stats: pickStats(stats), last_message: ev.content };
    }
    this.events.push(ev);
    return ev;
  }

  private offset(raw: Record<string, unknown>): number {
    const stamp = typeof raw.timestamp === 'string' ? Date.parse(raw.timestamp) : NaN;
    if (!Number.isNaN(stamp)) {
      this.startStamp ??= stamp;
      return Math.max(0, stamp - this.startStamp);
    }
    const wall = this.now();
    this.startWall ??= wall;
    return Math.max(0, wall - this.startWall);
  }

  private assignLane(raw: Record<string, unknown>, ev: RecEvent): string {
    const explicit = explicitLane(raw);
    if (ev.type === 'tool_use' && ev.action === 'subagent' && ev.toolId) {
      const parent = explicit ?? this.openLanes.at(-1) ?? 'main';
      const id = `sub:${ev.toolId}`;
      const p = ev.parameters ?? {};
      const kind = typeof p.subagent_type === 'string' ? p.subagent_type : typeof p.type === 'string' ? p.type : undefined;
      const desc = typeof p.description === 'string' ? p.description : typeof p.message === 'string' ? p.message : typeof p.title === 'string' ? p.title : 'Subagent';
      this.lanes.push({ id, label: desc.slice(0, 200), kind: 'subagent', subagentType: kind?.slice(0, 40), startSeq: ev.seq });
      this.openLanes.push(id);
      this.toolLane.set(ev.toolId, parent);
      return parent;
    }
    if (ev.type === 'tool_result' && ev.toolId && this.openLanes.includes(`sub:${ev.toolId}`)) {
      const id = `sub:${ev.toolId}`;
      this.openLanes.splice(this.openLanes.indexOf(id), 1);
      const lane = this.lanes.find((l) => l.id === id);
      if (lane) lane.endSeq = ev.seq;
      return this.toolLane.get(ev.toolId) ?? 'main';
    }
    if (explicit) {
      if (!this.lanes.some((l) => l.id === explicit)) this.lanes.push({ id: explicit, label: explicit, kind: 'subagent', startSeq: ev.seq });
      return explicit;
    }
    if (ev.type === 'tool_result' && ev.toolId && this.toolLane.has(ev.toolId)) return this.toolLane.get(ev.toolId)!;
    const lane = ev.type === 'result' ? 'main' : (this.openLanes.at(-1) ?? 'main');
    if (ev.type === 'tool_use' && ev.toolId) this.toolLane.set(ev.toolId, lane);
    return lane;
  }

  build(meta: RecordingMeta): Recording {
    return Recording.parse({
      schemaVersion: SCHEMA_VERSION,
      kind: 'codeverse.recording',
      id: meta.id,
      title: meta.title,
      synthetic: meta.synthetic,
      scrubbed: false,
      source: meta.source,
      recordedAt: meta.recordedAt ?? new Date().toISOString(),
      target: meta.target,
      command: meta.command ?? { disabledToolGroups: [] },
      lanes: this.lanes,
      events: this.events,
      result: this.result,
    });
  }
}

function pickStats(s: Record<string, unknown>) {
  const out: Record<string, number | string> = {};
  for (const [k, v] of Object.entries(s)) {
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
    else if (k === 'task_id' && typeof v === 'string') out[k] = v.slice(0, 200);
  }
  return out;
}

export function recordingFromNdjson(text: string, meta: RecordingMeta, index?: GraphIndex): Recording {
  const b = new RecordingBuilder(index);
  b.pushChunk(text);
  b.end();
  return b.build(meta);
}
