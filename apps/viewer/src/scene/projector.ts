import type { Camera } from 'three';
import { Vector3 } from 'three';

/** Shared, non-reactive view of the scene camera, written every frame from inside the Canvas. */
export const projector: { camera: Camera | null; width: number; height: number } = { camera: null, width: 1, height: 1 };

/** Positions of moving objects (e.g. Bob's probes) that labels follow. */
export const dynamicAnchors = new Map<string, Vector3>();

const v = new Vector3();

/** Projects a world point to CSS pixels; returns undefined when behind the camera or off screen. */
export function project(x: number, y: number, z: number): { x: number; y: number; depth: number } | undefined {
  const cam = projector.camera;
  if (!cam) return undefined;
  v.set(x, y, z).project(cam);
  if (v.z > 1 || v.z < -1) return undefined;
  const sx = (v.x * 0.5 + 0.5) * projector.width;
  const sy = (-v.y * 0.5 + 0.5) * projector.height;
  if (sx < -200 || sx > projector.width + 200 || sy < -100 || sy > projector.height + 100) return undefined;
  return { x: sx, y: sy, depth: v.z };
}
