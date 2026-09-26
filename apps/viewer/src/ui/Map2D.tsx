import { useMemo } from 'react';
import { hueColor } from '../scene/palette';
import { useHighlights } from '../scene/useHighlights';
import { currentIncident, useStore, type LoadedWorld } from '../store';

const TONE_FILL: Record<string, string> = { visited: '#ffb340', active: '#ffffff', matched: '#64d2ff', ok: '#30d158', failed: '#ff453a', selected: '#ffffff', healed: '#30d158', cited: '#ffd60a' };

/** Accessible 2D fallback for small screens, no-WebGL and reduced-motion users. */
export function Map2D({ world }: { world: LoadedWorld }) {
  const select = useStore((s) => s.select);
  const selected = useStore((s) => s.selected);
  const mode = useStore((s) => s.mode);
  const stage = useStore((s) => s.stage);
  const progress = useStore((s) => s.pathProgress);
  const healed = useStore((s) => s.healed);
  const incident = useStore(currentIncident);
  const { tones, dimOthers } = useHighlights();
  const { layout } = world;
  const R = layout.bounds.radius * 1.1;
  const path = useMemo(() => {
    if (mode !== 'incident' || !incident || stage === 'investigate') return [];
    const steps = incident.investigation.executionPath;
    const n = healed ? steps.length : Math.min(progress, steps.length);
    return steps.slice(0, n).map((s) => ({ s, a: layout.anchor(s.file) })).filter((x) => x.a);
  }, [mode, incident, stage, progress, healed, layout]);
  return (
    <div style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', background: 'radial-gradient(ellipse at 50% 55%, #0b1722 0%, #04060a 70%)' }}>
      <svg viewBox={`${-R} ${-R} ${R * 2} ${R * 2}`} style={{ width: 'min(100vw, 100vh)', height: 'min(100vw, 100vh)' }} role="img" aria-label="2D map of the codebase">
        {layout.districts.map((d) => (
          <g key={d.id}>
            <circle cx={d.x} cy={d.z} r={d.r} fill={`#${hueColor(d.hue, 0.8, 0.5).getHexString()}14`} stroke={`#${hueColor(d.hue, 0.8, 0.6).getHexString()}`} strokeWidth={0.12} />
            <text x={d.x} y={d.z + d.r + 1.2} textAnchor="middle" fontSize={1.1} fill="rgba(255,255,255,0.75)" fontFamily="var(--font)">
              {d.label}
            </text>
          </g>
        ))}
        {path.length > 1 && <polyline points={path.map((p) => `${p.a!.x},${p.a!.z}`).join(' ')} fill="none" stroke={healed ? '#30d158' : '#64d2ff'} strokeWidth={0.25} strokeDasharray="0.6 0.3" />}
        {layout.buildings.map((b) => {
          const tone = tones.get(b.id);
          const fill = tone ? TONE_FILL[tone] : dimOthers ? 'rgba(120,140,160,0.25)' : `#${hueColor(b.hue, 0.8, 0.6).getHexString()}`;
          return (
            <rect
              key={b.id}
              x={b.x - b.w / 2}
              y={b.z - b.d / 2}
              width={b.w}
              height={b.d}
              rx={0.15}
              fill={fill}
              opacity={tone ? 1 : 0.75}
              stroke={selected === b.id ? '#fff' : 'none'}
              strokeWidth={0.15}
              tabIndex={0}
              role="button"
              aria-label={b.node.label}
              onClick={() => select(b.id)}
              onKeyDown={(e) => e.key === 'Enter' && select(b.id)}
              style={{ cursor: 'pointer' }}
            >
              <title>{b.node.id}</title>
            </rect>
          );
        })}
        {layout.cores.map((c) => (
          <circle key={c.id} cx={c.x} cy={c.z} r={0.9} fill="#5e5ce6" />
        ))}
      </svg>
    </div>
  );
}
