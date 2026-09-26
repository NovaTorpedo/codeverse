import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { AnalysisGraph } from '@codeverse/schema';
import { analyze } from './analyze';

const { values } = parseArgs({
  options: {
    target: { type: 'string', default: '.' },
    out: { type: 'string' },
    name: { type: 'string' },
    'no-sources': { type: 'boolean', default: false },
  },
});

const graph = AnalysisGraph.parse(
  analyze({ repoRoot: process.cwd(), target: values.target!, name: values.name, includeSources: !values['no-sources'] }),
);
const json = JSON.stringify(graph, null, 1);
if (values.out) {
  mkdirSync(path.dirname(values.out), { recursive: true });
  writeFileSync(values.out, json);
  const counts = graph.nodes.reduce<Record<string, number>>((acc, n) => ((acc[n.kind] = (acc[n.kind] ?? 0) + 1), acc), {});
  console.log(`[analyzer] ${graph.project.name}: ${graph.project.fileCount} files, ${graph.project.loc} LOC, nodes ${JSON.stringify(counts)}, ${graph.edges.length} edges -> ${values.out}`);
} else {
  process.stdout.write(json);
}
