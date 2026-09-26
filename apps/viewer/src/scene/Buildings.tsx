import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { BoxGeometry, Color, InstancedMesh, Object3D } from 'three';
import type { Building } from '../layout/cityLayout';
import { useStore } from '../store';
import { createBuildingMaterial } from './materials';
import { toneColor, type BuildingTone } from './palette';
import type { Highlights } from './useHighlights';

const tmp = new Object3D();
const col = new Color();
const INTRO_MS = 2600;

export function Buildings({ buildings, highlights, introStart }: { buildings: Building[]; highlights: Highlights; introStart: number }) {
  const ref = useRef<InstancedMesh>(null);
  const geometry = useMemo(() => new BoxGeometry(1, 1, 1).translate(0, 0.5, 0), []);
  const material = useMemo(() => createBuildingMaterial(), []);
  const set = useStore((s) => s.set);
  const select = useStore((s) => s.select);
  const reducedMotion = useStore((s) => s.reducedMotion);
  const introDone = useRef(false);
  const maxDist = useMemo(() => Math.max(1, ...buildings.map((b) => Math.hypot(b.x, b.z))), [buildings]);
  const tonesRef = useRef<BuildingTone[]>([]);

  const writeMatrices = (progress: (b: Building) => number, pulse?: (i: number) => number) => {
    const mesh = ref.current;
    if (!mesh) return;
    buildings.forEach((b, i) => {
      const p = progress(b);
      const k = pulse ? pulse(i) : 1;
      tmp.position.set(b.x, 0, b.z);
      tmp.scale.set(b.w * k, Math.max(0.001, b.h * p), b.d * k);
      tmp.updateMatrix();
      mesh.setMatrixAt(i, tmp.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  };

  useLayoutEffect(() => {
    introDone.current = reducedMotion;
    writeMatrices(() => (reducedMotion ? 1 : 0));
    ref.current?.computeBoundingSphere();
  }, [buildings, reducedMotion]);

  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const tones: BuildingTone[] = [];
    buildings.forEach((b, i) => {
      const tone = highlights.tones.get(b.id) ?? (highlights.dimOthers ? 'dim' : 'base');
      tones.push(tone);
      mesh.setColorAt(i, toneColor(tone, b.hue, b.node.isTest, col));
    });
    tonesRef.current = tones;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [buildings, highlights]);

  useFrame(({ clock }) => {
    material.uniforms.uTime!.value = clock.elapsedTime;
    const now = performance.now();
    if (!introDone.current) {
      const t = (now - introStart) / INTRO_MS;
      writeMatrices((b) => {
        const delay = (Math.hypot(b.x, b.z) / maxDist) * 0.55;
        const x = Math.min(1, Math.max(0, (t - delay) / 0.45));
        return 1 - Math.pow(1 - x, 3);
      });
      if (t > 1.05) introDone.current = true;
      return;
    }
    const tones = tonesRef.current;
    if (!reducedMotion && tones.some((t) => t === 'active' || t === 'failed')) {
      writeMatrices(
        () => 1,
        (i) => (tones[i] === 'active' ? 1 + Math.sin(now / 140) * 0.08 : tones[i] === 'failed' ? 1 + Math.sin(now / 60) * 0.03 : 1),
      );
    }
  });

  const onMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const b = e.instanceId !== undefined ? buildings[e.instanceId] : undefined;
    set({ hovered: b?.id });
    document.body.style.cursor = b ? 'pointer' : '';
  };
  const onOut = () => {
    set({ hovered: undefined });
    document.body.style.cursor = '';
  };
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const b = e.instanceId !== undefined ? buildings[e.instanceId] : undefined;
    if (b) select(b.id);
  };

  return (
    <instancedMesh
      key={buildings.length}
      ref={ref}
      args={[geometry, material, buildings.length]}
      onPointerMove={onMove}
      onPointerOut={onOut}
      onClick={onClick}
      frustumCulled={false}
    />
  );
}

