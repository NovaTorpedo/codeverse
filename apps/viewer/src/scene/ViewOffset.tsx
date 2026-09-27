import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { PerspectiveCamera } from 'three';
import { insets } from '../ui/insets';

/**
 * Centres the city in the space the chrome leaves free: the projection is shifted (setViewOffset) so the
 * dock and side panel never cover the middle of the scene. Raycasting and labels use the same projection.
 */
export function ViewOffset() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  const cur = useRef({ x: 0, y: 0 });
  useFrame((_, dt) => {
    const tx = insets.right / 2;
    const ty = Math.max(0, insets.bottom - 60) / 2;
    const c = cur.current;
    const k = Math.min(1, dt * 5);
    const x = Math.abs(tx - c.x) < 0.5 ? tx : c.x + (tx - c.x) * k;
    const y = Math.abs(ty - c.y) < 0.5 ? ty : c.y + (ty - c.y) * k;
    const view = camera.view;
    const same = view?.enabled && view.offsetX === x && view.offsetY === y && view.fullWidth === size.width && view.fullHeight === size.height;
    if (same || (x === 0 && y === 0 && !view?.enabled)) return;
    c.x = x;
    c.y = y;
    if (x === 0 && y === 0) camera.clearViewOffset();
    else camera.setViewOffset(size.width, size.height, x, y, size.width, size.height);
  });
  return null;
}
