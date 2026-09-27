import { motion } from 'framer-motion';
import { useStore } from '../../store';
import { GroundingRing } from '../../ui/GroundingRing';
import { TourPlayer } from './TourPlayer';

/**
 * Tour extension point. The world's tour document (schema: codeverse.tour) is loaded into
 * `useStore().world.tour`; `flyTo(nodeId)` moves the camera and `set({ caption })` shows narration.
 * This baseline lists the stops; a guided player can replace it without changing the data contract.
 */
export function TourPanel() {
  const tour = useStore((s) => s.world?.tour);
  const grounding = useStore((s) => s.world?.tourGrounding);
  const mode = useStore((s) => s.mode);
  const flyTo = useStore((s) => s.flyTo);
  const openCode = useStore((s) => s.openCode);
  if (mode !== 'tour' || !tour) return null;
  return (
    <motion.aside
      className="glass"
      aria-label="Guided tour"
      initial={{ x: 40, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      style={{ position: 'fixed', right: 16, top: 72, width: 'min(380px, calc(100vw - 32px))', maxHeight: 'calc(100vh - 88px)', zIndex: 25, display: 'flex', flexDirection: 'column' }}
    >
      <header className="stack" style={{ padding: 16, gap: 6, borderBottom: '1px solid var(--separator)' }}>
        <span className="eyebrow">Guided tour · ~{tour.estimatedMinutes} min {tour.synthetic && <span className="chip orange">synthetic</span>}</span>
        <span className="title-2">{tour.title}</span>
        {grounding && <GroundingRing report={grounding} size={40} />}
      </header>
      <ol className="scroll" style={{ listStyle: 'none', margin: 0, padding: 12 }}>
        {tour.waypoints.map((w, i) => (
          <li key={w.id}>
            <button className="list-item" style={{ alignItems: 'flex-start' }} onClick={() => flyTo(w.node)}>
              <span className="chip cyan" style={{ flex: 'none' }}>
                {i + 1}
              </span>
              <span className="stack grow" style={{ gap: 3 }}>
                <span className="headline">{w.title}</span>
                <span className="caption" style={{ lineHeight: 1.45 }}>
                  {w.narration}
                </span>
                {w.related[0] && (
                  <span
                    className="caption mono"
                    role="link"
                    tabIndex={0}
                    style={{ color: 'var(--cyan)' }}
                    onClick={(e) => (e.stopPropagation(), openCode({ file: w.related[0]!.file, line: w.related[0]!.line }))}
                    onKeyDown={(e) => e.key === 'Enter' && openCode({ file: w.related[0]!.file, line: w.related[0]!.line })}
                  >
                    {w.related[0].file.split('/').pop()}
                    {w.related[0].line ? `:${w.related[0].line}` : ''}
                  </span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ol>
      <TourPlayer />
    </motion.aside>
  );
}
