import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { CameraControls } from '@react-three/drei';
import type CameraControlsImpl from 'camera-controls';
import { Vector3 } from 'three';
import type { CityLayout } from '../layout/cityLayout';
import { OVERVIEW, useStore } from '../store';

/** Shared, non-reactive camera pose for overlays. */
export const cameraPose = { x: 0, z: 0, tx: 0, tz: 0, yaw: 0 };

/** The calm establishing shot: the whole city, slightly from above. `k` scales the distance. */
function overviewPose(layout: CityLayout, k = 1, narrow = false): [number, number, number, number, number, number] {
  const r = layout.bounds.radius * k * (narrow ? 1.5 : 1);
  return [r * 0.92, r * 0.95, r * 1.22, 0, -1, 0];
}

export function CameraRig({ layout }: { layout: CityLayout }) {
  const ref = useRef<CameraControlsImpl>(null);
  const focus = useStore((s) => s.focus);
  const reducedMotion = useStore((s) => s.reducedMotion);
  const idle = useStore((s) => s.introOpen || s.orbit);
  const narrow = useStore((s) => s.isMobile);
  const { camera } = useThree();
  const target = useRef(new Vector3()).current;

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const r = layout.bounds.radius;
    void c.setLookAt(r * 1.9, r * 1.6, r * 2.2, 0, 0, 0, false);
    void c.setLookAt(...overviewPose(layout, 1, narrow), !reducedMotion);
  }, [layout, reducedMotion, narrow]);

  useEffect(() => {
    const c = ref.current;
    if (!c || !focus) return;
    if (focus.id === OVERVIEW) {
      void c.setLookAt(...overviewPose(layout, focus.distance ?? 1, narrow), !reducedMotion);
      return;
    }
    const a = focus.point ?? layout.anchor(focus.id);
    if (!a) return;
    const d = (focus.distance ?? Math.max(22, a.y * 2.4 + 16)) * (narrow ? 1.35 : 1);
    void c.setLookAt(a.x + d * 0.55, a.y + d * 0.62, a.z + d * 0.8, a.x, a.y * 0.45, a.z, !reducedMotion);
  }, [focus, layout, reducedMotion, narrow]);

  useFrame((_, dt) => {
    const c = ref.current;
    if (!c) return;
    // A slow drift behind the intro, so the city feels alive without demanding attention.
    if (idle && !reducedMotion) void c.rotate(dt * 0.045, 0, false);
    const t = c.getTarget(target);
    cameraPose.x = camera.position.x;
    cameraPose.z = camera.position.z;
    cameraPose.tx = t.x;
    cameraPose.tz = t.z;
    cameraPose.yaw = Math.atan2(t.x - camera.position.x, t.z - camera.position.z);
  });

  return (
    <CameraControls
      ref={ref}
      makeDefault
      minDistance={4}
      maxDistance={layout.bounds.radius * 4.5}
      maxPolarAngle={Math.PI * 0.47}
      smoothTime={0.75}
      draggingSmoothTime={0.12}
    />
  );
}
