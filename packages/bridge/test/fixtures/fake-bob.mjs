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
  if (process.env.FAKE_BOB_MANY_TURNS) {
    let i = 0;
    setInterval(() => {
      out({ type: 'message', role: 'assistant', content: `turn ${i}` });
      out({ type: 'tool_use', tool_name: 'read_file', tool_id: `t${i}`, parameters: { path: 'README.md' } });
      out({ type: 'tool_result', tool_id: `t${i++}`, status: 'success', output: 'ok' });
    }, 5);
    return;
  }
  if (process.env.FAKE_BOB_TEXT_CHUNKS) {
    // Like real Bob Shell: assistant text arrives as many tiny message events.
    const words = 'I will read the ticket and the logs first, then check each suspect in parallel. '.repeat(3).match(/.{1,4}/g);
    for (const w of words.slice(0, 60)) out({ type: 'message', role: 'assistant', content: w });
    out({ type: 'tool_use', tool_name: 'read_file', tool_id: 't1', parameters: { path: 'demo/shopfloor/tickets/INC-2417.txt' } });
    out({ type: 'tool_result', tool_id: 't1', status: 'success', output: 'ok' });
    for (const w of words.slice(0, 60)) out({ type: 'message', role: 'assistant', content: w });
    out({ type: 'result', status: 'success', stats: { tool_calls: 1 } });
    process.exit(0);
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
