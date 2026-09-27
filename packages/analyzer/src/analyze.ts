import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { SCHEMA_VERSION, type AnalysisGraph, type GraphEdge, type GraphNode } from '@codeverse/schema';
import { countLoc, listAssetFiles, listSourceFiles, readText, SOURCE_EXT, toPosix } from './files';
import { parseSource, type ParsedFile } from './parse';

export const ANALYZER_VERSION = '0.3.0';

const DB_LIBS = /^(pg|postgres|mysql2?|mongodb|mongoose|redis|ioredis|sqlite3?|better-sqlite3|@prisma\/client|drizzle-orm|knex|typeorm|sequelize)(\/|$)/;
const CONTAINER_DIRS = new Set(['packages', 'apps', 'services', 'libs', 'demo', 'modules']);

export interface AnalyzeOptions {
  /** Absolute path of the repository root; node ids are relative to it. */
  repoRoot: string;
  /** Directory to analyse, relative to repoRoot ('.' for the whole repo). */
  target: string;
  name?: string;
  includeSources?: boolean;
  /** Extra directory names to skip. */
  skip?: string[];
}

/** Service (district) for a path relative to the analysed target. */
export function serviceOf(relToTarget: string): string {
  const seg = relToTarget.split('/');
  if (seg.length === 1) return 'root';
  if (/(^|\/)(test|tests|__tests__|e2e)\//.test(relToTarget) || /\.(test|spec)\.[cm]?[jt]sx?$/.test(relToTarget)) {
    if (CONTAINER_DIRS.has(seg[0]!) && seg.length > 2) return `${seg[0]}/${seg[1]}`;
    return 'tests';
  }
  if (CONTAINER_DIRS.has(seg[0]!) && seg.length > 2) return `${seg[0]}/${seg[1]}`;
  if (seg[0] === 'src' && seg.length > 2) return seg[1]!;
  return seg[0]!;
}

interface WorkspacePkg {
  name: string;
  entry: string;
}

function workspacePackages(repoRoot: string): WorkspacePkg[] {
  const out: WorkspacePkg[] = [];
  for (const container of CONTAINER_DIRS) {
    const dir = path.join(repoRoot, container);
    if (!existsSync(dir) || !statSync(dir).isDirectory()) continue;
    for (const name of listDirs(dir)) {
      const pj = path.join(dir, name, 'package.json');
      if (!existsSync(pj)) continue;
      try {
        const pkg = JSON.parse(readFileSync(pj, 'utf8')) as { name?: string; exports?: unknown; main?: string };
        const exp = pkg.exports as Record<string, unknown> | string | undefined;
        const entry = typeof exp === 'string' ? exp : typeof exp?.['.'] === 'string' ? (exp['.'] as string) : pkg.main;
        if (pkg.name && entry) out.push({ name: pkg.name, entry: toPosix(path.relative(repoRoot, path.join(dir, name, entry))) });
      } catch {
        // unreadable package.json: skip
      }
    }
  }
  return out;
}

function listDirs(dir: string): string[] {
  try {
    return readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  } catch {
    return [];
  }
}

