// Gate for the production build: the public site may only ship real, scrubbed IBM Bob sessions.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { parseDocument, WorldIndex } from '@codeverse/schema';
import { findLeaks } from '@codeverse/scrubber';

const dataDir = path.join(process.cwd(), 'apps/viewer/public/data');
const failures: string[] = [];

const walk = (d: string): string[] => readdirSync(d).flatMap((n) => (statSync(path.join(d, n)).isDirectory() ? walk(path.join(d, n)) : [path.join(d, n)]));

let index: WorldIndex | undefined;
try {
  index = WorldIndex.parse(JSON.parse(readFileSync(path.join(dataDir, 'worlds.json'), 'utf8')));
} catch (e) {
  failures.push(`worlds.json missing or invalid (${(e as Error).message.slice(0, 120)})`);
}

for (const file of walk(dataDir)) {
  const rel = path.relative(dataDir, file);
  const text = readFileSync(file, 'utf8');
  if (/synthetic/i.test(rel) || /"synthetic":true/.test(text)) failures.push(`${rel}: synthetic data must not ship`);
  const leaks = findLeaks(text);
  if (leaks.length) failures.push(`${rel}: ${leaks.join(', ')}`);
  if (rel === 'worlds.json') continue;
  const parsed = parseDocument(text);
  if (!parsed.ok) failures.push(`${rel}: ${parsed.error}`);
  else if (parsed.value.kind === 'codeverse.recording' && !parsed.value.scrubbed) failures.push(`${rel}: recording not scrubbed`);
}

if (index) {
  const withRecording = index.worlds.flatMap((w) => w.incidents).filter((i) => i.recording);
  if (index.worlds.some((w) => w.synthetic)) failures.push('a world is marked synthetic');
  if (withRecording.length === 0) failures.push('no real IBM Bob incident with a recording yet (Phase 2: promote a scrubbed recording into worlds/shopfloor/)');
}

if (failures.length) {
  console.error('[check:public] the public build is blocked:\n  ' + failures.join('\n  '));
  process.exit(1);
}
console.log('[check:public] ok: only real, scrubbed IBM Bob sessions will ship');
