import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { Claim } from '@codeverse/grounding';
import type { Vec3 } from '../layout/cityLayout';
import { currentIncident, useStore, type LoadedWorld } from '../store';
import { phantomSpots } from './Grounding';
import { stepAnchors } from './IncidentPath';
import { laneColor, PALETTE } from './palette';
import { dynamicAnchors, project, projector } from './projector';
import { usePlaybackState } from './useHighlights';

/** Inside the Canvas: keeps the projector in sync with the camera and viewport. */
export function ProjectorBridge() {
  const { camera, size } = useThree();
  useFrame(() => {
    projector.camera = camera;
    projector.width = size.width;
    projector.height = size.height;
  });
  return null;
}

interface LabelSpec {
  key: string;
  at: Vec3 | (() => Vec3 | undefined);
  className?: string;
  style?: React.CSSProperties;
  content: ReactNode;
  onClick?: () => void;
  title?: string;
  z?: number;
}

/**
 * All scene labels are plain DOM elements in one overlay, positioned every frame by projecting
 * their 3D anchor. No nested React roots, so mounting and unmounting is always safe.
 */
function LabelLayer({ labels }: { labels: LabelSpec[] }) {
  const refs = useRef(new Map<string, HTMLElement>());
  const specs = useRef(labels);
  specs.current = labels;
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      for (const l of specs.current) {
        const el = refs.current.get(l.key);
        if (!el) continue;
        const a = typeof l.at === 'function' ? l.at() : l.at;
        const p = a ? project(a.x, a.y, a.z) : undefined;
        if (!p) {
          el.style.visibility = 'hidden';
          continue;
        }
        el.style.visibility = 'visible';
        el.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0) translate(-50%, -100%)`;
        el.style.zIndex = String((l.z ?? 0) + Math.round((1 - p.depth) * 1000));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div aria-hidden={labels.every((l) => !l.onClick)} style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 10, overflow: 'hidden' }}>
      {labels.map((l) => {
        const common = {
          ref: (el: HTMLElement | null) => void (el ? refs.current.set(l.key, el) : refs.current.delete(l.key)),
          className: `label-pill ${l.className ?? ''}`,
          title: l.title,
          style: { position: 'absolute' as const, left: 0, top: 0, visibility: 'hidden' as const, ...l.style },
        };
        return l.onClick ? (
          <button key={l.key} {...common} style={{ ...common.style, pointerEvents: 'auto', cursor: 'pointer', border: 0 }} onClick={l.onClick}>
            {l.content}
          </button>
        ) : (
          <div key={l.key} {...common}>
            {l.content}
          </div>
        );
      })}
    </div>
  );
}

export function SceneLabels({ world }: { world: LoadedWorld }) {
  const { layout } = world;
  const hovered = useStore((s) => s.hovered);
  const selected = useStore((s) => s.selected);
  const mode = useStore((s) => s.mode);
  const stage = useStore((s) => s.stage);
  const progress = useStore((s) => s.pathProgress);
  const healed = useStore((s) => s.healed);
  const openCode = useStore((s) => s.openCode);
  const incident = useStore(currentIncident);
  const pb = usePlaybackState();
  const semanticNames = useMemo(() => new Map(world.semantic?.services.map((s) => [s.id, s.name]) ?? []), [world.semantic]);

  const labels: LabelSpec[] = [];
  const incidentView = mode === 'incident' && incident && stage !== 'investigate';

  if (!incidentView) {
    for (const d of layout.districts) {
      labels.push({
        key: `d:${d.id}`,
        at: { x: d.x, y: 0.2, z: d.z + d.r + 0.9 },
        className: 'district',
        content: (
          <>
            {semanticNames.get(d.id) ?? d.label}
            <span className="tertiary" style={{ marginLeft: 6, fontWeight: 500 }}>
              {d.fileCount}
            </span>
          </>
        ),
      });
    }
  }
  for (const c of layout.cores) labels.push({ key: `c:${c.id}`, at: { x: c.x, y: c.y + 2.4, z: c.z }, content: <>◉ {c.label}</> });

  const focusId = hovered ?? selected;
  const b = focusId ? layout.byId.get(focusId) : undefined;
  if (b) {
    labels.push({ key: `hover`, at: { x: b.x, y: b.h + 0.9, z: b.z }, z: 3000, content: (<>{b.node.label}<span className="tertiary" style={{ marginLeft: 6 }}>{b.node.loc} loc</span></>) });
  }
  const gw = focusId ? layout.gateways.find((g) => g.id === focusId) : undefined;
  if (gw) labels.push({ key: 'gw', at: { x: gw.x, y: 2.1, z: gw.z }, className: 'mono', z: 3000, content: gw.label });

  if (pb && !incidentView) {
    pb.lanes.forEach((l, i) => {
      if (l.kind !== 'subagent' || !l.active) return;
      labels.push({
        key: `lane:${l.id}`,
        at: () => {
          const p = dynamicAnchors.get(`probe:${l.id}`);
          return p ? { x: p.x, y: p.y + 0.9, z: p.z } : undefined;
        },
        style: { color: laneColor(i), fontSize: 10.5, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis' },
        content: <>⤷ {l.subagentType ?? 'subagent'} · {l.label}</>,
      });
    });
  }

  if (incidentView && incident) {
    const steps = incident.investigation.executionPath;
    const anchors = stepAnchors(steps, layout);
    const revealed = healed ? steps.length : Math.min(progress, steps.length);
    steps.slice(0, revealed).forEach((s, i) => {
      const a = anchors[i]!;
      const isFail = s.status === 'failed' && !healed;
      const notReached = s.status === 'not-reached' && !healed;
      labels.push({
        key: `step:${s.id}`,
        at: { x: a.x, y: a.y + 1.3, z: a.z },
        className: isFail ? 'fail' : notReached ? '' : 'ok',
        style: notReached ? { opacity: 0.55 } : undefined,
        z: isFail ? 2500 : 2000,
        content: (
          <>
            <span style={{ opacity: 0.6, marginRight: 6 }}>{i + 1}</span>
            {s.label}
            {isFail && <span style={{ marginLeft: 8 }}>✕ {s.note ?? incident.investigation.failure.errorType}</span>}
            {healed && s.status === 'failed' && <span style={{ marginLeft: 8 }}>✓ fixed</span>}
          </>
        ),
      });
    });
    if (stage === 'explain' || stage === 'fix') {
      const byFile = new Map<string, Claim>();
      for (const c of incident.grounding.claims) if (c.citation && c.where.startsWith('rootCause') && c.nodes.length && !byFile.has(c.citation.file)) byFile.set(c.citation.file, c);
      for (const c of byFile.values()) {
        const a = layout.anchor(c.citation!.file);
        if (!a) continue;
        const ok = c.status === 'grounded';
        labels.push({
          key: `pin:${c.id}`,
          at: { x: a.x, y: a.y + 3.2, z: a.z },
          style: { color: ok ? PALETTE.green : PALETTE.yellow },
          title: c.reason,
          z: 2800,
          onClick: () => openCode({ file: c.citation!.file, line: c.citation!.line, endLine: c.citation!.endLine, tone: 'yellow', title: c.citation!.symbol }),
          content: (
            <>
              {ok ? '✓' : '~'} {c.citation!.file.split('/').pop()}
              {c.citation!.line ? `:${c.citation!.line}` : ''}
            </>
          ),
        });
      }
    }
  }

  const report = mode === 'incident' && stage !== 'investigate' && stage !== 'replay' ? incident?.grounding : mode === 'explore' ? world.semanticGrounding : undefined;
  for (const p of phantomSpots(layout, report)) {
    labels.push({
      key: `ph:${p.claim.id}`,
      at: { x: p.at.x, y: 3.4, z: p.at.z },
      className: 'phantom',
      title: p.claim.reason,
      content: (
        <>
          ⚠ {p.claim.citation?.file.split('/').pop() ?? p.claim.label} <span className="tertiary">unverified</span>
        </>
      ),
    });
  }

  return <LabelLayer labels={labels} />;
}
