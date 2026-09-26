import { z } from 'zod';
import { RelPath, SCHEMA_VERSION } from './common';

/** Mirrors the `stats` object of Bob Shell's final `result` event. */
export const ResultStats = z
  .object({
    task_id: z.string().max(200).optional(),
    total_tokens: z.number().nonnegative().optional(),
    input_tokens: z.number().nonnegative().optional(),
    output_tokens: z.number().nonnegative().optional(),
    cache_read_tokens: z.number().nonnegative().optional(),
    cache_write_tokens: z.number().nonnegative().optional(),
    cache_ratio: z.number().nonnegative().optional(),
    duration_ms: z.number().nonnegative().optional(),
    session_costs: z.number().nonnegative().optional(),
    tool_calls: z.number().nonnegative().optional(),
  })
  .loose();
export type ResultStats = z.infer<typeof ResultStats>;

export const ToolAction = z.enum(['read', 'search', 'list', 'symbol', 'write', 'execute', 'subagent', 'skill', 'mode', 'todo', 'question', 'other']);
export type ToolAction = z.infer<typeof ToolAction>;

/** One normalised Bob Shell stream-json event with its arrival offset. */
export const RecEvent = z.object({
  seq: z.number().int().nonnegative(),
  /** Milliseconds since the first event. */
  t: z.number().nonnegative(),
  type: z.enum(['message', 'tool_use', 'tool_result', 'error', 'result', 'unknown']),
  /** 'main' or a subagent lane id. */
  lane: z.string().max(200).default('main'),
  role: z.string().max(40).optional(),
  content: z.string().max(20_000).optional(),
  isReasoning: z.boolean().optional(),
  toolName: z.string().max(120).optional(),
  toolId: z.string().max(200).optional(),
  action: ToolAction.optional(),
  parameters: z.record(z.string(), z.unknown()).optional(),
  status: z.string().max(40).optional(),
  output: z.string().max(20_000).optional(),
  error: z.string().max(4000).optional(),
  severity: z.string().max(40).optional(),
  /** Graph node ids this event touches, filled by the mapper. */
  targets: z.array(z.string().max(600)).max(200).default([]),
});
export type RecEvent = z.infer<typeof RecEvent>;

export const Lane = z.object({
  id: z.string().max(200),
  label: z.string().max(200),
  kind: z.enum(['main', 'subagent']),
  subagentType: z.string().max(40).optional(),
  startSeq: z.number().int().nonnegative(),
  endSeq: z.number().int().nonnegative().optional(),
});
export type Lane = z.infer<typeof Lane>;

export const Recording = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  kind: z.literal('codeverse.recording'),
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,79}$/),
  title: z.string().max(160),
  synthetic: z.boolean(),
  scrubbed: z.boolean(),
  source: z.enum(['bob-shell', 'bob-ide', 'fixture']),
  recordedAt: z.string().max(40),
  target: RelPath,
  command: z
    .object({
      mode: z.string().max(80).optional(),
      maxCost: z.number().positive().optional(),
      maxTurns: z.number().int().positive().optional(),
      disabledToolGroups: z.array(z.string().max(40)).max(20).default([]),
      prompt: z.string().max(4000).optional(),
    })
    .default({ disabledToolGroups: [] }),
  lanes: z.array(Lane).max(50).default([]),
  events: z.array(RecEvent).max(20_000),
  result: z
    .object({
      status: z.string().max(40),
      stats: ResultStats.default({}),
      last_message: z.string().max(40_000).optional(),
    })
    .optional(),
});
export type Recording = z.infer<typeof Recording>;
