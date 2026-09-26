export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogRecord {
  ts: string;
  level: LogLevel;
  service: string;
  event: string;
  requestId?: string;
  [key: string]: unknown;
}

type Sink = (record: LogRecord) => void;

let sink: Sink = (record) => {
  if (process.env.SHOPFLOOR_LOGS === 'stdout') process.stdout.write(JSON.stringify(record) + '\n');
};
let clock: () => Date = () => new Date();

export function setLogSink(next: Sink): void {
  sink = next;
}

export function setLogClock(next: () => Date): void {
  clock = next;
}

export function createLogger(service: string) {
  const emit = (level: LogLevel, event: string, fields: Record<string, unknown> = {}) =>
    sink({ ts: clock().toISOString(), level, service, event, ...fields });
  return {
    debug: (event: string, fields?: Record<string, unknown>) => emit('debug', event, fields),
    info: (event: string, fields?: Record<string, unknown>) => emit('info', event, fields),
    warn: (event: string, fields?: Record<string, unknown>) => emit('warn', event, fields),
    error: (event: string, fields?: Record<string, unknown>) => emit('error', event, fields),
  };
}

export type Logger = ReturnType<typeof createLogger>;
