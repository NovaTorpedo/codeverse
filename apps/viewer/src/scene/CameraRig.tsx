import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { CameraControls } from '@react-three/drei';
import type CameraControlsImpl from 'camera-controls';
import { Vector3 } from 'three';
import type { CityLayout } from '../layout/cityLayout';
import { useStore } from '../store';

/** Shared, non-reactive camera pose for the minimap. */
export const cameraPose = { x: 0, z: 0, tx: 0, tz: 0, yaw: 0 };

export function CameraRig({ layout }: { layout: CityLayout }) {
  const ref = useRef<CameraControlsImpl>(null);
  const focus = useStore((s) => s.focus);
  const reducedMotion = useStore((s) => s.reducedMotion);
  const { camera } = useThree();
  const target = useRef(new Vector3()).current;

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const r = layout.bounds.radius;
    void c.setLookAt(r * 1.9, r * 1.6, r * 2.2, 0, 0, 0, false);
    void c.setLookAt(r * 0.62, r * 0.55, r * 0.78, 0, 0, 0, !reducedMotion);
  }, [layout, reducedMotion]);

  useEffect(() => {
    const c = ref.current;
    if (!c || !focus) return;
    const a = layout.anchor(focus.id);
    if (!a) return;
    const d = focus.distance ?? Math.max(10, a.y * 2.4 + 8);
    void c.setLookAt(a.x + d * 0.55, a.y + d * 0.62, a.z + d * 0.8, a.x, a.y * 0.45, a.z, !reducedMotion);
  }, [focus, layout, reducedMotion]);

  useFrame(() => {
    const c = ref.current;
    if (!c) return;
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
      smoothTime={0.6}
      draggingSmoothTime={0.12}
    />
  );
}

export function useCameraApi() {
  return cameraPose;
}
