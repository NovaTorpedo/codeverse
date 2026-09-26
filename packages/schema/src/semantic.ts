import { z } from 'zod';
import { Citation, GeneratedBy, LongText, RelPath, SCHEMA_VERSION, ShortText } from './common';

export const SemanticService = z.object({
  id: z.string().max(200),
  name: z.string().max(120),
  responsibility: LongText,
  citations: z.array(Citation).min(1).max(50),
});
export type SemanticService = z.infer<typeof SemanticService>;

export const EntryPoint = z.object({
  file: RelPath,
  symbol: z.string().max(200).optional(),
  description: ShortText,
  citations: z.array(Citation).min(1).max(20),
});

export const FlowStep = z.object({
  from: z.string().max(600),
  to: z.string().max(600),
  via: z.string().max(200).optional(),
  citation: Citation,
});

export const DataFlow = z.object({
  id: z.string().max(80),
  name: z.string().max(120),
  description: LongText,
  steps: z.array(FlowStep).min(1).max(40),
});
export type DataFlow = z.infer<typeof DataFlow>;

/** Bob's semantic layer over the deterministic graph. Written by /codeverse-scan. */
export const SemanticLayer = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  kind: z.literal('codeverse.semantic'),
  synthetic: z.boolean().default(false),
  generatedBy: GeneratedBy,
  target: RelPath,
  summary: LongText,
  services: z.array(SemanticService).max(100),
  entryPoints: z.array(EntryPoint).max(100).default([]),
  dataFlows: z.array(DataFlow).max(50).default([]),
});
export type SemanticLayer = z.infer<typeof SemanticLayer>;
