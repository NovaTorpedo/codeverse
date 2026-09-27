import type { LoadedWorld } from '../store';

export interface TicketInfo {
  file: string;
  id: string;
  title: string;
  severity?: string;
  opened?: string;
}

export interface LogSignal {
  level: 'warn' | 'error';
  event: string;
  count: number;
  /** 1-based line of the first occurrence, for "show the code". */
  line: number;
}

/** Reads the incident ticket bundled with the world (first line "ID  Title", then "Severity: ..."). */
export function ticketOf(world: LoadedWorld): TicketInfo | undefined {
  const file = world.graph.assets?.map((a) => a.path).find((p) => /(^|\/)tickets\/[^/]+\.txt$/.test(p));
  const text = file ? world.graph.sources?.[file] : undefined;
  if (!file || !text) return undefined;
  const lines = text.split(/\r?\n/);
  const m = lines[0]?.match(/^(\S+)\s+(.+)$/);
  if (!m) return undefined;
  const sev = text.match(/Severity:\s*(SEV-\d)/)?.[1];
  const opened = text.match(/Opened:\s*([0-9-]+ [0-9:]+ UTC)/)?.[1];
  return { file, id: m[1]!, title: m[2]!.trim(), severity: sev, opened };
}

/** Warnings and errors in the bundled NDJSON logs, in order of first appearance. */
export function logSignals(world: LoadedWorld): { file: string; signals: LogSignal[] } | undefined {
  const file = world.graph.assets?.map((a) => a.path).find((p) => /(^|\/)logs\/[^/]+\.ndjson$/.test(p));
  const text = file ? world.graph.sources?.[file] : undefined;
  if (!file || !text) return undefined;
  const out = new Map<string, LogSignal>();
  text.split(/\r?\n/).forEach((line, i) => {
    try {
      const e = JSON.parse(line) as { level?: unknown; event?: unknown };
      if ((e.level === 'warn' || e.level === 'error') && typeof e.event === 'string') {
        const k = `${e.level}:${e.event}`;
        const prev = out.get(k);
        if (prev) prev.count++;
        else out.set(k, { level: e.level, event: e.event, count: 1, line: i + 1 });
      }
    } catch {
      // not a JSON line
    }
  });
  return { file, signals: [...out.values()] };
}
