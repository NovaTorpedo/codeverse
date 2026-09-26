import { useLayoutEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useStore, type Mode } from '../store';
import { Icon } from './icons';
import { Logo } from './Splash';

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: Array<{ id: T; label: string; disabled?: boolean }>; onChange: (v: T) => void; label: string }) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [thumb, setThumb] = useState({ left: 0, width: 0 });
  useLayoutEffect(() => {
    const el = refs.current[value];
    if (el) setThumb({ left: el.offsetLeft, width: el.offsetWidth });
  }, [value, options.length]);
  return (
    <div className="segmented" role="group" aria-label={label}>
      <motion.span className="thumb" animate={thumb} transition={{ type: 'spring', stiffness: 420, damping: 34 }} />
      {options.map((o) => (
        <button key={o.id} ref={(el) => void (refs.current[o.id] = el)} aria-pressed={value === o.id} disabled={o.disabled} onClick={() => onChange(o.id)} style={o.disabled ? { opacity: 0.35 } : undefined}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function TopBar({ onWorld, onMode }: { onWorld: (id: string) => void; onMode: (m: Mode) => void }) {
  const index = useStore((s) => s.index);
  const world = useStore((s) => s.world);
  const mode = useStore((s) => s.mode);
  const set = useStore((s) => s.set);
  const view2d = useStore((s) => s.view2d);
  const worlds = index?.worlds ?? [];
  return (
    <header className="row" style={{ position: 'fixed', top: 14, left: 16, right: 16, zIndex: 40, gap: 10, pointerEvents: 'none', flexWrap: 'wrap' }}>
      <div className="glass capsule row" style={{ padding: '6px 8px 6px 10px', gap: 10, pointerEvents: 'auto' }}>
        <Logo />
        <span className="title-3" style={{ letterSpacing: '-0.03em' }}>
          CodeVerse
        </span>
        {worlds.length > 1 && (
          <Segmented
            label="World"
            value={world?.entry.id ?? worlds[0]!.id}
            options={[...worlds.map((w) => ({ id: w.id, label: w.title })), ...(world?.entry.id === 'uploaded' ? [{ id: 'uploaded', label: 'Your file' }] : [])]}
            onChange={onWorld}
          />
        )}
      </div>
      <div className="glass capsule" style={{ padding: 4, pointerEvents: 'auto' }}>
        <Segmented<Mode>
          label="Mode"
          value={mode}
          onChange={onMode}
          options={[
            { id: 'explore', label: 'Explore' },
            { id: 'incident', label: 'Incident', disabled: !world?.incidents.length },
            { id: 'tour', label: 'Tour', disabled: !world?.tour },
          ]}
        />
      </div>
      <button className="glass capsule btn" style={{ pointerEvents: 'auto', height: 40, padding: '0 14px', gap: 8 }} onClick={() => set({ searchOpen: true })} aria-label="Search the city">
        <Icon.search />
        <span className="secondary">Search</span>
        <span className="kbd">⌘K</span>
      </button>
      <div style={{ flex: 1 }} />
      <button className="glass capsule btn icon" style={{ pointerEvents: 'auto', width: 40, height: 40 }} onClick={() => set({ view2d: !view2d })} aria-label={view2d ? 'Switch to 3D' : 'Switch to 2D map'} title={view2d ? '3D city' : '2D map'}>
        {view2d ? <Icon.cube /> : <Icon.map />}
      </button>
      <button className="glass capsule btn icon" style={{ pointerEvents: 'auto', width: 40, height: 40 }} onClick={() => set({ helpOpen: true })} aria-label="Keyboard shortcuts and about">
        <Icon.help />
      </button>
    </header>
  );
}
