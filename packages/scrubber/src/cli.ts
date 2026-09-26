import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { AnalysisGraph, parseDocument, Recording } from '@codeverse/schema';
import { indexGraph, recordingFromNdjson } from '@codeverse/stream';
import { findLeaks, scrubDocument, scrubRecording } from './index';

// Usage:
//   npm run scrub -- <raw.ndjson> --graph <graph.json> --id <id> --title <title> --target <dir> --out <file>
//   npm run scrub -- <doc.json> --out <file>          (investigation / semantic / tour / recording)
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    out: { type: 'string' },
    graph: { type: 'string' },
    id: { type: 'string' },
    title: { type: 'string' },
    target: { type: 'string', default: 'demo/shopfloor' },
    mode: { type: 'string' },
    'max-cost': { type: 'string' },
    'max-turns': { type: 'string' },
    prompt: { type: 'string' },
    'recorded-at': { type: 'string' },
  },
});

export function privateTerms(): string[] {
  const terms = new Set<string>();
  const user = os.userInfo().username;
  if (user.length >= 3) terms.add(user);
  const host = os.hostname();
  if (host.length >= 3) terms.add(host);
  try {
    const email = execFileSync('git', ['config', 'user.email'], { encoding: 'utf8' }).trim();
    if (email) terms.add(email);
  } catch {
    // no git email
  }
  const local = path.join(process.cwd(), 'private', 'leak-terms.txt');
  if (existsSync(local)) for (const t of readFileSync(local, 'utf8').split(/\r?\n/)) if (t.trim() && !t.startsWith('#')) terms.add(t.trim());
  return [...terms];
}

const input = positionals[0];
if (!input || !values.out) {
  console.error('usage: scrub <raw.ndjson|doc.json> --out <file> [--graph g.json --id id --title title]');
  process.exit(2);
}
const opts = { repoRoot: process.cwd(), terms: privateTerms(), keepLoopback: true };
const raw = readFileSync(input, 'utf8');
let output: unknown;
let counts: Record<string, number>;

if (input.endsWith('.ndjson')) {
  const graph = values.graph ? AnalysisGraph.parse(JSON.parse(readFileSync(values.graph, 'utf8'))) : undefined;
  const rec = recordingFromNdjson(
    raw,
    {
      id: values.id ?? path.basename(input).replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      title: values.title ?? 'IBM Bob investigation',
      target: values.target!,
      synthetic: false,
      source: 'bob-shell',
      recordedAt: values['recorded-at'],
      command: {
        mode: values.mode,
        maxCost: values['max-cost'] ? Number(values['max-cost']) : undefined,
        maxTurns: values['max-turns'] ? Number(values['max-turns']) : undefined,
        disabledToolGroups: ['execute', 'mcp'],
        prompt: values.prompt,
      },
    },
    graph ? indexGraph(graph) : undefined,
  );
  ({ recording: output, counts } = scrubRecording(rec, opts));
  Recording.parse(output);
} else {
  const parsed = parseDocument(raw);
  if (!parsed.ok) {
    console.error(`[scrub] schema invalid: ${parsed.error}`);
    process.exit(1);
  }
  if (parsed.value.kind === 'codeverse.recording') ({ recording: output, counts } = scrubRecording(parsed.value, opts));
  else ({ doc: output, counts } = scrubDocument(parsed.value, opts));
}

const json = JSON.stringify(output, null, 1);
const leaks = findLeaks(json, opts.terms);
if (leaks.length) {
  console.error(`[scrub] refusing to write, leaks remain: ${leaks.join(', ')}`);
  process.exit(1);
}
mkdirSync(path.dirname(values.out), { recursive: true });
writeFileSync(values.out, json + '\n');
console.log(`[scrub] wrote ${values.out}; redactions: ${JSON.stringify(counts)}`);
