import { z } from 'zod';
import { SCHEMA_VERSION } from './common';

export const IncidentEntry = z.object({
  id: z.string().max(80),
  title: z.string().max(160),
  investigation: z.string().max(200),
  recording: z.string().max(200).optional(),
});
export type IncidentEntry = z.infer<typeof IncidentEntry>;

/** One explorable world bundled into the viewer at build time. Paths are relative to /data/. */
export const WorldEntry = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/),
  title: z.string().max(120),
  description: z.string().max(400),
  graph: z.string().max(200),
  semantic: z.string().max(200).optional(),
  tour: z.string().max(200).optional(),
  incidents: z.array(IncidentEntry).default([]),
  recordings: z.array(z.string().max(200)).default([]),
  synthetic: z.boolean(),
});
export type WorldEntry = z.infer<typeof WorldEntry>;

export const WorldIndex = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  kind: z.literal('codeverse.worlds'),
  builtAt: z.string(),
  worlds: z.array(WorldEntry).max(20),
});
export type WorldIndex = z.infer<typeof WorldIndex>;
