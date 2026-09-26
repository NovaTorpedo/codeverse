import { AnalysisGraph, Investigation, LIMITS, parseDocument, Recording, SemanticLayer, Tour, WorldIndex, type AnyDocument, type WorldEntry } from '@codeverse/schema';
import { ground } from '@codeverse/grounding';
import { layoutCity } from './layout/cityLayout';
import type { LoadedIncident, LoadedWorld } from './store';

const BASE = '/data/';

/** Only same-origin relative paths under /data/ are fetched; never URLs taken from file contents. */
function safeDataPath(rel: string): string {
  if (!/^[a-z0-9][a-z0-9/._-]*\.json$/i.test(rel) || rel.includes('..') || rel.includes('//')) throw new Error(`Refusing to load ${rel}`);
  return BASE + rel;
}

async function getJson(rel: string): Promise<unknown> {
  const res = await fetch(safeDataPath(rel), { credentials: 'omit', cache: 'no-cache' });
  if (!res.ok) throw new Error(`${rel}: HTTP ${res.status}`);
  const text = await res.text();
  if (text.length > LIMITS.maxBytes) throw new Error(`${rel}: too large`);
  return JSON.parse(text);
}

export async function loadIndex(): Promise<WorldIndex> {
  return WorldIndex.parse(await getJson('worlds.json'));
}

export async function loadWorld(entry: WorldEntry): Promise<LoadedWorld> {
  const graph = AnalysisGraph.parse(await getJson(entry.graph));
  const [semantic, tour] = await Promise.all([
    entry.semantic ? getJson(entry.semantic).then((j) => SemanticLayer.parse(j)) : undefined,
    entry.tour ? getJson(entry.tour).then((j) => Tour.parse(j)) : undefined,
  ]);
  const incidents: LoadedIncident[] = await Promise.all(
    entry.incidents.map(async (inc) => {
      const investigation = Investigation.parse(await getJson(inc.investigation));
      const recording = inc.recording ? Recording.parse(await getJson(inc.recording)) : undefined;
      return { id: inc.id, title: inc.title, investigation, recording, grounding: ground(investigation, graph) };
    }),
  );
  return {
    entry,
    graph,
    layout: layoutCity(graph),
    semantic,
    semanticGrounding: semantic ? ground(semantic, graph) : undefined,
    tour,
    tourGrounding: tour ? ground(tour, graph) : undefined,
    incidents,
    recordings: [],
  };
}

/** Reads a user-supplied file entirely client-side: size cap, JSON parse, zod validation, count caps. */
export async function readUserFile(file: File): Promise<AnyDocument> {
  if (file.size > LIMITS.maxBytes) throw new Error(`File is larger than ${LIMITS.maxBytes / 1024 / 1024} MB`);
  const text = await file.text();
  const parsed = parseDocument(text);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.value;
}

/** Builds a world from a user-supplied graph (no incidents; grounding runs locally). */
export function worldFromGraph(graph: AnalysisGraph): LoadedWorld {
  const entry: WorldEntry = { id: 'uploaded', title: graph.project.name || 'Uploaded graph', description: 'Loaded from your file. Nothing left this browser.', graph: 'uploaded.json', incidents: [], recordings: [], synthetic: false };
  return { entry, graph, layout: layoutCity(graph), incidents: [], recordings: [] };
}

export function isSynthetic(doc: { synthetic?: boolean } | undefined): boolean {
  return Boolean(doc?.synthetic);
}
