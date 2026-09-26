import { Vector3 } from 'three';
import type { Vec3 } from '../layout/cityLayout';

/** Point on a quadratic arc between a and b that lifts proportionally to distance. */
export function arcPoint(a: Vec3, b: Vec3, t: number, lift = 0.32, out = new Vector3()): Vector3 {
  const dist = Math.hypot(b.x - a.x, b.z - a.z);
  const mx = (a.x + b.x) / 2;
  const mz = (a.z + b.z) / 2;
  const my = Math.max(a.y, b.y) + 1.2 + dist * lift;
  const u = 1 - t;
  out.set(u * u * a.x + 2 * u * t * mx + t * t * b.x, u * u * a.y + 2 * u * t * my + t * t * b.y, u * u * a.z + 2 * u * t * mz + t * t * b.z);
  return out;
}

export function arcPoints(a: Vec3, b: Vec3, segments = 16, lift = 0.32): Vector3[] {
  return Array.from({ length: segments + 1 }, (_, i) => arcPoint(a, b, i / segments, lift));
}
