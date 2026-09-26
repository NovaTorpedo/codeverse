import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { AdditiveBlending, Color, Group, Mesh } from 'three';
import type { CityLayout } from '../layout/cityLayout';
import { useStore } from '../store';
import { PALETTE } from './palette';

/** API routes as glowing gateway arches at the district edge. */
export function Gateways({ layout }: { layout: CityLayout }) {
  const hovered = useStore((s) => s.hovered);
  const set = useStore((s) => s.set);
  const select = useStore((s) => s.select);
  return (
    <group>
      {layout.gateways.map((g) => (
        <group key={g.id} position={[g.x, 0, g.z]} rotation-y={-g.angle + Math.PI / 2}>
          <mesh
            position-y={0.9}
            onPointerOver={(e) => (e.stopPropagation(), set({ hovered: g.id }))}
            onPointerOut={() => set({ hovered: undefined })}
            onClick={(e) => (e.stopPropagation(), select(g.id))}
          >
            <torusGeometry args={[0.75, 0.07, 10, 40, Math.PI]} />
            <meshBasicMaterial color={new Color(PALETTE.teal).multiplyScalar(2)} toneMapped={false} />
          </mesh>
          <mesh position-y={0.02} rotation-x={-Math.PI / 2}>
            <circleGeometry args={[0.8, 32]} />
            <meshBasicMaterial color={PALETTE.teal} transparent opacity={0.12} blending={AdditiveBlending} depthWrite={false} />
          </mesh>
          {hovered === g.id && (
            <Html position={[0, 2.1, 0]} center style={{ pointerEvents: 'none' }}>
              <div className="label-pill mono">{g.label}</div>
            </Html>
          )}
        </group>
      ))}
    </group>
  );
}

/** Datastores as floating knowledge cores with a light beam into their district. */
export function Cores({ layout, reducedMotion }: { layout: CityLayout; reducedMotion: boolean }) {
  const refs = useRef<Array<Group | null>>([]);
  const shells = useRef<Array<Mesh | null>>([]);
  const select = useStore((s) => s.select);
  useFrame(({ clock }) => {
    if (reducedMotion) return;
    const t = clock.elapsedTime;
    refs.current.forEach((g, i) => g && (g.position.y = layout.cores[i]!.y + Math.sin(t * 1.2 + i) * 0.25));
    shells.current.forEach((m, i) => m && ((m.rotation.y = t * 0.35 + i), (m.rotation.x = t * 0.2)));
  });
  return (
    <group>
      {layout.cores.map((c, i) => (
        <group key={c.id}>
          <group ref={(el) => void (refs.current[i] = el)} position={[c.x, c.y, c.z]} onClick={(e) => (e.stopPropagation(), select(c.id))}>
            <mesh>
              <sphereGeometry args={[0.9, 32, 32]} />
              <meshBasicMaterial color={new Color(PALETTE.indigo).multiplyScalar(2.2)} toneMapped={false} />
            </mesh>
            <mesh ref={(el) => void (shells.current[i] = el)}>
              <icosahedronGeometry args={[1.6, 1]} />
              <meshBasicMaterial color={new Color(PALETTE.cyan).multiplyScalar(1.4)} wireframe transparent opacity={0.55} toneMapped={false} />
            </mesh>
            <Html position={[0, 2.4, 0]} center style={{ pointerEvents: 'none' }}>
              <div className="label-pill">◉ {c.label}</div>
            </Html>
          </group>
          <mesh position={[c.x, c.y / 2, c.z]}>
            <cylinderGeometry args={[0.05, 0.6, c.y, 16, 1, true]} />
            <meshBasicMaterial color={PALETTE.indigo} transparent opacity={0.16} blending={AdditiveBlending} depthWrite={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
