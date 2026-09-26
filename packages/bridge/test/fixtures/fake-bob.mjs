#!/usr/bin/env node
// SYNTHETIC stand-in for Bob Shell used by bridge tests. Echoes argv and stdin as events, then replays the
// synthetic stream fixture. Never contacts any service.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
let stdin = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (d) => (stdin += d));
process.stdin.on('end', async () => {
  const out = (o) => process.stdout.write(JSON.stringify(o) + '\n');
  out({ type: 'message', role: 'system', content: JSON.stringify({ argv: process.argv.slice(2), stdin, cwd: process.cwd() }) });
  if (process.env.FAKE_BOB_HANG) {
    setInterval(() => out({ type: 'message', role: 'assistant', isReasoning: true, content: 'still thinking' }), 50);
    return;
  }
  const lines = readFileSync(path.join(here, '../../../stream/test/fixtures/investigate.synthetic.ndjson'), 'utf8').split('\n').filter(Boolean);
  // Emit in awkward chunks to exercise partial-line handling.
  const text = lines.join('\n') + '\n';
  for (let i = 0; i < text.length; i += 97) {
    process.stdout.write(text.slice(i, i + 97));
    await new Promise((r) => setTimeout(r, 1));
  }
  process.exit(0);
});
