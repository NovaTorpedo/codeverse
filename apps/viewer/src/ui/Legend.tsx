import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { phantomSpots } from '../scene/Grounding';
import { currentIncident, useStore } from '../store';

const G = { width: 38, height: 38, viewBox: '0 0 38 38', 'aria-hidden': true } as const;

const ITEMS: Array<{ glyph: React.ReactNode; title: string; text: string }> = [
  {
    glyph: (
      <svg {...G}>
        <ellipse cx="19" cy="24" rx="15" ry="7" fill="rgba(100,210,255,0.08)" stroke="#64d2ff" strokeWidth="1.4" />
      </svg>
    ),
    title: 'District',
    text: "A service (a folder of related code). Names come from Bob's scan.",
  },
  {
    glyph: (
      <svg {...G}>
        <rect x="9" y="16" width="7" height="16" rx="1.5" fill="#3ec6ff" opacity="0.8" />
        <rect x="20" y="7" width="8" height="25" rx="1.5" fill="#64d2ff" />
      </svg>
    ),
    title: 'Tower',
    text: 'A file. The taller the tower, the more lines of code.',
  },
  {
    glyph: (
      <svg {...G}>
        <path d="M9 30 A10 10 0 0 1 29 30" fill="none" stroke="#40c8e0" strokeWidth="2.4" />
      </svg>
    ),
    title: 'Gateway arch',
    text: 'An API route: a front door where requests enter.',
  },
  {
    glyph: (
      <svg {...G}>
        <circle cx="19" cy="17" r="6" fill="#7b79ff" />
        <circle cx="19" cy="17" r="10" fill="none" stroke="#64d2ff" strokeDasharray="3 3" />
      </svg>
    ),
    title: 'Glowing core',
    text: 'The datastore, floating above the district that owns it.',
  },
  {
    glyph: (
      <svg {...G}>
        <path d="M5 28 Q19 2 33 28" fill="none" stroke="#64d2ff" strokeOpacity="0.5" />
        <circle cx="13" cy="15" r="2.2" fill="#fff" />
        <circle cx="24" cy="13" r="1.6" fill="#fff" opacity="0.7" />
      </svg>
    ),
    title: 'Links and light',
    text: 'Imports and calls. Light travels only along calls the static analyzer can prove.',
  },
  {
    glyph: (
      <svg {...G}>
        <circle cx="12" cy="14" r="4" fill="#64d2ff" />
        <circle cx="26" cy="22" r="3.2" fill="#ffb340" />
        <circle cx="21" cy="9" r="2.6" fill="#ff375f" />
      </svg>
    ),
    title: 'Probes',
    text: 'Bob (cyan) and its subagents (other colours), flying to the files they read.',
  },
  {
    glyph: (
      <svg {...G}>
        <rect x="8" y="12" width="8" height="20" rx="1.5" fill="#ffb340" />
        <rect x="22" y="8" width="8" height="24" rx="1.5" fill="#30d158" />
      </svg>
    ),
    title: 'Colours',
    text: 'Amber: a file Bob read. Green: the request passed here. White: happening now.',
  },
  {
    glyph: (
      <svg {...G}>
        <path d="M19 8 L23 16 L31 17 L24 22 L27 30 L19 25 L11 30 L14 22 L7 17 L15 16 Z" fill="#ff453a" opacity="0.9" />
      </svg>
    ),
    title: 'Fracture',
    text: 'Where the request breaks. It heals to green when the fix is applied.',
  },
  {
    glyph: (
      <svg {...G}>
        <rect x="11" y="6" width="16" height="26" rx="1" fill="none" stroke="#ff9f0a" strokeDasharray="3 2" />
      </svg>
    ),
    title: 'Phantom',
    text: "A claim that doesn't match the code (a file, line or symbol that isn't there). It flickers.",
  },
  {
    glyph: (
      <svg {...G}>
        <circle cx="19" cy="19" r="13" fill="none" stroke="rgba(48,209,88,0.25)" strokeWidth="4" />
        <path d="M19 6 A13 13 0 1 1 7 23" fill="none" stroke="#30d158" strokeWidth="4" strokeLinecap="round" />
      </svg>
    ),
    title: 'Grounding Score',
    text: "The share of Bob's claims (files, lines, symbols, calls) verified against the code.",
  },
];

const SHORTCUTS: Array<[string, string]> = [
  ['1 2 3', 'Chapters'],
  ['Space', 'Play or pause'],
  ['← →', 'Previous or next moment'],
  ['/', 'Search the code'],
  ['M', '2D map or 3D city'],
  ['?', 'This guide'],
  ['Esc', 'Close or go back'],
];

/** The visual language, explained once, reopenable any time. */
export function Legend() {
  const open = useStore((s) => s.legendOpen);
  const set = useStore((s) => s.set);
  const world = useStore((s) => s.world);
  const incident = useStore(currentIncident);
  const done = useRef<HTMLButtonElement>(null);
  const phantoms = world && incident ? phantomSpots(world.layout, incident.grounding).length : 0;
  // Bob's TourPlayer pauses its own keyboard shortcuts while a dialog is open (helpOpen).
  useEffect(() => set({ helpOpen: open }), [open, set]);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    done.current?.focus();
    return () => prev?.focus?.();
  }, [open]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'fixed', inset: 0, zIndex: 85, background: 'rgba(0,0,0,0.45)', display: 'grid', placeItems: 'center', padding: 12 }} onClick={() => set({ legendOpen: false })}>
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="legend-title"
            className="glass thick scroll"
            initial={{ scale: 0.97, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.97, y: 10 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.key === 'Escape' && set({ legendOpen: false })}
            style={{ width: 'min(760px, 100%)', maxHeight: 'calc(100vh - 24px)', padding: 26 }}
          >
            <div className="stack" style={{ gap: 6, marginBottom: 20 }}>
              <span className="eyebrow">How to read the city</span>
              <span id="legend-title" className="title-1">
                Your code, drawn to scale. Bob's reasoning, drawn on top.
              </span>
              <span className="body">The city comes from a deterministic static analysis of the repository. Everything Bob does is replayed from a real recorded session.</span>
            </div>
            <div className="legend-grid">
              {ITEMS.map((it) => (
                <div key={it.title} className="legend-item">
                  {it.glyph}
                  <div className="stack" style={{ gap: 2 }}>
                    <span className="headline">{it.title}</span>
                    <span className="caption" style={{ lineHeight: 1.5 }}>
                      {it.title === 'Phantom' && incident ? `${it.text} This session has ${phantoms === 0 ? 'none' : phantoms}.` : it.text}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="divider" style={{ margin: '20px 0 14px' }} />
            <div className="row wrap" style={{ gap: '8px 18px' }}>
              {SHORTCUTS.map(([k, v]) => (
                <span key={k} className="row caption" style={{ gap: 6 }}>
                  <span className="kbd">{k}</span>
                  {v}
                </span>
              ))}
            </div>
            <div className="row" style={{ justifyContent: 'flex-end', marginTop: 20 }}>
              <button ref={done} className="btn primary" onClick={() => set({ legendOpen: false })}>
                Got it
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
