import { Suspense, useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { Grid, Stars } from '@react-three/drei';
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';
import { currentIncident, useStore, type LoadedWorld } from '../store';
import { BobProbes } from './BobProbes';
import { Buildings } from './Buildings';
import { CameraRig } from './CameraRig';
import { Districts } from './Districts';
import { EdgeLines, Particles, SelectedEdges, useArcs } from './Edges';
import { Phantoms } from './Grounding';
import { IncidentPath } from './IncidentPath';
import { Cores, Gateways } from './Landmarks';
import { ProjectorBridge, SceneLabels } from './SceneLabels';
import { useHighlights } from './useHighlights';

function World({ world }: { world: LoadedWorld }) {
  const highlights = useHighlights();
  const arcs = useArcs(world.graph, world.layout);
  const reducedMotion = useStore((s) => s.reducedMotion);
  const mode = useStore((s) => s.mode);
  const stage = useStore((s) => s.stage);
  const incident = useStore(currentIncident);
  const introStart = useRef(performance.now()).current;
  const dim = highlights.dimOthers;
  const report = mode === 'incident' && stage !== 'investigate' && stage !== 'replay' ? incident?.grounding : mode === 'explore' ? world.semanticGrounding : undefined;
  return (
    <>
      <CameraRig layout={world.layout} />
      <Districts layout={world.layout} />
      <Buildings buildings={world.layout.buildings} highlights={highlights} introStart={introStart} />
      <EdgeLines arcs={arcs} dim={dim} />
      <Particles arcs={arcs} enabled={!reducedMotion && !dim} />
      <SelectedEdges arcs={arcs} />
      <Gateways layout={world.layout} />
      <Cores layout={world.layout} reducedMotion={reducedMotion} />
      <BobProbes layout={world.layout} />
      <IncidentPath layout={world.layout} />
      <Phantoms layout={world.layout} report={report} />
      <ProjectorBridge />
    </>
  );
}

export function CityScene({ world }: { world: LoadedWorld }) {
  const select = useStore((s) => s.select);
  const reducedMotion = useStore((s) => s.reducedMotion);
  const r = world.layout.bounds.radius;
  const fogFar = useMemo(() => r * 6, [r]);
  return (
    <>
    <Canvas
      dpr={[1, 2]}
      gl={{ antialias: true, powerPreference: 'high-performance', alpha: false }}
      camera={{ fov: 42, near: 0.1, far: r * 20, position: [r, r, r] }}
      onPointerMissed={() => select(undefined)}
      style={{ position: 'fixed', inset: 0 }}
      aria-label="3D city of the codebase"
    >
      <color attach="background" args={['#04060a']} />
      <fog attach="fog" args={['#04060a', r * 1.6, fogFar]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[20, 40, 10]} intensity={0.6} color="#bfe8ff" />
      <pointLight position={[0, 18, 0]} intensity={40} distance={r * 3} color="#64d2ff" />
      <Stars radius={r * 8} depth={40} count={reducedMotion ? 600 : 1800} factor={3} saturation={0} fade speed={reducedMotion ? 0 : 0.4} />
      <Grid
        position={[0, -0.01, 0]}
        args={[r * 8, r * 8]}
        cellSize={1.35}
        cellThickness={0.5}
        cellColor="#0f2733"
        sectionSize={10.8}
        sectionThickness={1}
        sectionColor="#16455a"
        fadeDistance={r * 4.2}
        fadeStrength={1.6}
        infiniteGrid
      />
      <Suspense fallback={null}>
        <World world={world} />
      </Suspense>
      <EffectComposer multisampling={0} enableNormalPass={false}>
        <Bloom mipmapBlur intensity={1.15} luminanceThreshold={0.55} luminanceSmoothing={0.2} radius={0.72} />
        <Vignette eskil={false} offset={0.22} darkness={0.72} />
      </EffectComposer>
    </Canvas>
    <SceneLabels world={world} />
    </>
  );
}
