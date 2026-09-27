import { createServer, type IncomingMessage } from 'node:http';
import { mkdirSync, watch, type FSWatcher } from 'node:fs';
import path from 'node:path';
import { WebSocketServer, type WebSocket } from 'ws';
import { LIMITS, parseDocument } from '@codeverse/schema';
import { buildPrompt, confineWorkspace, isCommand, originAllowed, readFileCapped, sanitizePrompt, tokensEqual } from './guards';
import { runBob, type BobCommand, type RunHandle } from './runner';

export interface BridgeOptions {
  port: number;
  token: string;
  repoRoot: string;
  /** Directory Bob analyses (named in the prompt); Bob's workspace is always the repo root so `.bob/` applies. */
  target: string;
  allowedRoots: string[];
  origins: string[];
  mode?: string;
  maxCost?: number;
  maxTurns?: number;
  timeoutMs?: number;
  bob?: BobCommand;
  log?: (msg: string) => void;
}

const PROTOCOL = 'codeverse.v1';

/** Local-only bridge: 127.0.0.1, per-session token (as a WebSocket subprotocol), strict Origin, one run at a time. */
export function startBridge(opts: BridgeOptions) {
  const log = opts.log ?? ((m: string) => console.log(`[bridge] ${m}`));
  const workspace = confineWorkspace('.', opts.allowedRoots, opts.repoRoot);
  const target = path.relative(opts.repoRoot, confineWorkspace(opts.target, opts.allowedRoots, opts.repoRoot)).split(path.sep).join('/') || '.';
  const recordingsDir = path.join(opts.repoRoot, '.codeverse', 'recordings');
  const rawDir = path.join(opts.repoRoot, '.codeverse', 'raw');
  mkdirSync(recordingsDir, { recursive: true });
  let active: RunHandle | undefined;

  const http = createServer((_req, res) => {
    res.writeHead(426, { 'Content-Type': 'text/plain' }).end('CodeVerse bridge: WebSocket only');
  });

  const authorised = (req: IncomingMessage): boolean => {
    if (!originAllowed(req.headers.origin, opts.origins)) return false;
    const protos = String(req.headers['sec-websocket-protocol'] ?? '')
      .split(',')
      .map((s) => s.trim());
    const tok = protos.find((p) => p.startsWith('token.'))?.slice(6) ?? '';
    return protos.includes(PROTOCOL) && tokensEqual(tok, opts.token);
  };

  const wss = new WebSocketServer({
    server: http,
    maxPayload: 64 * 1024,
    verifyClient: (info, cb) => (authorised(info.req) ? cb(true) : cb(false, 403, 'Forbidden')),
    handleProtocols: (protocols) => (protocols.has(PROTOCOL) ? PROTOCOL : false),
  });

  const broadcast = (msg: unknown) => {
    const text = JSON.stringify(msg);
    for (const c of wss.clients) if (c.readyState === c.OPEN) c.send(text);
  };

  const startRun = (ws: WebSocket, command: unknown, prompt: unknown) => {
    if (!isCommand(command)) return ws.send(JSON.stringify({ type: 'error', message: 'Command not allowed' }));
    if (active) return ws.send(JSON.stringify({ type: 'error', message: 'A Bob run is already in progress' }));
    const text = sanitizePrompt(prompt);
    const id = `${command}-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    const rawFile = path.join(rawDir, `${id}.ndjson`);
    try {
      active = runBob({
        workspace,
        mode: opts.mode,
        maxCost: opts.maxCost,
        maxTurns: opts.maxTurns,
        timeoutMs: opts.timeoutMs,
        prompt: buildPrompt(command, text, target),
        rawFile,
        bob: opts.bob,
        onEvent: (event) => broadcast({ type: 'raw', event }),
        onStderr: (t) => log(`bob stderr: ${t.trim()}`),
      });
    } catch (e) {
      return ws.send(JSON.stringify({ type: 'error', message: (e as Error).message }));
    }
    broadcast({ type: 'run-start', meta: { id, title: text ? `Bob: ${text.slice(0, 120)}` : `Bob ${command}`, target, command } });
    log(`run ${id} started (raw → ${path.relative(opts.repoRoot, rawFile)})`);
    void active.done.then(({ exitCode, reason }) => {
      broadcast({ type: 'run-end', exitCode, reason, raw: path.relative(opts.repoRoot, rawFile).split(path.sep).join('/') });
      log(`run ${id} ended: ${reason} (exit ${exitCode})`);
      active = undefined;
    });
  };

  wss.on('connection', (ws) => {
    ws.send(JSON.stringify({ type: 'hello', version: 1, target }));
    ws.on('message', (data, isBinary) => {
      if (isBinary) return;
      let msg: unknown;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return;
      }
      // JSON.parse can return null, a number, or an array — guard before property access.
      if (typeof msg !== 'object' || msg === null || Array.isArray(msg)) return;
      const m = msg as { type?: unknown; command?: unknown; prompt?: unknown };
      if (m.type === 'run') startRun(ws, m.command, m.prompt);
      else if (m.type === 'cancel') active?.cancel();
    });
  });

  // Bob IDE path: slash commands write validated documents here; forward them to the viewer.
  const pending = new Map<string, NodeJS.Timeout>();
  const onFile = (name: string) => {
    if (!name.endsWith('.json')) return;
    clearTimeout(pending.get(name));
    pending.set(
      name,
      setTimeout(() => {
        const file = path.join(recordingsDir, path.basename(name));
        try {
          // Size is checked on the open file before reading, and the read is bounded (readFileCapped).
          const read = readFileCapped(file, LIMITS.maxBytes);
          if (!read.ok) {
            if (read.reason === 'too-large') broadcast({ type: 'error', message: `${path.basename(name)}: larger than ${LIMITS.maxBytes / 1024 / 1024} MB, not loaded` });
            return; // 'changed': still being written; the next watch event re-reads it
          }
          const text = read.text;
          // Read first, then check size — avoids a TOCTOU race between statSync and readFileSync.
          if (Buffer.byteLength(text, 'utf8') > LIMITS.maxBytes) return;
          const parsed = parseDocument(text);
          if (!parsed.ok) {
            broadcast({ type: 'error', message: `${path.basename(name)}: ${parsed.error}` });
            return;
          }
          broadcast({ type: 'document', name: path.basename(name), text });
          log(`forwarded ${path.basename(name)} (${parsed.value.kind})`);
        } catch {
          // file vanished between event and read
        }
      }, 250),
    );
  };
  let watcher: FSWatcher | undefined;
  try {
    watcher = watch(recordingsDir, (_evt, name) => name && onFile(name.toString()));
  } catch (e) {
    log(`file watcher unavailable: ${(e as Error).message}`);
  }

  return new Promise<{ port: number; close: () => Promise<void> }>((resolve) => {
    http.listen(opts.port, '127.0.0.1', () => {
      const addr = http.address();
      const port = typeof addr === 'object' && addr ? addr.port : opts.port;
      resolve({
        port,
        close: () =>
          new Promise<void>((r) => {
            active?.cancel();
            watcher?.close();
            for (const c of wss.clients) c.terminate();
            wss.close(() => http.close(() => r()));
          }),
      });
    });
  });
}
