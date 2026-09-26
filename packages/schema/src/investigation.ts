import { z } from 'zod';
import { Citation, GeneratedBy, LongText, RelPath, SCHEMA_VERSION, ShortText } from './common';

export const PathStep = z.object({
  id: z.string().max(80),
  label: z.string().max(80),
  /** Repo-relative file this step executes in. */
  file: RelPath,
  symbol: z.string().max(200).optional(),
  line: z.number().int().positive().optional(),
  status: z.enum(['ok', 'failed', 'not-reached']),
  note: ShortText.optional(),
});
export type PathStep = z.infer<typeof PathStep>;

export const Evidence = z.object({
  kind: z.enum(['ticket', 'log', 'code', 'test']),
  text: z.string().max(2000),
  citation: Citation.optional(),
});

export const RuledOut = z.object({
  hypothesis: ShortText,
  reason: LongText,
  citations: z.array(Citation).max(20).default([]),
});

export const ProposedFix = z.object({
  summary: LongText,
  /** Unified diff with repo-relative paths. */
  diff: z.string().max(60_000),
  files: z.array(RelPath).max(40),
  testsToRun: z.array(z.string().max(300)).max(20).default([]),
});

export const Verification = z.object({
  status: z.enum(['pending', 'passed', 'failed']),
  command: z.string().max(300).optional(),
  testsPassed: z.number().int().nonnegative().optional(),
  testsFailed: z.number().int().nonnegative().optional(),
  ranAt: z.string().max(40).optional(),
});

/** Bob's incident investigation. Written by /codeverse-investigate. */
export const Investigation = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  kind: z.literal('codeverse.investigation'),
  synthetic: z.boolean().default(false),
  generatedBy: GeneratedBy,
  target: RelPath,
  symptom: ShortText,
  summary: LongText,
  rootCause: z.object({
    title: ShortText,
    explanation: LongText,
    citations: z.array(Citation).min(1).max(30),
  }),
  executionPath: z.array(PathStep).min(2).max(30),
  failure: z.object({
    stepId: z.string().max(80),
    errorType: z.string().max(120),
    message: ShortText,
    citations: z.array(Citation).min(1).max(20),
  }),
  evidence: z.array(Evidence).max(40).default([]),
  ruledOut: z.array(RuledOut).max(20).default([]),
  fix: ProposedFix.optional(),
  verification: Verification.optional(),
});
export type Investigation = z.infer<typeof Investigation>;
