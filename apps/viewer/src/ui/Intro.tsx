import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { goChapter } from '../chapters';
import { startStory } from '../story/StoryDirector';
import { currentIncident, useStore } from '../store';
import { Icon } from './icons';

/** First run: frame the problem in one line, offer one primary action. Skippable at any time (Esc). */
export function Intro() {
  const open = useStore((s) => s.introOpen);
  const reduced = useStore((s) => s.reducedMotion);
  const incident = useStore(currentIncident);
  const world = useStore((s) => s.world);
  const primary = useRef<HTMLButtonElement>(null);
  const rec = incident?.recording;
  const recorded = rec?.recordedAt && !Number.isNaN(Date.parse(rec.recordedAt)) ? new Date(rec.recordedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : undefined;

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => primary.current?.focus(), reduced ? 0 : 2400);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && goChapter('explore');
    window.addEventListener('keydown', onKey);
    return () => (clearTimeout(t), window.removeEventListener('keydown', onKey));
  }, [open, reduced]);

  const d = (s: number) => (reduced ? 0 : s);
  const fade = (delay: number) => ({ initial: { opacity: 0, y: reduced ? 0 : 14, filter: reduced ? 'none' : 'blur(8px)' }, animate: { opacity: 1, y: 0, filter: 'blur(0px)' }, transition: { duration: reduced ? 0 : 0.9, delay: d(delay), ease: [0.16, 1, 0.3, 1] as const } });

  return (
    <AnimatePresence>
      {open && world && (
        <motion.section className="intro" role="dialog" aria-modal="true" aria-labelledby="intro-title" initial={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: reduced ? 0 : 0.6 } }}>
          <button className="btn ghost sm" style={{ position: 'fixed', top: 18, right: 20 }} onClick={() => goChapter('explore')}>
            Skip
          </button>
          <div className="intro-inner">
            <motion.div className="row" style={{ gap: 10 }} {...fade(0.1)}>
              <span className="chip red">
                <span className="dot pulse" /> Incident INC-2417
              </span>
              <span className="caption">{world.entry.title} checkout</span>
            </motion.div>
            <motion.h1 id="intro-title" className="display" style={{ margin: 0 }} {...fade(0.35)}>
              Checkout is failing.
              <br />
              <span style={{ color: 'var(--label-2)' }}>The logs blame three things.</span>
            </motion.h1>
            <motion.p className="lead" style={{ margin: 0, maxWidth: 600 }} {...fade(1.4)}>
              Watch IBM Bob find the real cause in a recorded session, and see every claim it makes checked against the code.
            </motion.p>
            {incident ? (
              <motion.div className="stack" style={{ alignItems: 'center', gap: 14, marginTop: 6 }} {...fade(2.2)}>
                <button ref={primary} className="btn primary lg" onClick={startStory}>
                  <Icon.play /> Watch Bob solve it
                </button>
                <button className="btn ghost" onClick={() => goChapter('explore')}>
                  or explore the system yourself <Icon.arrow />
                </button>
              </motion.div>
            ) : (
              <motion.div {...fade(1.8)}>
                <button ref={primary} className="btn primary lg" onClick={() => goChapter('explore')}>
                  Explore the system <Icon.arrow />
                </button>
              </motion.div>
            )}
          </div>
          {rec && (
            <motion.div className="caption row" style={{ position: 'fixed', bottom: 22, left: 0, right: 0, justifyContent: 'center', gap: 8, padding: '0 16px', textAlign: 'center' }} {...fade(2.6)}>
              <span className="dot" style={{ color: rec.synthetic ? 'var(--orange)' : 'var(--green)' }} />
              {rec.synthetic ? 'Synthetic development fixture, not a real IBM Bob session' : `A real IBM Bob session${recorded ? `, recorded ${recorded}` : ''}, replayed here. The app is a sample with a seeded bug.`}
            </motion.div>
          )}
        </motion.section>
      )}
    </AnimatePresence>
  );
}
