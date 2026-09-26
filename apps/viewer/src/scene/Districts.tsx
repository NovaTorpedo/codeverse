import { AdditiveBlending } from 'three';
import type { CityLayout } from '../layout/cityLayout';
import { useStore } from '../store';
import { hueColor } from './palette';

export function Districts({ layout }: { layout: CityLayout }) {
  const flyTo = useStore((s) => s.flyTo);
  return (
    <group>
      {layout.districts.map((d) => {
        const c = hueColor(d.hue, 0.9, 0.55);
        return (
          <group key={d.id} position={[d.x, 0, d.z]}>
            <mesh rotation-x={-Math.PI / 2} position-y={0.02} onClick={(e) => (e.stopPropagation(), flyTo(d.id, d.r * 3.2))}>
              <circleGeometry args={[d.r, 64]} />
              <meshStandardMaterial color="#0a1119" metalness={0.6} roughness={0.35} transparent opacity={0.82} />
            </mesh>
            <mesh rotation-x={-Math.PI / 2} position-y={0.04}>
              <ringGeometry args={[d.r - 0.08, d.r, 96]} />
              <meshBasicMaterial color={c.clone().multiplyScalar(d.isTest ? 0.6 : 1.4)} toneMapped={false} transparent opacity={0.9} blending={AdditiveBlending} />
            </mesh>
            <mesh rotation-x={-Math.PI / 2} position-y={0.03}>
              <ringGeometry args={[d.r * 0.25, d.r - 0.1, 64]} />
              <meshBasicMaterial color={c} transparent opacity={0.035} blending={AdditiveBlending} depthWrite={false} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
