import { z } from 'zod';
import { RelPath, SCHEMA_VERSION } from './common';

export const NodeKind = z.enum(['service', 'file', 'database', 'route']);
export type NodeKind = z.infer<typeof NodeKind>;

export const SymbolInfo = z.object({
  name: z.string().max(200),
  kind: z.enum(['function', 'class', 'method', 'variable', 'type', 'interface', 'enum']),
  line: z.number().int().positive(),
  endLine: z.number().int().positive(),
  exported: z.boolean(),
});
export type SymbolInfo = z.infer<typeof SymbolInfo>;

export const RouteInfo = z.object({
  method: z.string().max(10),
  path: z.string().max(300),
  line: z.number().int().positive(),
  handler: z.string().max(200).optional(),
});
export type RouteInfo = z.infer<typeof RouteInfo>;

export const GraphNode = z.object({
  id: z.string().min(1).max(600),
  kind: NodeKind,
  label: z.string().max(200),
  /** Service (district) id this node belongs to. Service nodes point to themselves. */
  service: z.string().max(200),
  path: RelPath.optional(),
  loc: z.number().int().nonnegative().default(0),
  lines: z.number().int().nonnegative().default(0),
  symbols: z.array(SymbolInfo).max(2000).default([]),
  routes: z.array(RouteInfo).max(500).default([]),
  isTest: z.boolean().default(false),
  isEntry: z.boolean().default(false),
});
export type GraphNode = z.infer<typeof GraphNode>;

export const EdgeKind = z.enum(['imports', 'calls', 'handles', 'uses-db']);
export type EdgeKind = z.infer<typeof EdgeKind>;

export const GraphEdge = z.object({
  id: z.string().max(1300),
  source: z.string().max(600),
  target: z.string().max(600),
  kind: EdgeKind,
  line: z.number().int().positive().optional(),
  symbols: z.array(z.string().max(200)).max(200).default([]),
});
export type GraphEdge = z.infer<typeof GraphEdge>;

export const LIMITS = { maxNodes: 5000, maxEdges: 20000, maxBytes: 15 * 1024 * 1024 } as const;

export const AnalysisGraph = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  kind: z.literal('codeverse.graph'),
  project: z.object({
    name: z.string().max(120),
    root: z.string().max(512),
    analyzerVersion: z.string().max(40),
    fileCount: z.number().int().nonnegative(),
    loc: z.number().int().nonnegative(),
  }),
  nodes: z.array(GraphNode).max(LIMITS.maxNodes),
  edges: z.array(GraphEdge).max(LIMITS.maxEdges),
  /** Non-source text files (logs, configs, docs) that claims may cite. */
  assets: z.array(z.object({ path: RelPath, lines: z.number().int().nonnegative() })).max(5000).default([]),
  /** File contents for the code panel, keyed by repo-relative path. */
  sources: z.record(z.string(), z.string().max(400_000)).optional(),
});
export type AnalysisGraph = z.infer<typeof AnalysisGraph>;
