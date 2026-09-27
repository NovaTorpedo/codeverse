// Builds the viewer's static data folder (apps/viewer/public/data) from worlds/*/world.json.
//   npm run data                 real Bob documents where present, synthetic fixtures fill gaps (local dev, CI preview)
//   npm run data -- --public     real, scrubbed Bob documents only (production build)
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { analyze } from '@codeverse/analyzer';
import { AnalysisGraph, parseDocument, SCHEMA_VERSION, WorldIndex, type IncidentEntry, type WorldEntry } from '@codeverse/schema';
import { indexGraph, recordingFromNdjson } from '@codeverse/stream';

const repoRoot = process.cwd();
const isPublic = process.argv.includes('--public');
const outDir = path.join(repoRoot, 'apps/viewer/public/data');
const FIXTURES = {
  investigation: 'packages/grounding/test/fixtures/shopfloor.investigation.synthetic.json',
  semantic: 'packages/grounding/test/fixtures/shopfloor.semantic.synthetic.json',
  tour: 'packages/grounding/test/fixtures/shopfloor.tour.synthetic.json',
  stream: 'packages/stream/test/fixtures/investigate.synthetic.ndjson',
};

interface WorldConfig {
  id: string;
  title: string;
  description: string;
  target: string;
  skip?: string[];
  semantic?: string;
  tour?: string;
  incidents?: IncidentEntry[];
}

const problems: string[] = [];
const write = (rel: string, data: unknown) => {
  const file = path.join(outDir, rel);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(data));
  return rel.split(path.sep).join('/');
};

/** Loads and validates a committed Bob document. Returns undefined when absent or not publishable. */
function loadReal(worldDir: string, rel: string | undefined, kind: string) {
  if (!rel) return undefined;
  const file = path.join(worldDir, rel);
  if (!existsSync(file)) return undefined;
  const parsed = parseDocument(readFileSync(file, 'utf8'));
  if (!parsed.ok) {
    problems.push(`${path.relative(repoRoot, file)}: ${parsed.error}`);
    return undefined;
  }
  if (parsed.value.kind !== kind) {
    problems.push(`${path.relative(repoRoot, file)}: expected ${kind}, got ${parsed.value.kind}`);
    return undefined;
  }
  if ('synthetic' in parsed.value && parsed.value.synthetic) {
    problems.push(`${path.relative(repoRoot, file)}: synthetic documents cannot live in worlds/`);
    return undefined;
  }
  if (parsed.value.kind === 'codeverse.recording' && !parsed.value.scrubbed) {
    problems.push(`${path.relative(repoRoot, file)}: recording is not scrubbed (run npm run scrub)`);
    return undefined;
  }
  return parsed.value;
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const worlds: WorldEntry[] = [];
for (const id of readdirSync(path.join(repoRoot, 'worlds')).sort()) {
  const worldDir = path.join(repoRoot, 'worlds', id);
  const cfgFile = path.join(worldDir, 'world.json');
  if (!existsSync(cfgFile)) continue;
  const cfg = JSON.parse(readFileSync(cfgFile, 'utf8')) as WorldConfig;
  const graph = AnalysisGraph.parse(analyze({ repoRoot, target: cfg.target, name: cfg.title, skip: cfg.skip }));
  const entry: WorldEntry = { id: cfg.id, title: cfg.title, description: cfg.description, graph: write(`${id}/graph.json`, graph), incidents: [], recordings: [], synthetic: false };

  const semantic = loadReal(worldDir, cfg.semantic, 'codeverse.semantic');
  const tour = loadReal(worldDir, cfg.tour, 'codeverse.tour');
  if (semantic) entry.semantic = write(`${id}/semantic.json`, semantic);
  if (tour) entry.tour = write(`${id}/tour.json`, tour);

  for (const inc of cfg.incidents ?? []) {
    const inv = loadReal(worldDir, inc.investigation, 'codeverse.investigation');
    const rec = loadReal(worldDir, inc.recording, 'codeverse.recording');
    if (!inv) continue;
    const e: IncidentEntry = { id: inc.id, title: inc.title, investigation: write(`${id}/incidents/${inc.id}.investigation.json`, inv), baseline: inc.baseline };
    if (rec) {
      e.recording = write(`${id}/recordings/${inc.id}.recording.json`, rec);
      entry.recordings.push(e.recording);
    }
    entry.incidents.push(e);
  }

  // Local development and CI previews: fill gaps in the shopfloor world with clearly labelled synthetic fixtures.
  if (!isPublic && cfg.target === 'demo/shopfloor') {
    const fx = (f: string) => JSON.parse(readFileSync(path.join(repoRoot, f), 'utf8'));
    if (!entry.semantic) {
      entry.semantic = write(`${id}/semantic.synthetic.json`, fx(FIXTURES.semantic));
      entry.synthetic = true;
    }
    if (!entry.tour) {
      entry.tour = write(`${id}/tour.synthetic.json`, fx(FIXTURES.tour));
      entry.synthetic = true;
    }
    if (entry.incidents.length === 0) {
      const rec = recordingFromNdjson(
        readFileSync(path.join(repoRoot, FIXTURES.stream), 'utf8'),
        { id: 'synthetic-payment-failed', title: 'SYNTHETIC: Payment failed during checkout', target: cfg.target, synthetic: true, source: 'fixture', recordedAt: '2026-09-26T12:00:00.000Z', command: { mode: 'codeverse-cartographer', maxCost: 3, maxTurns: 40, disabledToolGroups: ['execute', 'mcp'] } },
        indexGraph(graph),
      );
      entry.incidents.push({
        id: 'payment-failed',
        title: 'Payment failed during checkout',
        investigation: write(`${id}/incidents/payment-failed.investigation.synthetic.json`, fx(FIXTURES.investigation)),
        recording: write(`${id}/recordings/payment-failed.recording.synthetic.json`, rec),
      });
      entry.synthetic = true;
    }
  }
  worlds.push(entry);
  console.log(`[data] ${id}: ${graph.nodes.length} nodes, ${graph.edges.length} edges, semantic=${Boolean(entry.semantic)}, tour=${Boolean(entry.tour)}, incidents=${entry.incidents.length}${entry.synthetic ? ' (with SYNTHETIC fixtures)' : ''}`);
}

worlds.sort((a, b) => (a.id === 'shopfloor' ? -1 : b.id === 'shopfloor' ? 1 : a.id.localeCompare(b.id)));
const index = WorldIndex.parse({ schemaVersion: SCHEMA_VERSION, kind: 'codeverse.worlds', builtAt: new Date().toISOString(), worlds });
write('worlds.json', index);
if (problems.length) {
  console.error('[data] problems:\n  ' + problems.join('\n  '));
  process.exit(1);
}
console.log(`[data] wrote ${path.relative(repoRoot, outDir)} (${isPublic ? 'public' : 'dev'} mode)`);
