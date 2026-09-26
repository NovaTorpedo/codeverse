import { z } from 'zod';

export const SCHEMA_VERSION = 1 as const;

/** Repo-relative POSIX path. Absolute paths, drive letters, backslashes and parent traversal are rejected. */
export const RelPath = z
  .string()
  .min(1)
  .max(512)
  .refine((p) => !p.startsWith('/') && !/^[A-Za-z]:/.test(p) && !p.includes('\\') && !p.split('/').includes('..'), {
    message: 'must be a repo-relative POSIX path',
  });

export const ShortText = z.string().max(400);
export const LongText = z.string().max(8000);

/** A claim's pointer into the code: file, optional line range and optional symbol. */
export const Citation = z.object({
  file: RelPath,
  line: z.number().int().positive().optional(),
  endLine: z.number().int().positive().optional(),
  symbol: z.string().max(200).optional(),
});
export type Citation = z.infer<typeof Citation>;

export const GeneratedBy = z.object({
  tool: z.enum(['ibm-bob', 'codeverse-synthetic']),
  client: z.enum(['bob-ide', 'bob-shell', 'fixture']).optional(),
  mode: z.string().max(80).optional(),
  skill: z.string().max(80).optional(),
  recordedAt: z.string().max(40).optional(),
});
export type GeneratedBy = z.infer<typeof GeneratedBy>;
