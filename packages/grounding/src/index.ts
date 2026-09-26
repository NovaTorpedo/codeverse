import type { AnalysisGraph, AnyDocument, Citation, GraphNode, Investigation, SemanticLayer, Tour } from '@codeverse/schema';

export type ClaimStatus = 'grounded' | 'weak' | 'unverified';
export type ClaimKind = 'citation' | 'service' | 'node' | 'edge' | 'diff';

export interface Claim {
  id: string;
  kind: ClaimKind;
  /** JSON path of the claim inside the document. */
  where: string;
  label: string;
  status: ClaimStatus;
  reason: string;
  citation?: Citation;
  /** Graph node ids to highlight (phantoms have none). */
  nodes: string[];
}

export interface GroundingReport {
  score: number;
  total: number;
  grounded: number;
  weak: number;
  unverified: number;
  claims: Claim[];
}

interface Ctx {
  graph: AnalysisGraph;
  nodes: Map<string, GraphNode>;
  fileLines: Map<string, number>;
  adjacency: Map<string, Set<string>>;
  claims: Claim[];
}

function makeCtx(graph: AnalysisGraph): Ctx {
  const nodes = new Map(graph.nodes.map((n) => [n.id, n]));
  const fileLines = new Map<string, number>();
  for (const n of graph.nodes) if (n.kind === 'file' && n.path) fileLines.set(n.path, n.lines);
  for (const a of graph.assets ?? []) fileLines.set(a.path, a.lines);
  const adjacency = new Map<string, Set<string>>();
  const link = (a: string, b: string) => {
    if (!adjacency.has(a)) adjacency.set(a, new Set());
    adjacency.get(a)!.add(b);
  };
  for (const e of graph.edges) {
    link(e.source, e.target);
    link(e.target, e.source);
  }
  return { graph, nodes, fileLines, adjacency, claims: [] };
}

