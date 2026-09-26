import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { AnalysisGraph, parseDocument } from '@codeverse/schema';
import { ground } from './index';

// Usage: npm run ground -- --graph <graph.json> <document.json> [--min 0.8]
const { values, positionals } = parseArgs({ options: { graph: { type: 'string' }, min: { type: 'string', default: '0' } }, allowPositionals: true });
if (!values.graph || positionals.length === 0) {
  console.error('usage: ground --graph <graph.json> <doc.json> [...]');
  process.exit(2);
}
const graph = AnalysisGraph.parse(JSON.parse(readFileSync(values.graph, 'utf8')));
let failed = false;
for (const file of positionals) {
  const parsed = parseDocument(readFileSync(file, 'utf8'));
  if (!parsed.ok) {
    console.error(`✗ ${file}: schema invalid: ${parsed.error}`);
    failed = true;
    continue;
  }
  const r = ground(parsed.value, graph);
  console.log(`${file}: grounding ${(r.score * 100).toFixed(0)}% (${r.grounded} grounded, ${r.weak} weak, ${r.unverified} unverified of ${r.total})`);
  for (const c of r.claims.filter((x) => x.status !== 'grounded')) console.log(`  ${c.status === 'weak' ? '~' : '⚠'} ${c.label}: ${c.reason}`);
  if (r.score < Number(values.min)) failed = true;
}
process.exit(failed ? 1 : 0);
