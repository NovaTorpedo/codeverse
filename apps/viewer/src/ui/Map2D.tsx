import { useMemo } from 'react';
import { hueColor } from '../scene/palette';
import { useHighlights } from '../scene/useHighlights';
import { flowsFor } from '../story/flows';
import { currentIncident, useStore, type LoadedWorld } from '../store';

const TONE_FILL: Record<string, string> = { visited: '#ffb340', active: '#ffffff', matched: '#64d2ff', ok: '#30d158', failed: '#ff453a', selected: '#ffffff', healed: '#30d158', cited: '#ffd60a' };

/** Accessible 2D map: phones, no-WebGL and anyone who prefers it. Fits the space between the top bar and the dock. */
export function Map2D({ world }: { world: LoadedWorld }) {
  const select = useStore((s) => s.select);
  const selected = useStore((s) => s.selected);
  const mode = useStore((s) => s.mode);
  const stage = useStore((s) => s.stage);
  const progress = useStore((s) => s.pathProgress);
  const healed = useStore((s) => s.healed);
  const flow = useStore((s) => s.flow);
  const incident = useStore(currentIncident);
  const { tones, dimOthers } = useHighlights();
  const { layout } = world;
  const names = useMemo(() => new Map(world.semantic?.services.map((s) => [s.id, s.name]) ?? []), [world.semantic]);
  const b = layout.bounds;
  const pad = 3;
  const vb = { x: b.minX - pad, y: b.minZ - pad - 2, w: b.maxX - b.minX + pad * 2, h: b.maxZ - b.minZ + pad * 2 + 4 };
  const font = Math.max(1.3, Math.max(vb.w, vb.h) * 0.026);

  const path = useMemo(() => {
    if (mode !== 'incident' || !incident || stage === 'investigate') return [];
    const steps = incident.investigation.executionPath;
    const n = healed ? steps.length : Math.min(progress, steps.length);
    return steps.slice(0, n).map((s) => ({ s, a: layout.anchor(s.file) })).filter((x) => x.a);
  }, [mode, incident, stage, progress, healed, layout]);
  const f = flow ? flowsFor(world).find((x) => x.id === flow.id) : undefined;
  const failAt = path.find((p) => p.s.status === 'failed' && !healed);

  return (
    <div style={{ position: 'fixed', left: 0, right: 0, top: 'var(--top)', bottom: 'calc(var(--dock-h) + var(--gutter) + 8px)', display: 'grid', placeItems: 'center', background: 'radial-gradient(ellipse at 50% 55%, #0b1722 0%, #05070b 70%)' }}>
      <div style={{ position: 'fixed', inset: 0, zIndex: -1, background: 'radial-gradient(ellipse at 50% 45%, #0b1722 0%, #05070b 70%)' }} />
      <svg viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} preserveAspectRatio="xMidYMid meet" style={{ width: '100%', height: '100%', padding: '0 12px' }} role="img" aria-label="2D map of the codebase">
        {layout.districts.map((d) => {
          const on = selected === d.id;
          return (
            <g key={d.id} role="button" tabIndex={0} aria-label={`District ${names.get(d.id) ?? d.label}`} onClick={() => select(d.id)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && select(d.id)} style={{ cursor: 'pointer' }}>
              <circle cx={d.x} cy={d.z} r={d.r} fill={`#${hueColor(d.hue, 0.8, 0.5).getHexString()}${on ? '33' : '16'}`} stroke={on ? '#fff' : `#${hueColor(d.hue, 0.8, 0.6).getHexString()}`} strokeWidth={on ? 0.28 : 0.14} opacity={dimOthers && !on ? 0.55 : 1} />
              <text x={d.x} y={d.z + d.r + font * 1.05} textAnchor="middle" fontSize={font} fontWeight={600} fill="rgba(255,255,255,0.82)" fontFamily="var(--font)">
                {names.get(d.id) ?? d.label}
              </text>
            </g>
          );
        })}
        {path.length > 1 && <polyline points={path.map((p) => `${p.a!.x},${p.a!.z}`).join(' ')} fill="none" stroke={healed ? '#30d158' : '#64d2ff'} strokeWidth={0.32} strokeDasharray="0.7 0.35" strokeLinejoin="round" />}
        {f &&
          f.hops.slice(0, flow!.step + 1).map((h, i) => {
            const a = layout.anchor(h.from);
            const c = layout.anchor(h.to);
            if (!a || !c) return null;
            return <line key={i} x1={a.x} y1={a.z} x2={c.x} y2={c.z} stroke={h.status === 'failed' ? '#ff453a' : f.incident ? '#30d158' : '#64d2ff'} strokeWidth={i === flow!.step ? 0.45 : 0.28} strokeLinecap="round" opacity={i === flow!.step ? 1 : 0.7} />;
          })}
        {layout.buildings.map((bd) => {
          const tone = tones.get(bd.id);
          const fill = tone ? TONE_FILL[tone] : dimOthers ? 'rgba(120,140,160,0.25)' : `#${hueColor(bd.hue, 0.8, 0.6).getHexString()}`;
          return (
            <rect
              key={bd.id}
              x={bd.x - bd.w / 2}
              y={bd.z - bd.d / 2}
              width={bd.w}
              height={bd.d}
              rx={0.18}
              fill={fill}
              opacity={tone ? 1 : 0.8}
              stroke={selected === bd.id ? '#fff' : 'none'}
              strokeWidth={0.2}
              tabIndex={0}
              role="button"
              aria-label={`File ${bd.node.label}`}
              onClick={(e) => (e.stopPropagation(), select(bd.id))}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.stopPropagation(), select(bd.id))}
              style={{ cursor: 'pointer' }}
            >
              <title>{bd.node.id}</title>
            </rect>
          );
        })}
        {layout.cores.map((c) => (
          <circle key={c.id} cx={c.x} cy={c.z} r={1} fill="#7b79ff" stroke="#64d2ff" strokeWidth={0.15} role="button" tabIndex={0} aria-label="Datastore" onClick={(e) => (e.stopPropagation(), select(c.id))} style={{ cursor: 'pointer' }} />
        ))}
        {failAt && (
          <g>
            <circle cx={failAt.a!.x} cy={failAt.a!.z} r={2.2} fill="none" stroke="#ff453a" strokeWidth={0.3} />
            <text x={failAt.a!.x} y={failAt.a!.z - 2.8} textAnchor="middle" fontSize={font * 0.95} fontWeight={700} fill="#ff7b72" fontFamily="var(--font)">
              ✕ {failAt.s.label}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}
