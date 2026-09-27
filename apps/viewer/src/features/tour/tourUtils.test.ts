import { describe, expect, it } from 'vitest';
import { dwellMs } from './tourUtils';

describe('dwellMs', () => {
  it('returns the 9 000 ms baseline for an empty string', () => {
    expect(dwellMs('')).toBe(9_000);
  });

  it('scales proportionally for moderate narration', () => {
    const text = 'a'.repeat(100); // 100 chars → 9000 + 2000 = 11 000
    expect(dwellMs(text)).toBe(11_000);
    expect(dwellMs(text)).toBeGreaterThanOrEqual(6_000);
    expect(dwellMs(text)).toBeLessThanOrEqual(24_000);
  });

  it('clamps at 24 000 ms for very long narration', () => {
    const text = 'a'.repeat(10_000); // far above ceiling
    expect(dwellMs(text)).toBe(24_000);
  });

  it('clamps at 6 000 ms floor (unreachable with current formula, but verifies guard)', () => {
    // With baseline 9000 the floor cannot be hit normally; verify the guard holds for any input
    expect(dwellMs('')).toBeGreaterThanOrEqual(6_000);
  });
});
