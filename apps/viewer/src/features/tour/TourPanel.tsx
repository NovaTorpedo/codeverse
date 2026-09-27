import { motion } from 'framer-motion';
import { useStore } from '../../store';
import { GroundingRing } from '../../ui/GroundingRing';
import { Icon } from '../../ui/icons';
import { TourPlayer } from './TourPlayer';

/**
 * Tour extension point. The world's tour document (schema: codeverse.tour) is loaded into
 * `useStore().world.tour`; `flyTo(nodeId)` moves the camera and `set({ caption })` shows narration.
 * The panel lists the stops (desktop); Bob's TourPlayer drives playback on every screen size.
 */
export function TourPanel({ onClose }: { onClose: () => void }) {
  const tour = useStore((s) => s.world?.tour);
  const grounding = useStore((s) => s.world?.tourGrounding);
  const mode = useStore((s) => s.mode);
  const flyTo = useStore((s) => s.flyTo);
  const openCode = useStore((s) => s.openCode);
  if (mode !== 'tour' || !tour) return null;
  return (
    <>
      <motion.aside className="glass thick panel only-desktop" aria-label="Guided tour" initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }}>
        <header>
          <div className="stack grow" style={{ gap: 6 }}>
            <span className="eyebrow">Bob's guided tour · ~{tour.estimatedMinutes} min {tour.synthetic && <span className="chip orange">synthetic</span>}</span>
            <span className="title-2">{tour.title}</span>
            {grounding && <GroundingRing report={grounding} size={40} />}
          </div>
          <button className="btn icon sm" aria-label="Close the tour" onClick={onClose}>
            <Icon.close />
          </button>
        </header>
        <ol className="scroll" style={{ listStyle: 'none', margin: 0, padding: '0 12px 12px' }}>
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
      </motion.aside>
      <button className="glass capsule btn only-mobile" style={{ position: 'fixed', top: 64, right: 12, zIndex: 41 }} onClick={onClose}>
        <Icon.close /> Close tour
      </button>
      <TourPlayer />
    </>
  );
}
