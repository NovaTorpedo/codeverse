import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cameraPose } from '../scene/CameraRig';
import { hueColor } from '../scene/palette';
import { usePlaybackState } from '../scene/useHighlights';
import { currentIncident, useStore } from '../store';
import { Icon } from './icons';

/** Top-down overview of districts with the camera's position; click a district to fly there. */
export function Minimap() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const world = useStore((s) => s.world);
  const flyTo = useStore((s) => s.flyTo);
  const size = 150;
  useEffect(() => {
    const c = canvas.current;
    if (!c || !world) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = size * dpr;
    c.height = size * dpr;
    ctx.scale(dpr, dpr);
    const R = world.layout.bounds.radius * 1.08;
    const sx = (x: number) => size / 2 + (x / R) * (size / 2);
    let raf = 0;
    const draw = () => {
      ctx.clearRect(0, 0, size, size);
      for (const d of world.layout.districts) {
        ctx.beginPath();
        ctx.arc(sx(d.x), sx(d.z), (d.r / R) * (size / 2), 0, Math.PI * 2);
        ctx.fillStyle = `#${hueColor(d.hue, 0.8, 0.5).getHexString()}22`;
        ctx.strokeStyle = `#${hueColor(d.hue, 0.8, 0.6).getHexString()}aa`;
        ctx.fill();
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(200,235,255,0.75)';
      for (const b of world.layout.buildings) ctx.fillRect(sx(b.x) - 1, sx(b.z) - 1, 2, 2);
      const px = sx(cameraPose.x);
      const pz = sx(cameraPose.z);
      ctx.save();
      ctx.translate(Math.max(6, Math.min(size - 6, px)), Math.max(6, Math.min(size - 6, pz)));
      ctx.rotate(-cameraPose.yaw + Math.PI);
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(5, 5);
      ctx.lineTo(-5, 5);
      ctx.closePath();
      ctx.fillStyle = '#ffd60a';
      ctx.shadowColor = '#ffd60a';
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.restore();
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [world]);
  if (!world) return null;
  const onClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const R = world.layout.bounds.radius * 1.08;
    const x = ((e.clientX - r.left) / size - 0.5) * 2 * R;
    const z = ((e.clientY - r.top) / size - 0.5) * 2 * R;
    const d = [...world.layout.districts].sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z))[0];
    if (d) flyTo(d.id, d.r * 3.2);
  };
  return (
    <div className="glass" style={{ position: 'fixed', left: 16, bottom: 16, padding: 8, zIndex: 20, borderRadius: 20 }}>
      <canvas ref={canvas} width={size} height={size} style={{ width: size, height: size, display: 'block', cursor: 'pointer', borderRadius: 14 }} onClick={onClick} aria-label="Minimap: click a district to fly there" role="img" />
    </div>
  );
}

