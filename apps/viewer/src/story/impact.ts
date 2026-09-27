import type { LoadedIncident, LoadedWorld } from '../store';
import { keyMoments } from './moments';

/** Real numbers only: every field comes from the graph, Bob's recording, the investigation or a test run. */
export interface ImpactFacts {
  filesInCodebase: number;
  filesBobRead?: number;
  subagents?: number;
  hypothesesRuledOut: number;
  rootCauseAtMs?: number;
  runMs?: number;
  toolCalls?: number;
  bobcoins?: number;
  grounding: { score: number; grounded: number; weak: number; unverified: number; total: number };
  fixLinesChanged?: number;
  testsBefore?: { passed: number; failed: number; ref: string };
  testsAfter?: { passed: number; failed: number };
}

export function impactFacts(world: LoadedWorld, incident: LoadedIncident, baseline?: { ref: string; testsPassed: number; testsFailed: number }): ImpactFacts {
  const inv = incident.investigation;
  const rec = incident.recording;
  const files = new Set(world.graph.nodes.filter((n) => n.kind === 'file').map((n) => n.id));
  const read = rec ? new Set(rec.events.filter((e) => e.type === 'tool_use' && e.action === 'read').flatMap((e) => e.targets).filter((t) => files.has(t))) : undefined;
  const moments = rec ? keyMoments(rec) : [];
  const stats = rec?.result?.stats;
  const diffLines = inv.fix?.diff.split('\n').filter((l) => (l.startsWith('+') && !l.startsWith('+++')) || (l.startsWith('-') && !l.startsWith('---')));
  const plus = diffLines?.filter((l) => l.startsWith('+')).length ?? 0;
  const minus = diffLines?.filter((l) => l.startsWith('-')).length ?? 0;
  const v = inv.verification;
  const g = incident.grounding;
  return {
    filesInCodebase: world.graph.project.fileCount,
    filesBobRead: read?.size,
    subagents: rec ? rec.lanes.filter((l) => l.kind === 'subagent').length : undefined,
    hypothesesRuledOut: inv.ruledOut.length,
    rootCauseAtMs: moments.find((m) => m.id === 'rootcause')?.t,
    runMs: stats?.duration_ms,
    toolCalls: stats?.tool_calls,
    bobcoins: stats?.session_costs,
    grounding: { score: g.score, grounded: g.grounded, weak: g.weak, unverified: g.unverified, total: g.total },
    fixLinesChanged: diffLines ? Math.max(plus, minus) : undefined,
    testsBefore: baseline ? { passed: baseline.testsPassed, failed: baseline.testsFailed, ref: baseline.ref } : undefined,
    testsAfter: v?.status === 'passed' && v.testsPassed !== undefined ? { passed: v.testsPassed, failed: v.testsFailed ?? 0 } : undefined,
  };
}
