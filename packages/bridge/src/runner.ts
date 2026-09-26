import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { LineSplitter, parseLine } from '@codeverse/stream';
import { buildBobArgs, clampTurns, HARD_LIMITS, type BobArgsInput } from './guards';

export interface BobCommand {
  file: string;
  prefix: string[];
}

/**
 * Finds how to launch Bob Shell without a shell. On Windows, npm-style `bob.cmd` shims cannot be
 * spawned safely without `shell: true`, so the shim's JavaScript entry is run with Node instead.
 * CODEVERSE_BOB_BIN (an executable or .js/.mjs file) overrides detection.
 */
export function resolveBob(env: NodeJS.ProcessEnv = process.env): BobCommand {
  const override = env.CODEVERSE_BOB_BIN;
  if (override) return /\.(c|m)?js$/.test(override) ? { file: process.execPath, prefix: [override] } : { file: override, prefix: [] };
  if (process.platform !== 'win32') return { file: 'bob', prefix: [] };
  const dirs = (env.PATH ?? env.Path ?? '').split(path.delimiter).filter(Boolean);
  for (const d of dirs) {
    const exe = path.join(d, 'bob.exe');
    if (existsSync(exe)) return { file: exe, prefix: [] };
  }
  for (const d of dirs) {
    const cmd = path.join(d, 'bob.cmd');
    if (!existsSync(cmd)) continue;
    const text = readFileSync(cmd, 'utf8');
    const m = /"%(?:~?dp0)%\\([^"]+\.(?:c|m)?js)"/i.exec(text) ?? /"([A-Za-z]:\\[^"]+\.(?:c|m)?js)"/.exec(text);
    if (m) return { file: process.execPath, prefix: [path.isAbsolute(m[1]!) ? m[1]! : path.join(d, m[1]!)] };
  }
  throw new Error('Bob Shell not found. Install it (see Bob docs) or set CODEVERSE_BOB_BIN to its executable or JS entry.');
}

export interface RunOptions extends BobArgsInput {
  prompt: string;
  rawFile: string;
  timeoutMs?: number;
  onEvent: (event: Record<string, unknown>) => void;
  onStderr?: (text: string) => void;
  bob?: BobCommand;
}

export interface RunHandle {
  child: ChildProcess;
  cancel: () => void;
  done: Promise<{ exitCode: number | null; reason: 'exit' | 'timeout' | 'cancelled' | 'turn-cap' }>;
}

export function killTree(child: ChildProcess): void {
  if (child.exitCode !== null || child.pid === undefined) return;
  if (process.platform === 'win32') execFile('taskkill', ['/pid', String(child.pid), '/T', '/F'], () => undefined);
  else {
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch {
      child.kill('SIGKILL');
    }
  }
}

/** Spawns Bob Shell with an argument array, streams parsed events, persists the raw NDJSON. */
export function runBob(opts: RunOptions): RunHandle {
  const bob = opts.bob ?? resolveBob();
  const args = [...bob.prefix, ...buildBobArgs(opts)];
  mkdirSync(path.dirname(opts.rawFile), { recursive: true });
  const raw = createWriteStream(opts.rawFile, { encoding: 'utf8' });
  const child = spawn(bob.file, args, {
    shell: false,
    cwd: opts.workspace,
    windowsHide: true,
    detached: process.platform !== 'win32',
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
  });
  const maxTurns = clampTurns(opts.maxTurns);
  let reason: 'exit' | 'timeout' | 'cancelled' | 'turn-cap' = 'exit';
  let assistantTurns = 0;
  const splitter = new LineSplitter();
  const onLine = (line: string) => {
    raw.write(line + '\n');
    const parsed = parseLine(line);
    if (!parsed.ok) return;
    const ev = parsed.value;
    if (ev.type === 'message' && ev.role === 'assistant' && ev.isReasoning !== true) assistantTurns++;
    opts.onEvent(ev);
    if (assistantTurns > maxTurns + 2 && reason === 'exit') {
      reason = 'turn-cap';
      killTree(child);
    }
  };
  child.stdout!.setEncoding('utf8');
  child.stdout!.on('data', (chunk: string) => splitter.push(chunk).forEach(onLine));
  child.stderr!.setEncoding('utf8');
  child.stderr!.on('data', (t: string) => opts.onStderr?.(t.slice(0, 2000)));
  child.stdin!.end(opts.prompt);
  const timer = setTimeout(() => {
    reason = 'timeout';
    killTree(child);
  }, Math.min(opts.timeoutMs ?? HARD_LIMITS.timeoutMs, HARD_LIMITS.timeoutMs));
  const done = new Promise<{ exitCode: number | null; reason: typeof reason }>((resolve) => {
    const finish = (code: number | null) => {
      clearTimeout(timer);
      splitter.flush().forEach(onLine);
      raw.end(() => resolve({ exitCode: code, reason }));
    };
    child.on('close', finish);
    child.on('error', (err) => {
      opts.onStderr?.(`spawn failed: ${err.message}`);
      finish(null);
    });
  });
  return {
    child,
    done,
    cancel: () => {
      reason = 'cancelled';
      killTree(child);
    },
  };
}
