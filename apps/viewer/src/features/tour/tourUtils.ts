/**
 * Returns the auto-advance dwell time in milliseconds for a tour stop.
 * Baseline is 9 000 ms; adds ~20 ms per character of narration text.
 * Clamped to [6 000, 24 000] ms.
 */
export function dwellMs(narration: string): number {
  const base = 9_000;
  const perChar = 20;
  const raw = base + narration.length * perChar;
  return Math.max(6_000, Math.min(24_000, raw));
}
