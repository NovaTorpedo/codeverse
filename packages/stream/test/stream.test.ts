import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyze } from '@codeverse/analyzer';
import { Recording } from '@codeverse/schema';
import { describeEvent, duration, globToRegExp, indexGraph, LineSplitter, normalizePath, RecordingBuilder, recordingFromNdjson, stateAt, targetsForToolUse, toolAction } from '../src';

const repoRoot = path.resolve(__dirname, '../../..');
const fixture = readFileSync(path.join(__dirname, 'fixtures/investigate.synthetic.ndjson'), 'utf8');
const graph = analyze({ repoRoot, target: 'demo/shopfloor', includeSources: false });
const idx = indexGraph(graph);
const meta = { id: 'synthetic-investigate', title: 'SYNTHETIC', target: 'demo/shopfloor', synthetic: true, source: 'fixture' as const };

describe('LineSplitter', () => {
  it('reassembles lines split across chunks and handles CRLF', () => {
    const s = new LineSplitter();
    expect(s.push('{"a":1}\r\n{"b"')).toEqual(['{"a":1}']);
    expect(s.push(':2}\n\n')).toEqual(['{"b":2}']);
    expect(s.push('{"c":3}')).toEqual([]);
    expect(s.flush()).toEqual(['{"c":3}']);
  });
  it('drops oversized lines without buffering forever', () => {
    const s = new LineSplitter(10);
    s.push('x'.repeat(50));
    expect(s.push('tail\n{"ok":1}\n')).toEqual(['{"ok":1}']);
  });
});

describe('RecordingBuilder', () => {
  it('parses the synthetic stream byte-by-byte identically to whole-text parsing', () => {
    const whole = recordingFromNdjson(fixture, meta, idx);
    const b = new RecordingBuilder(idx);
    for (let i = 0; i < fixture.length; i += 7) b.pushChunk(fixture.slice(i, i + 7));
    b.end();
    expect(JSON.stringify(b.build({ ...meta, recordedAt: whole.recordedAt }))).toBe(JSON.stringify(whole));
  });

  const rec = recordingFromNdjson(fixture, meta, idx);

  it('produces a schema-valid recording with result stats', () => {
    expect(Recording.safeParse(rec).success).toBe(true);
    expect(rec.result?.stats.tool_calls).toBe(13);
    expect(rec.result?.stats.session_costs).toBe(1.2);
  });

  it('keeps unknown event types without failing', () => {
    expect(rec.events.filter((e) => e.type === 'unknown').map((e) => e.content)).toEqual(['codeverse_fixture', 'future_event_kind']);
  });

  it('creates subagent lanes from spawn_subagent and routes their events', () => {
    const subs = rec.lanes.filter((l) => l.kind === 'subagent');
    expect(subs.map((l) => l.id)).toEqual(['sub:t03', 'sub:t04']);
    expect(subs[0]?.subagentType).toBe('explore');
    const readsInSub1 = rec.events.filter((e) => e.lane === 'sub:t03' && e.toolName === 'read_file').map((e) => e.targets[0]);
    expect(readsInSub1).toContain('demo/shopfloor/src/auth/session.store.ts');
    expect(rec.events.find((e) => e.toolId === 's2-02' && e.type === 'tool_use')?.lane).toBe('sub:t04');
    expect(rec.events.find((e) => e.toolId === 't06' && e.type === 'tool_use')?.lane).toBe('main');
  });

  it('maps tool calls and search output to graph nodes', () => {
    const glob = rec.events.find((e) => e.toolName === 'glob');
    expect(glob?.targets.sort()).toEqual(['demo/shopfloor/src/payment/card-gateway.client.ts', 'demo/shopfloor/src/payment/payment.service.ts']);
    const grepResult = rec.events.find((e) => e.type === 'tool_result' && e.toolId === 's1-01');
    expect(grepResult?.targets).toContain('demo/shopfloor/src/gateway/middleware.ts');
    const findSymbol = rec.events.find((e) => e.toolName === 'FindSymbol');
    expect(findSymbol?.targets).toEqual(['demo/shopfloor/src/customer/customer.service.ts']);
  });

  it('uses event timestamps for timing when present', () => {
    expect(duration(rec)).toBe(23_100);
  });

  it('merges streamed assistant text chunks into one message per turn', () => {
    const b = new RecordingBuilder(idx);
    const msg = (content: string) => JSON.stringify({ type: 'message', role: 'assistant', content });
    b.pushChunk([msg('I wi'), msg('ll re'), msg('ad the ticket.'), '{"type":"tool_use","tool_name":"read_file","tool_id":"a","parameters":{"path":"src/cart/cart.service.ts"}}', msg('Do'), msg('ne.')].join('\n') + '\n');
    expect(b.events.map((e) => e.type)).toEqual(['message', 'tool_use', 'message']);
    expect(b.events.map((e) => e.seq)).toEqual([0, 1, 2]);
    expect(b.events[0]?.content).toBe('I will read the ticket.');
    expect(b.events[2]?.content).toBe('Done.');
  });

  it('shows Windows paths from Bob Shell in repo style', () => {
    const b = new RecordingBuilder(idx);
    b.pushChunk('{"type":"tool_use","tool_name":"read_file","tool_id":"w","parameters":{"path":"demo\\\\shopfloor\\\\tickets\\\\INC-2417.txt"}}\n');
    expect(describeEvent(b.events[0]!)).toBe('read_file · demo/shopfloor/tickets/INC-2417.txt');
  });

  it('ignores non-JSON lines and prototype keys', () => {
    const b = new RecordingBuilder(idx);
    b.pushChunk('warning: not json\n{"type":"tool_use","tool_name":"read_file","tool_id":"x","parameters":{"__proto__":{"evil":1},"path":"src/cart/cart.service.ts"}}\n');
    expect(b.nonJsonLines).toBe(1);
    expect(b.events[0]?.targets).toEqual(['demo/shopfloor/src/cart/cart.service.ts']);
    expect(({} as Record<string, unknown>).evil).toBeUndefined();
  });
});

