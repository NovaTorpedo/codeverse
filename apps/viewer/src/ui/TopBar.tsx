import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { goChapter } from '../chapters';
import { useStore, type Chapter } from '../store';
import { Icon } from './icons';
import { Logo } from './Splash';

const CHAPTERS: Array<{ id: Chapter; label: string }> = [
  { id: 'explore', label: 'Explore the system' },
  { id: 'investigate', label: 'Watch Bob investigate' },
  { id: 'fixed', label: 'See it fixed' },
];

export function copyLink() {
  const s = useStore.getState();
  const url = window.location.href;
  const done = () => s.notify('Link to this moment copied');
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(url).then(done, () => s.notify(url));
  else s.notify(url);
}

function ChapterNav() {
  const chapter = useStore((s) => s.chapter);
  const mode = useStore((s) => s.mode);
  const hasIncident = useStore((s) => Boolean(s.world?.incidents.length));
  const story = useStore((s) => Boolean(s.story));
  const cur = CHAPTERS.findIndex((c) => c.id === chapter);
  return (
    <nav className="glass capsule chapters" aria-label="Chapters">
      {CHAPTERS.map((c, i) => (
        <span key={c.id} className="row" style={{ gap: 4 }}>
          {i > 0 && <span className="chapter-sep" aria-hidden />}
          <button
            className={`chapter ${i < cur && mode !== 'tour' ? 'done' : ''}`}
            aria-current={c.id === chapter && mode !== 'tour' ? 'step' : undefined}
            disabled={i > 0 && !hasIncident}
            onClick={() => goChapter(c.id, { autoplay: true })}
            title={story ? `${c.label} (leaves the guided story)` : c.label}
          >
            <span className="num">{i < cur && mode !== 'tour' ? '✓' : i + 1}</span>
            <span className="label">{c.label}</span>
          </button>
        </span>
      ))}
    </nav>
  );
}

function Menu({ onWorld, onTour, onFile }: { onWorld: (id: string) => void; onTour: () => void; onFile: () => void }) {
  const open = useStore((s) => s.menuOpen);
  const set = useStore((s) => s.set);
  const worlds = useStore((s) => s.index?.worlds ?? []);
  const world = useStore((s) => s.world);
  const view2d = useStore((s) => s.view2d);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && set({ menuOpen: false });
    window.addEventListener('pointerdown', close);
    ref.current?.querySelector('button')?.focus();
    return () => window.removeEventListener('pointerdown', close);
  }, [open, set]);
  const item = (label: string, onClick: () => void, hint?: string) => (
    <button
      className="list-item"
      role="menuitem"
      onClick={() => {
        set({ menuOpen: false });
        onClick();
      }}
    >
      <span className="grow">{label}</span>
      {hint && <span className="kbd">{hint}</span>}
    </button>
  );
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={ref}
          role="menu"
          aria-label="More"
          className="glass thick"
          initial={{ opacity: 0, y: -6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.98 }}
          transition={{ duration: 0.16 }}
          style={{ position: 'fixed', top: 66, right: 'var(--gutter)', width: 260, padding: 6, zIndex: 60 }}
          onKeyDown={(e) => e.key === 'Escape' && set({ menuOpen: false })}
        >
          {item('Search the code', () => set({ searchOpen: true }), '/')}
          {item('How to read the city', () => set({ legendOpen: true }), '?')}
          {item(view2d ? 'Show the 3D city' : 'Show the 2D map', () => set({ view2d: !view2d }), 'M')}
          {item('Copy a link to this moment', copyLink)}
          {world?.tour && item("Bob's guided tour", onTour, 'T')}
          <div className="divider" />
          <div className="eyebrow" style={{ padding: '6px 10px 2px' }}>
            Codebase
          </div>
          {worlds.map((w) => (
            <button key={w.id} className="list-item" role="menuitemradio" aria-checked={world?.entry.id === w.id} onClick={() => (set({ menuOpen: false }), onWorld(w.id))}>
              <span className="grow">{w.title}</span>
              {world?.entry.id === w.id && <Icon.check />}
            </button>
          ))}
          {item('Open a graph or recording (JSON)…', onFile)}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function TopBar({ onWorld, onTour, onFile }: { onWorld: (id: string) => void; onTour: () => void; onFile: () => void }) {
  const set = useStore((s) => s.set);
  const view2d = useStore((s) => s.view2d);
  const menuOpen = useStore((s) => s.menuOpen);
  const world = useStore((s) => s.world);
  const intro = useStore((s) => s.introOpen);
  if (intro) return null;
  return (
    <>
      <header className="topbar">
        <button className="glass capsule brand" style={{ border: 0 }} onClick={() => set({ introOpen: true, story: undefined })} aria-label="CodeVerse: back to the start">
          <Logo />
          <span className="brand-name title-3" style={{ letterSpacing: '-0.03em' }}>
            CodeVerse
          </span>
          <span className="brand-name caption only-desktop">{world?.entry.title}</span>
        </button>
        <ChapterNav />
        <div className="tools">
          <button className="glass capsule btn icon only-desktop" style={{ width: 40, height: 40 }} onClick={() => set({ searchOpen: true })} aria-label="Search the code" title="Search (/)">
            <Icon.search />
          </button>
          <button className="glass capsule btn icon only-desktop" style={{ width: 40, height: 40 }} onClick={() => set({ legendOpen: true })} aria-label="How to read the city" title="How to read the city (?)">
            <Icon.book />
          </button>
          <button className="glass capsule btn icon only-desktop" style={{ width: 40, height: 40 }} onClick={() => set({ view2d: !view2d })} aria-label={view2d ? 'Show the 3D city' : 'Show the 2D map'} title={view2d ? '3D city (M)' : '2D map (M)'}>
            {view2d ? <Icon.cube /> : <Icon.map />}
          </button>
          <button className="glass capsule btn icon only-desktop" style={{ width: 40, height: 40 }} onClick={copyLink} aria-label="Copy a link to this moment" title="Copy a link to this moment">
            <Icon.link />
          </button>
          <button className="glass capsule btn icon" style={{ width: 40, height: 40 }} aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => set({ menuOpen: !menuOpen })} aria-label="More">
            <Icon.menu />
          </button>
        </div>
      </header>
      <Menu onWorld={onWorld} onTour={onTour} onFile={onFile} />
    </>
  );
}
