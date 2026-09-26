import type { AnalysisGraph, RecEvent } from '@codeverse/schema';

export interface GraphIndex {
  target: string;
  files: string[];
  fileSet: Set<string>;
  byBase: Map<string, string[]>;
}

export function indexGraph(graph: Pick<AnalysisGraph, 'nodes' | 'project'>): GraphIndex {
  const files = graph.nodes.filter((n) => n.kind === 'file').map((n) => n.id);
  const byBase = new Map<string, string[]>();
  for (const f of files) {
    const base = f.slice(f.lastIndexOf('/') + 1);
    byBase.set(base, [...(byBase.get(base) ?? []), f]);
  }
  return { target: graph.project.root === '.' ? '' : graph.project.root, files, fileSet: new Set(files), byBase };
}

/** Normalises a path Bob mentions to a repo-relative candidate. */
export function normalizePath(p: string): string {
  let s = p.trim().replace(/\\/g, '/').replace(/^file:\/\//, '');
  s = s.replace(/^@\/?/, '').replace(/^\.\//, '').replace(/:\d+(?::\d+)?(?:-\d+)?$/, '');
  s = s.replace(/\/+$/, '');
  return s;
}

function resolveFile(idx: GraphIndex, p: string): string | undefined {
  const s = normalizePath(p);
  if (!s) return undefined;
  if (idx.fileSet.has(s)) return s;
  if (idx.target && idx.fileSet.has(`${idx.target}/${s}`)) return `${idx.target}/${s}`;
  // Absolute or differently rooted path: match by longest suffix.
  const hit = idx.files.find((f) => s.endsWith('/' + f)) ?? (idx.target ? idx.files.find((f) => s.endsWith('/' + f.slice(idx.target.length + 1))) : undefined);
  return hit;
}

function filesUnder(idx: GraphIndex, dir: string): string[] {
  const d = normalizePath(dir);
  if (!d || d === '.') return idx.target ? idx.files.filter((f) => f.startsWith(idx.target + '/')) : [...idx.files];
  const prefixes = [d + '/', idx.target ? `${idx.target}/${d}/` : ''].filter(Boolean);
  return idx.files.filter((f) => prefixes.some((p) => f.startsWith(p)));
}

export function globToRegExp(glob: string): RegExp {
  let re = '';
  const g = normalizePath(glob);
  for (let i = 0; i < g.length; i++) {
    const c = g[i]!;
    if (c === '*') {
      if (g[i + 1] === '*') {
        re += '.*';
        i++;
        if (g[i + 1] === '/') i++;
      } else re += '[^/]*';
    } else if (c === '?') re += '[^/]';
    else if (c === '{') {
      const end = g.indexOf('}', i);
      if (end > i) {
        re += '(' + g.slice(i + 1, end).split(',').map((x) => x.replace(/[.+^$()|[\]\\]/g, '\\$&')).join('|') + ')';
        i = end;
      } else re += '\\{';
    } else re += c.replace(/[.+^$()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`(^|/)${re}$`);
}

const PATH_TOKEN = /(?:[A-Za-z]:)?[\w@.\-/\\]+\.(?:[cm]?[jt]sx?|json|ndjson|md|yaml|yml)\b/g;

/** Files mentioned anywhere in free text, e.g. grep output. */
export function filesInText(idx: GraphIndex, text: string | undefined, limit = 60): string[] {
  if (!text) return [];
  const out = new Set<string>();
  for (const m of text.matchAll(PATH_TOKEN)) {
    const f = resolveFile(idx, m[0]);
    if (f) out.add(f);
    if (out.size >= limit) break;
  }
  return [...out];
}

const PATH_KEYS = ['path', 'file_path', 'filePath', 'file', 'relative_path', 'target_file', 'directory', 'dir', 'cwd'];

/** Graph node ids a tool call touches, derived from its parameters. */
export function targetsForToolUse(idx: GraphIndex, ev: Pick<RecEvent, 'action' | 'parameters'>): string[] {
  const params = ev.parameters ?? {};
  const out = new Set<string>();
  const pathVals: string[] = [];
  for (const k of PATH_KEYS) {
    const v = params[k];
    if (typeof v === 'string') pathVals.push(v);
    if (Array.isArray(v)) for (const x of v) if (typeof x === 'string') pathVals.push(x);
  }
  for (const k of ['paths', 'files']) {
    const v = params[k];
    if (Array.isArray(v)) for (const x of v) if (typeof x === 'string') pathVals.push(x);
  }
  for (const p of pathVals) {
    const f = resolveFile(idx, p);
    if (f) out.add(f);
    else if (ev.action === 'search' || ev.action === 'list') for (const x of filesUnder(idx, p)) out.add(x);
  }
  const pattern = params.pattern ?? params.glob;
  if (typeof pattern === 'string' && /[*?{]/.test(pattern) && !('regex' in params)) {
    const re = globToRegExp(pattern);
    const base = pathVals.length ? pathVals.flatMap((p) => filesUnder(idx, p)) : idx.files;
    for (const f of base) {
      const rel = idx.target && f.startsWith(idx.target + '/') ? f.slice(idx.target.length + 1) : f;
      if (re.test(f) || re.test(rel)) out.add(f);
    }
  }
  return [...out].slice(0, 200);
}