describe('mapper', () => {
  it('normalises paths Bob may emit', () => {
    expect(normalizePath('./demo/x.ts')).toBe('demo/x.ts');
    expect(normalizePath('@/demo/x.ts:10-20')).toBe('demo/x.ts');
    expect(normalizePath('C:\\work\\repo\\demo\\x.ts')).toBe('C:/work/repo/demo/x.ts');
  });
  it('resolves absolute and target-relative paths by suffix', () => {
    const t = targetsForToolUse(idx, { action: 'read', parameters: { path: '/home/someone/repo/demo/shopfloor/src/cart/cart.service.ts' } });
    expect(t).toEqual(['demo/shopfloor/src/cart/cart.service.ts']);
  });
  it('expands globs and directory searches', () => {
    expect(globToRegExp('src/**/*.service.ts').test('src/payment/payment.service.ts')).toBe(true);
    expect(globToRegExp('*.{ts,js}').test('a.js')).toBe(true);
    const t = targetsForToolUse(idx, { action: 'search', parameters: { pattern: 'charge', path: 'demo/shopfloor/src/payment' } });
    expect(t.length).toBe(2);
  });
  it('classifies documented Bob tools', () => {
    expect(['read_file', 'grep', 'glob', 'list_files', 'spawn_subagent', 'write_file', 'execute_command'].map(toolAction)).toEqual(['read', 'search', 'search', 'list', 'subagent', 'write', 'execute']);
  });
});

describe('playback', () => {
  const rec = recordingFromNdjson(fixture, meta, idx);
  it('tracks visited buildings, reasoning and lane activity over time', () => {
    const early = stateAt(rec, 0);
    expect(early.visited.size).toBe(0);
    const mid = stateAt(rec, 8_000);
    expect(mid.lanes.find((l) => l.id === 'sub:t03')?.active).toBe(true);
    expect(mid.reasoning?.content).toMatch(/Split the exploration/);
    const end = stateAt(rec, duration(rec));
    expect(end.done).toBe(true);
    expect(end.visited.has('demo/shopfloor/src/payment/payment.service.ts')).toBe(true);
    expect(end.lanes.every((l) => l.kind === 'main' || !l.active)).toBe(true);
  });
  it('describes events for the timeline list', () => {
    const labels = rec.events.map(describeEvent);
    expect(labels).toContain('read_file · demo/shopfloor/src/payment/payment.service.ts');
    expect(labels.at(-1)).toBe('Finished · success');
  });
});
