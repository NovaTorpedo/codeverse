import { Color } from 'three';

export const PALETTE = {
  cyan: '#64d2ff',
  teal: '#40c8e0',
  blue: '#0a84ff',
  indigo: '#5e5ce6',
  amber: '#ffb340',
  yellow: '#ffd60a',
  green: '#30d158',
  red: '#ff453a',
  pink: '#ff375f',
  white: '#e8f6ff',
};

/** Probe colors per lane: main agent first, then subagents. */
export const LANE_COLORS = [PALETTE.cyan, PALETTE.amber, PALETTE.pink, PALETTE.green, PALETTE.indigo, PALETTE.yellow];

export function laneColor(index: number): string {
  return LANE_COLORS[index % LANE_COLORS.length]!;
}

export function hueColor(hue: number, sat = 0.85, light = 0.58): Color {
  return new Color().setHSL((((hue % 360) + 360) % 360) / 360, sat, light);
}

export type BuildingTone = 'base' | 'dim' | 'visited' | 'active' | 'matched' | 'ok' | 'failed' | 'selected' | 'healed' | 'cited';

const TONE: Record<Exclude<BuildingTone, 'base' | 'dim'>, { color: string; boost: number }> = {
  visited: { color: PALETTE.amber, boost: 1.25 },
  active: { color: PALETTE.white, boost: 2.4 },
  matched: { color: PALETTE.cyan, boost: 1.8 },
  ok: { color: PALETTE.green, boost: 1.5 },
  failed: { color: PALETTE.red, boost: 2.6 },
  selected: { color: PALETTE.white, boost: 1.9 },
  healed: { color: PALETTE.green, boost: 2.0 },
  cited: { color: PALETTE.yellow, boost: 1.6 },
};

export function toneColor(tone: BuildingTone, hue: number, isTest: boolean, out = new Color()): Color {
  if (tone === 'base') return out.copy(hueColor(hue, isTest ? 0.35 : 0.8, isTest ? 0.42 : 0.55)).multiplyScalar(isTest ? 0.55 : 0.85);
  if (tone === 'dim') return out.copy(hueColor(hue, 0.3, 0.35)).multiplyScalar(0.28);
  const t = TONE[tone];
  return out.set(t.color).multiplyScalar(t.boost);
}