const symbolMatches = (candidate: string, wanted: string) => {
  const norm = (s: string) => s.replace(/(::|#|\/)/g, '.').replace(/\(\)$/, '');
  const c = norm(candidate);
  const w = norm(wanted);
  return c === w || c.endsWith('.' + w) || w.endsWith('.' + c);
};

function checkCitation(ctx: Ctx, c: Citation, where: string, label?: string): Claim {
  const base = { id: `c${ctx.claims.length}`, kind: 'citation' as const, where, citation: c, label: label ?? formatCitation(c) };
  const lines = ctx.fileLines.get(c.file);
  if (lines === undefined) return push(ctx, { ...base, status: 'unverified', reason: `File ${c.file} does not exist in the analysed code`, nodes: [] });
  const node = ctx.nodes.get(c.file);
  const nodes = node ? [node.id] : [];
  if (c.line !== undefined && (c.line > lines || (c.endLine !== undefined && (c.endLine < c.line || c.endLine > lines)))) {
    return push(ctx, { ...base, status: 'unverified', reason: `Line ${c.line} is outside ${c.file} (${lines} lines)`, nodes });
  }
  if (c.symbol) {
    const sym = node?.symbols.find((s) => symbolMatches(s.name, c.symbol!));
    if (!sym) return push(ctx, { ...base, status: 'weak', reason: `File exists but symbol ${c.symbol} was not found in it`, nodes });
    if (c.line !== undefined && (c.line < sym.line - 2 || c.line > sym.endLine + 2)) {
      return push(ctx, { ...base, status: 'weak', reason: `Symbol ${sym.name} spans lines ${sym.line}-${sym.endLine}, cited line ${c.line}`, nodes });
    }
  }
  return push(ctx, { ...base, status: 'grounded', reason: c.symbol ? 'File, line and symbol verified' : c.line ? 'File and line verified' : 'File verified', nodes });
}

function push(ctx: Ctx, claim: Claim): Claim {
  ctx.claims.push(claim);
  return claim;
}

function resolveNode(ctx: Ctx, ref: string): GraphNode | undefined {
  return ctx.nodes.get(ref) ?? ctx.nodes.get(`svc:${ref}`) ?? [...ctx.nodes.values()].find((n) => n.kind === 'service' && n.label.toLowerCase() === ref.toLowerCase());
}

function checkNode(ctx: Ctx, ref: string, where: string, kind: 'service' | 'node', label: string): GraphNode | undefined {
  const n = resolveNode(ctx, ref);
  push(ctx, { id: `c${ctx.claims.length}`, kind, where, label, status: n ? 'grounded' : 'unverified', reason: n ? `${n.kind} ${n.id} exists` : `No ${kind} named ${ref} in the analysed code`, nodes: n ? [n.id] : [] });
  return n;
}

/** Are two nodes connected directly (grounded), via one intermediate (weak), or not at all? */
function connection(ctx: Ctx, a: string, b: string): ClaimStatus {
  if (a === b) return 'grounded';
  const na = ctx.adjacency.get(a);
  if (na?.has(b)) return 'grounded';
  for (const mid of na ?? []) if (ctx.adjacency.get(mid)?.has(b)) return 'weak';
  const sa = ctx.nodes.get(a)?.service;
  const sb = ctx.nodes.get(b)?.service;
  if (sa && sa === sb) return 'weak';
  return 'unverified';
}

function checkEdge(ctx: Ctx, from: string, to: string, where: string, label: string) {
  const a = resolveNode(ctx, from);
  const b = resolveNode(ctx, to);
  if (!a || !b) {
    push(ctx, { id: `c${ctx.claims.length}`, kind: 'edge', where, label, status: 'unverified', reason: `Endpoint ${!a ? from : to} does not exist`, nodes: [a?.id, b?.id].filter(Boolean) as string[] });
    return;
  }
  const status = connection(ctx, a.id, b.id);
  const reason = status === 'grounded' ? 'A static import or call edge connects these' : status === 'weak' ? 'Connected indirectly (one hop or same service)' : 'No static connection found between these';
  push(ctx, { id: `c${ctx.claims.length}`, kind: 'edge', where, label, status, reason, nodes: [a.id, b.id] });
}

/** Checks that every removed and context line of each hunk exists in the current file. */
function checkDiff(ctx: Ctx, diff: string, where: string) {
  const sources = ctx.graph.sources ?? {};
  const files = diff.split(/^--- /m).slice(1);
  files.forEach((chunk, i) => {
    const plus = /^\+\+\+ (?:b\/)?(\S+)/m.exec(chunk);
    const file = plus?.[1];
    if (!file) return;
    const text = sources[file];
    const lines = chunk.split('\n').filter((l) => /^[ -]/.test(l) && !l.startsWith('---')).map((l) => l.slice(1).trim()).filter(Boolean);
    let status: ClaimStatus;
    let reason: string;
    if (text === undefined) {
      status = ctx.fileLines.has(file) ? 'weak' : 'unverified';
      reason = ctx.fileLines.has(file) ? 'File exists; source not bundled to verify hunks' : `Diff targets missing file ${file}`;
    } else {
      const have = new Set(text.split('\n').map((l) => l.trim()));
      const missing = lines.filter((l) => !have.has(l));
      status = missing.length === 0 ? 'grounded' : missing.length <= Math.ceil(lines.length / 4) ? 'weak' : 'unverified';
      reason = missing.length === 0 ? 'Every context and removed line matches the current code' : `${missing.length} of ${lines.length} context lines not found`;
    }
    push(ctx, { id: `c${ctx.claims.length}`, kind: 'diff', where: `${where}[${i}]`, label: `Patch applies to ${file}`, status, reason, nodes: ctx.nodes.has(file) ? [file] : [] });
  });
}

export function formatCitation(c: Citation): string {
  return `${c.file}${c.line ? `:${c.line}${c.endLine && c.endLine !== c.line ? `-${c.endLine}` : ''}` : ''}${c.symbol ? ` (${c.symbol})` : ''}`;
}

function groundInvestigation(ctx: Ctx, d: Investigation) {
  d.rootCause.citations.forEach((c, i) => checkCitation(ctx, c, `rootCause.citations[${i}]`));
  d.failure.citations.forEach((c, i) => checkCitation(ctx, c, `failure.citations[${i}]`));
  d.executionPath.forEach((s, i) => {
    if (s.status === 'not-reached' && !s.line && !s.symbol) {
      checkCitation(ctx, { file: s.file }, `executionPath[${i}]`, `${s.label}: ${s.file}`);
    } else checkCitation(ctx, { file: s.file, line: s.line, symbol: s.symbol }, `executionPath[${i}]`, `${s.label}: ${formatCitation({ file: s.file, line: s.line, symbol: s.symbol })}`);
    const next = d.executionPath[i + 1];
    if (next) checkEdge(ctx, s.file, next.file, `executionPath[${i}]->[${i + 1}]`, `${s.label} → ${next.label}`);
  });
  d.evidence.forEach((e, i) => e.citation && checkCitation(ctx, e.citation, `evidence[${i}]`));
  d.ruledOut.forEach((r, i) => r.citations.forEach((c, j) => checkCitation(ctx, c, `ruledOut[${i}].citations[${j}]`)));
  if (d.fix) checkDiff(ctx, d.fix.diff, 'fix.diff');
}

function groundSemantic(ctx: Ctx, d: SemanticLayer) {
  d.services.forEach((s, i) => {
    checkNode(ctx, s.id, `services[${i}]`, 'service', `Service ${s.name}`);
    s.citations.forEach((c, j) => checkCitation(ctx, c, `services[${i}].citations[${j}]`));
  });
  d.entryPoints.forEach((e, i) => e.citations.forEach((c, j) => checkCitation(ctx, c, `entryPoints[${i}].citations[${j}]`)));
  d.dataFlows.forEach((f, i) =>
    f.steps.forEach((s, j) => {
      checkEdge(ctx, s.from, s.to, `dataFlows[${i}].steps[${j}]`, `${f.name}: ${short(s.from)} → ${short(s.to)}`);
      checkCitation(ctx, s.citation, `dataFlows[${i}].steps[${j}].citation`);
    }),
  );
}

function groundTour(ctx: Ctx, d: Tour) {
  d.waypoints.forEach((w, i) => {
    checkNode(ctx, w.node, `waypoints[${i}]`, 'node', `Stop ${i + 1}: ${w.title}`);
    w.related.forEach((c, j) => checkCitation(ctx, c, `waypoints[${i}].related[${j}]`));
    w.deeper.forEach((q, j) => q.citations.forEach((c, k) => checkCitation(ctx, c, `waypoints[${i}].deeper[${j}].citations[${k}]`)));
  });
}

const short = (id: string) => id.slice(id.lastIndexOf('/') + 1);

/** Validates every claim in a Bob document against the deterministic graph. */
export function ground(doc: AnyDocument, graph: AnalysisGraph): GroundingReport {
  const ctx = makeCtx(graph);
  if (doc.kind === 'codeverse.investigation') groundInvestigation(ctx, doc);
  else if (doc.kind === 'codeverse.semantic') groundSemantic(ctx, doc);
  else if (doc.kind === 'codeverse.tour') groundTour(ctx, doc);
  const grounded = ctx.claims.filter((c) => c.status === 'grounded').length;
  const weak = ctx.claims.filter((c) => c.status === 'weak').length;
  const total = ctx.claims.length;
  return {
    score: total ? (grounded + weak * 0.5) / total : 1,
    total,
    grounded,
    weak,
    unverified: total - grounded - weak,
    claims: ctx.claims,
  };
}

/** Status for a single citation, for inline ✓ / ⚠ badges. */
export function citationStatus(report: GroundingReport, c: Citation): ClaimStatus | undefined {
  return report.claims.find((x) => x.citation && x.citation.file === c.file && x.citation.line === c.line && x.citation.symbol === c.symbol)?.status;
}