export function analyze(opts: AnalyzeOptions): AnalysisGraph {
  const repoRoot = path.resolve(opts.repoRoot);
  const targetAbs = path.resolve(repoRoot, opts.target);
  const target = toPosix(path.relative(repoRoot, targetAbs)) || '.';
  const skip = [...(opts.skip ?? []), ...gitignoredDirs(repoRoot)];
  const files = listSourceFiles(targetAbs, skip);
  const rel = (abs: string) => toPosix(path.relative(repoRoot, abs));
  const relToTarget = (repoRel: string) => (target === '.' ? repoRel : repoRel.slice(target.length + 1));
  const fileSet = new Set(files.map(rel));
  const pkgs = workspacePackages(repoRoot);

  const resolveSpecifier = (fromRel: string, spec: string): string | undefined => {
    let base: string | undefined;
    if (spec.startsWith('.')) base = path.posix.normalize(path.posix.join(path.posix.dirname(fromRel), spec));
    else {
      const pkg = pkgs.find((p) => spec === p.name || spec.startsWith(p.name + '/'));
      if (!pkg) return undefined;
      if (spec === pkg.name) base = pkg.entry;
      else base = path.posix.join(path.posix.dirname(pkg.entry), spec.slice(pkg.name.length + 1));
    }
    const stripped = base.replace(/\.(m|c)?js$/, '');
    const candidates = [base, ...SOURCE_EXT.map((e) => stripped + e), ...SOURCE_EXT.map((e) => `${stripped}/index${e}`)];
    return candidates.find((c) => fileSet.has(c));
  };

  const parsed = new Map<string, { parsed: ParsedFile; text: string }>();
  for (const abs of files) {
    const text = readText(abs);
    parsed.set(rel(abs), { parsed: parseSource(abs, text), text });
  }

  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, GraphEdge>();
  const sources: Record<string, string> = {};
  const addEdge = (e: Omit<GraphEdge, 'id' | 'symbols'> & { symbols?: string[] }) => {
    if (e.source === e.target) return;
    const id = `${e.kind}:${e.source}->${e.target}`;
    const existing = edges.get(id);
    if (existing) {
      for (const s of e.symbols ?? []) if (!existing.symbols.includes(s)) existing.symbols.push(s);
      return;
    }
    edges.set(id, { id, source: e.source, target: e.target, kind: e.kind, line: e.line, symbols: [...(e.symbols ?? [])] });
  };

  let totalLoc = 0;
  const dbClientFiles = new Set<string>();
  for (const [file, { parsed: p, text }] of parsed) {
    const service = serviceOf(relToTarget(file));
    const loc = countLoc(text);
    totalLoc += loc;
    const base = path.posix.basename(file);
    const isTest = service === 'tests' || /\.(test|spec)\./.test(base) || /(^|\/)(test|tests|e2e)\//.test(file);
    nodes.set(file, {
      id: file,
      kind: 'file',
      label: base,
      service: `svc:${service}`,
      path: file,
      loc,
      lines: text.split('\n').length,
      symbols: p.symbols,
      routes: p.routes,
      isTest,
      isEntry: p.routes.length > 0 || /^(server|main|cli|index)\.[cm]?[jt]sx?$/.test(base) || /(^|\/)app\/page\.tsx$/.test(file),
    });
    if (opts.includeSources !== false && text.length < 200_000) sources[file] = text;
    if (p.symbols.some((s) => s.exported && /^(Db|Database|Sql|Mongo|Redis)\w*(Client|Pool|Connection)$/.test(s.name)) || p.imports.some((i) => DB_LIBS.test(i.specifier))) {
      dbClientFiles.add(file);
    }
  }

  // Services
  const serviceIds = new Set([...nodes.values()].map((n) => n.service));
  for (const sid of serviceIds) {
    const members = [...nodes.values()].filter((n) => n.service === sid);
    nodes.set(sid, {
      id: sid,
      kind: 'service',
      label: sid.slice(4),
      service: sid,
      loc: members.reduce((s, n) => s + n.loc, 0),
      lines: members.reduce((s, n) => s + n.lines, 0),
      symbols: [],
      routes: [],
      isTest: members.every((n) => n.isTest),
      isEntry: members.some((n) => n.isEntry),
    });
  }

  // Imports and provable calls
  for (const [file, { parsed: p }] of parsed) {
    const localToTarget = new Map<string, { target: string; imported: string }>();
    for (const imp of p.imports) {
      const resolved = resolveSpecifier(file, imp.specifier);
      if (!resolved) continue;
      addEdge({ source: file, target: resolved, kind: 'imports', line: imp.line, symbols: imp.bindings.map((b) => b.imported).filter((s) => s !== '*' && s !== 'default') });
      for (const b of imp.bindings) localToTarget.set(b.local, { target: resolved, imported: b.imported });
    }
    for (const call of p.calls) {
      const hit = localToTarget.get(call.local);
      if (!hit) continue;
      let symbol = hit.imported === '*' ? call.member : hit.imported;
      if (call.viaProperty && call.member) symbol = `${hit.imported}.${call.member}`;
      if (!symbol || symbol === 'default') symbol = call.member ?? hit.imported;
      const targetNode = nodes.get(hit.target);
      const known = targetNode?.symbols.some((s) => s.name === symbol || s.name === symbol.split('.')[0]);
      if (known) addEdge({ source: file, target: hit.target, kind: 'calls', line: call.line, symbols: [symbol] });
    }
  }

  // Routes as gateway nodes
  for (const n of [...nodes.values()]) {
    if (n.kind !== 'file') continue;
    for (const r of n.routes) {
      const id = `route:${r.method} ${r.path}`;
      nodes.set(id, { id, kind: 'route', label: `${r.method} ${r.path}`, service: n.service, path: n.path, loc: 0, lines: 0, symbols: [], routes: [r], isTest: false, isEntry: true });
      addEdge({ source: id, target: n.id, kind: 'handles', line: r.line });
    }
  }

  // Datastores: one knowledge core per database client module
  for (const dbFile of dbClientFiles) {
    const dbNode = nodes.get(dbFile)!;
    const id = `db:${dbFile}`;
    nodes.set(id, { id, kind: 'database', label: `datastore (${dbNode.label.replace(/\.[^.]+$/, '')})`, service: dbNode.service, path: dbFile, loc: 0, lines: 0, symbols: [], routes: [], isTest: false, isEntry: false });
    addEdge({ source: dbFile, target: id, kind: 'uses-db' });
    for (const e of [...edges.values()]) {
      if (e.kind === 'imports' && e.target === dbFile && !nodes.get(e.source)?.isTest) addEdge({ source: e.source, target: id, kind: 'uses-db', line: e.line });
    }
  }

  // Non-code files (tickets, logs, manifests) are bundled as text so their citations open in the viewer.
  const assets = listAssetFiles(targetAbs, skip).map((abs) => ({ path: rel(abs), text: readText(abs) }));
  if (opts.includeSources !== false) for (const a of assets) if (a.text.length < 200_000) sources[a.path] = a.text;

  const sortedNodes = [...nodes.values()].sort((a, b) => a.id.localeCompare(b.id));
  const sortedEdges = [...edges.values()].sort((a, b) => a.id.localeCompare(b.id));
  return {
    schemaVersion: SCHEMA_VERSION,
    kind: 'codeverse.graph',
    project: { name: opts.name ?? path.basename(targetAbs), root: target, analyzerVersion: ANALYZER_VERSION, fileCount: files.length, loc: totalLoc },
    nodes: sortedNodes,
    edges: sortedEdges,
    assets: assets.map((a) => ({ path: a.path, lines: a.text.split('\n').length })),
    sources: opts.includeSources === false ? undefined : sources,
  };
}

/** Directory names listed in the repository's root .gitignore (e.g. `private/`). */
function gitignoredDirs(repoRoot: string): string[] {
  const file = path.join(repoRoot, '.gitignore');
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => /^[\w.-]+\/$/.test(l))
    .map((l) => l.slice(0, -1));
}
