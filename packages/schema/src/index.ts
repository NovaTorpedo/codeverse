import { z } from 'zod';
import { AnalysisGraph, LIMITS } from './graph';
import { Investigation } from './investigation';
import { Recording } from './recording';
import { SemanticLayer } from './semantic';
import { Tour } from './tour';

export * from './common';
export * from './graph';
export * from './semantic';
export * from './investigation';
export * from './tour';
export * from './recording';
export * from './world';

export const AnyDocument = z.discriminatedUnion('kind', [AnalysisGraph, SemanticLayer, Investigation, Tour, Recording]);
export type AnyDocument = z.infer<typeof AnyDocument>;

export type ParseOutcome<T> = { ok: true; value: T } | { ok: false; error: string };

export function formatZodError(err: z.ZodError): string {
  return err.issues
    .slice(0, 6)
    .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('; ');
}

/** Parse untrusted JSON text with a size cap and schema validation. Never evaluates content. */
export function parseDocument(text: string, maxBytes: number = LIMITS.maxBytes): ParseOutcome<AnyDocument> {
  if (text.length > maxBytes) return { ok: false, error: `File is larger than ${Math.round(maxBytes / 1024 / 1024)} MB` };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Not valid JSON' };
  }
  const res = AnyDocument.safeParse(raw);
  if (!res.success) return { ok: false, error: formatZodError(res.error) };
  return { ok: true, value: res.data };
}