/** Honest provenance badge for whatever Bob session is on screen. */
export function ReplayBadge() {
  const pb = useStore((s) => s.playback);
  const incident = useStore(currentIncident);
  const mode = useStore((s) => s.mode);
  const liveStatus = useStore((s) => s.liveStatus);
  const rec = pb?.recording ?? (mode === 'incident' ? incident?.recording : undefined);
  const inv = mode === 'incident' ? incident?.investigation : undefined;
  if (!rec && !inv) return null;
  const synthetic = rec?.synthetic || inv?.synthetic;
  const stats = rec?.result?.stats;
  const date = rec?.recordedAt && !Number.isNaN(Date.parse(rec.recordedAt)) ? new Date(rec.recordedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : undefined;
  let text: string;
  if (synthetic) text = 'SYNTHETIC FIXTURE · not a real IBM Bob session · for development only';
  else if (pb?.live) text = `Live IBM Bob session${liveStatus ? ` · ${liveStatus}` : ''}`;
  else if (rec) text = `Replaying a recorded IBM Bob session${date ? ` · recorded ${date}` : ''}${stats?.tool_calls !== undefined ? ` · ${stats.tool_calls} tool calls` : ''}${stats?.session_costs !== undefined ? ` · ${stats.session_costs.toFixed(2)} Bobcoins` : ''}`;
  else text = `IBM Bob investigation from Bob IDE${inv?.generatedBy.recordedAt ? ` · ${inv.generatedBy.recordedAt}` : ''}`;
  return (
    <div
      role="status"
      className={`glass capsule row ${synthetic ? '' : ''}`}
      style={{ position: 'fixed', top: 66, left: '50%', transform: 'translateX(-50%)', zIndex: 35, padding: '6px 14px', gap: 8, maxWidth: 'calc(100vw - 32px)', background: synthetic ? 'rgba(90,60,0,0.55)' : undefined }}
    >
      <span className="dot" style={{ color: synthetic ? '#ff9f0a' : pb?.live ? '#ff453a' : '#30d158' }} />
      <span className="caption truncate" style={{ color: synthetic ? '#ffcc66' : 'var(--label)' }}>
        {text}
      </span>
    </div>
  );
}

/** "Bob is thinking…" caption rail synced to the recording. */
export function CaptionRail() {
  const pb = usePlaybackState();
  const mode = useStore((s) => s.mode);
  const stage = useStore((s) => s.stage);
  const hasPb = useStore((s) => Boolean(s.playback));
  if (!hasPb || !pb?.reasoning || (mode === 'incident' && stage !== 'investigate')) return null;
  const r = pb.reasoning;
  const final = !r.isReasoning;
  return (
    <div style={{ position: 'fixed', left: '50%', bottom: 292, transform: 'translateX(-50%)', width: 'min(760px, calc(100vw - 32px))', zIndex: 28, pointerEvents: 'none' }}>
      <AnimatePresence mode="wait">
        <motion.div
          key={r.seq}
          className="glass thin"
          initial={{ y: 10, opacity: 0, filter: 'blur(6px)' }}
          animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
          exit={{ y: -8, opacity: 0, filter: 'blur(6px)' }}
          transition={{ duration: 0.35 }}
          style={{ padding: '10px 16px', borderRadius: 18 }}
          aria-live="polite"
        >
          <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
            <span className={final ? '' : 'shimmer-text'} style={{ fontWeight: 650, fontSize: 12, whiteSpace: 'nowrap', color: final ? 'var(--green)' : undefined }}>
              {final ? 'Bob answered' : 'Bob is thinking…'}
            </span>
            <span style={{ fontSize: 13.5, lineHeight: 1.45 }}>{r.content}</span>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export function Toast() {
  const toast = useStore((s) => s.toast);
  const set = useStore((s) => s.set);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => set({ toast: undefined }), 4200);
    return () => clearTimeout(t);
  }, [toast, set]);
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          key={toast.nonce}
          role={toast.tone === 'error' ? 'alert' : 'status'}
          className="glass thick capsule row"
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -20, opacity: 0 }}
          style={{ position: 'fixed', top: 110, left: '50%', x: '-50%', zIndex: 90, padding: '10px 16px', gap: 8 }}
        >
          {toast.tone === 'error' ? <Icon.warn /> : <Icon.check />}
          <span style={{ color: toast.tone === 'error' ? '#ff8a80' : undefined }}>{toast.text}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const SHORTCUTS: Array<[string, string]> = [
  ['⌘K  /', 'Search files, symbols, services'],
  ['Space', 'Play / pause the flight recorder'],
  ['← →', 'Previous / next Bob event'],
  ['1 2 3', 'Explore · Incident · Tour'],
  ['M', 'Toggle 2D map'],
  ['Esc', 'Close panel / deselect'],
  ['?', 'This help'],
];

export function HelpSheet() {
  const open = useStore((s) => s.helpOpen);
  const set = useStore((s) => s.set);
  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'fixed', inset: 0, zIndex: 85, background: 'rgba(0,0,0,0.35)', display: 'grid', placeItems: 'center' }} onClick={() => set({ helpOpen: false })}>
          <motion.div role="dialog" aria-label="About and shortcuts" className="glass thick" initial={{ scale: 0.96, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 10 }} transition={{ type: 'spring', stiffness: 380, damping: 30 }} onClick={(e) => e.stopPropagation()} style={{ width: 'min(520px, calc(100vw - 32px))', padding: 22 }}>
            <div className="title-2">See your software think</div>
            <p className="secondary" style={{ lineHeight: 1.55 }}>
              The city is drawn by a deterministic static analyzer: districts are services, towers are modules sized by code volume, arches are API routes, the floating core is the datastore. IBM Bob adds the meaning: it investigates incidents with subagents, and CodeVerse replays that investigation and checks every claim Bob makes against the code (the Grounding Score).
            </p>
            <div className="divider" />
            {SHORTCUTS.map(([k, v]) => (
              <div key={k} className="row" style={{ justifyContent: 'space-between', padding: '5px 0' }}>
                <span className="secondary">{v}</span>
                <span className="kbd">{k}</span>
              </div>
            ))}
            <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
              <button className="btn primary" onClick={() => set({ helpOpen: false })}>
                Done
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
