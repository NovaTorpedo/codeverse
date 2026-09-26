import path from 'node:path';
import { parseArgs } from 'node:util';
import { buildPrompt, clampCost, clampTurns, confineWorkspace, DEFAULT_MODE, isCommand, newToken, sanitizePrompt } from './guards';
import { runBob } from './runner';
import { startBridge } from './server';

// npm run bridge                       live mode: WebSocket bridge for the local viewer
// npm run bridge -- record --command investigate --prompt "Payment failed during checkout" --id payment-failed
//                                      headless run that writes .codeverse/raw/<id>.ndjson
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    port: { type: 'string', default: '4317' },
    target: { type: 'string', default: 'demo/shopfloor' },
    allow: { type: 'string', multiple: true },
    origin: { type: 'string', multiple: true },
    mode: { type: 'string', default: DEFAULT_MODE },
    'max-cost': { type: 'string', default: '2' },
    'max-turns': { type: 'string', default: '30' },
    'timeout-min': { type: 'string', default: '10' },
    command: { type: 'string', default: 'investigate' },
    prompt: { type: 'string', default: '' },
    id: { type: 'string' },
  },
});

const repoRoot = process.cwd();
const maxCost = clampCost(Number(values['max-cost']));
const maxTurns = clampTurns(Number(values['max-turns']));
const timeoutMs = Math.max(1, Number(values['timeout-min'])) * 60_000;
const allowedRoots = values.allow?.length ? values.allow : ['.'];

if (positionals[0] === 'record') {
  if (!isCommand(values.command)) {
    console.error('command must be one of investigate | scan | tour');
    process.exit(2);
  }
  const workspace = confineWorkspace('.', allowedRoots, repoRoot);
  const target = path.relative(repoRoot, confineWorkspace(values.target!, allowedRoots, repoRoot)).split(path.sep).join('/') || '.';
  const id = (values.id ?? `${values.command}-${Date.now()}`).toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const rawFile = path.join(repoRoot, '.codeverse', 'raw', `${id}.ndjson`);
  console.log(`[record] bob run (mode ${values.mode}, max-cost ${maxCost}, max-turns ${maxTurns}, tools: read-only, MCP off) on ${target}`);
  let events = 0;
  const run = runBob({
    workspace,
    mode: values.mode,
    maxCost,
    maxTurns,
    timeoutMs,
    prompt: buildPrompt(values.command, sanitizePrompt(values.prompt), target),
    rawFile,
    onEvent: (e) => {
      events++;
      if (e.type === 'tool_use') console.log(`  · ${String(e.tool_name)} ${JSON.stringify(e.parameters ?? {}).slice(0, 100)}`);
      if (e.type === 'result') console.log(`[record] result: ${JSON.stringify(e.stats ?? {})}`);
      if (e.type === 'error') console.log(`[record] limit: ${String(e.message ?? '')}`);
    },
    onStderr: (t) => process.stderr.write(t),
  });
  process.on('SIGINT', () => run.cancel());
  const { exitCode, reason } = await run.done;
  console.log(`[record] ${reason}, exit ${exitCode}, ${events} events → ${path.relative(repoRoot, rawFile)}`);
  process.exit(exitCode ?? 1);
} else {
  const token = newToken();
  const port = Number(values.port);
  const origins = values.origin?.length ? values.origin : ['http://localhost:3000', 'http://127.0.0.1:3000'];
  const bridge = await startBridge({ port, token, repoRoot, target: values.target!, allowedRoots, origins, mode: values.mode, maxCost, maxTurns, timeoutMs });
  console.log(`[bridge] listening on 127.0.0.1:${bridge.port} (target ${values.target}, max-cost ${maxCost}, max-turns ${maxTurns})`);
  console.log(`[bridge] open the viewer (npm run dev) at: http://localhost:3000/#live=${bridge.port}.${token}`);
  console.log('[bridge] this link contains a one-time session token; do not share it.');
  process.on('SIGINT', () => void bridge.close().then(() => process.exit(0)));
}
