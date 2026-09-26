import { z } from 'zod';
import { Citation, GeneratedBy, LongText, RelPath, SCHEMA_VERSION, ShortText } from './common';

export const Waypoint = z.object({
  id: z.string().max(80),
  /** Graph node id: a service id or a repo-relative file path. */
  node: z.string().max(600),
  title: z.string().max(120),
  narration: LongText,
  notice: z.array(ShortText).max(8).default([]),
  related: z.array(Citation).max(12).default([]),
  deeper: z
    .array(z.object({ question: ShortText, answer: LongText, citations: z.array(Citation).max(12).default([]) }))
    .max(6)
    .default([]),
});
export type Waypoint = z.infer<typeof Waypoint>;

/** Onboarding tour. Written by /codeverse-tour. */
export const Tour = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  kind: z.literal('codeverse.tour'),
  synthetic: z.boolean().default(false),
  generatedBy: GeneratedBy,
  target: RelPath,
  title: z.string().max(120),
  estimatedMinutes: z.number().positive().max(60),
  waypoints: z.array(Waypoint).min(1).max(30),
});
export type Tour = z.infer<typeof Tour>;
