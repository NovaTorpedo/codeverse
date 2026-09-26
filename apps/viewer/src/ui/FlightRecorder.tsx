import { useEffect, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { describeEvent, duration, eventIndexAt } from '@codeverse/stream';
import type { RecEvent } from '@codeverse/schema';
import { laneColor } from '../scene/palette';
import { useStore } from '../store';
import { Icon } from './icons';

const fmt = (ms: number) => {
  const s = Math.max(0, ms) / 1000;
  return `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;
};

const ACTION_GLYPH: Record<string, string> = { read: '◧', search: '⌕', list: '☰', symbol: 'ƒ', write: '✎', execute: '›_', subagent: '⤷', skill: '✦', mode: '⇄', todo: '☑', question: '?', other: '•' };

function glyph(ev: RecEvent): string {
  if (ev.type === 'message') return ev.isReasoning ? '💭' : ev.role === 'user' ? '›' : '◆';
  if (ev.type === 'tool_use') return ACTION_GLYPH[ev.action ?? 'other'] ?? '•';
  if (ev.type === 'tool_result') return '↩';
  if (ev.type === 'error') return '!';
  if (ev.type === 'result') return '■';
  return '·';
}

/** Drives playback time with requestAnimationFrame; writes to the store at ~20 Hz. */
export function PlaybackClock() {
  const playing = useStore((s) => s.playback?.playing);
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      acc += dt;
      if (acc >= 50) {
        const s = useStore.getState();
        const pb = s.playback;
        if (!pb) return;
        const end = duration(pb.recording);
        const next = Math.min(end, pb.time + acc * pb.speed);
        acc = 0;
        s.set({ playback: { ...pb, time: next, playing: pb.live ? true : next < end } });
        if (next >= end && !pb.live) return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);
  return null;
}

export function FlightRecorder() {
  const pb = useStore((s) => s.playback);
  const set = useStore((s) => s.set);
  const hidden = useStore((s) => s.mode === 'incident' && s.stage !== 'investigate');
  const flyTo = useStore((s) => s.flyTo);
  const listRef = useRef<HTMLDivElement>(null);
  const rec = pb?.recording;
  const total = rec ? duration(rec) : 0;
  const idx = rec && pb ? eventIndexAt(rec, pb.time) : -1;
  const laneIndex = useMemo(() => new Map(rec?.lanes.map((l, i) => [l.id, i]) ?? []), [rec]);

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-seq="${idx}"]`);
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [idx]);

  if (!rec || !pb || hidden) return null;
  const setTime = (t: number) => set({ playback: { ...pb, time: Math.max(0, Math.min(total, t)) } });
  const jump = (i: number) => {
    const ev = rec.events[Math.max(0, Math.min(rec.events.length - 1, i))];
    if (ev) {
      set({ playback: { ...pb, time: ev.t, playing: false } });
      if (ev.targets[0]) flyTo(ev.targets[0], 16);
    }
  };
  const stats = rec.result?.stats;
  const laneRows = rec.lanes.length;

  return (
    <motion.section
      className="glass thick"
      aria-label="Bob flight recorder"
      initial={{ y: 40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 28 }}
      style={{ position: 'fixed', left: '50%', bottom: 16, width: 'min(920px, calc(100vw - 32px))', padding: 14, zIndex: 30, x: '-50%' }}
    >
      <div className="row" style={{ gap: 12 }}>
        <div className="row" style={{ gap: 6 }}>
          <button className="btn icon" aria-label="Previous event" onClick={() => jump(idx - 1)}>
            <Icon.back />
          </button>
          <button
            className="btn icon primary"
            style={{ width: 38, height: 38 }}
            aria-label={pb.playing ? 'Pause' : 'Play'}
            onClick={() => set({ playback: { ...pb, playing: !pb.playing, time: pb.time >= total && !pb.playing ? 0 : pb.time } })}
          >
            {pb.playing ? <Icon.pause /> : <Icon.play />}
          </button>
          <button className="btn icon" aria-label="Next event" onClick={() => jump(idx + 1)}>
            <Icon.fwd />
          </button>
        </div>
        <div className="stack grow" style={{ gap: 4 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div className="row" style={{ gap: 8, minWidth: 0 }}>
              <span className="eyebrow">Flight recorder</span>
              {pb.live && (
                <span className="chip red">
                  <span className="dot pulse" /> LIVE
                </span>
              )}
              <span className="caption truncate">{rec.title}</span>
            </div>
            <span className="caption tabular mono">
              {fmt(pb.time)} / {fmt(total)}
            </span>
          </div>
          <Timeline events={rec.events} total={total} time={pb.time} laneIndex={laneIndex} laneRows={laneRows} onSeek={setTime} />
        </div>
        <div className="segmented" role="group" aria-label="Playback speed">
          {([1, 2, 4] as const).map((s) => (
            <button key={s} aria-pressed={pb.speed === s} onClick={() => set({ playback: { ...pb, speed: s } })}>
              {s}×
            </button>
          ))}
        </div>
      </div>

      <div className="row" style={{ gap: 12, marginTop: 10, alignItems: 'stretch' }}>
        <div ref={listRef} className="scroll grow" style={{ maxHeight: 132, paddingRight: 4 }} role="list" aria-label="Bob events">
          {rec.events.map((ev) => {
            const li = laneIndex.get(ev.lane) ?? 0;
            const on = ev.seq === idx;
            const past = ev.seq <= idx;
            return (
              <button
                key={ev.seq}
                data-seq={ev.seq}
                role="listitem"
                className="list-item"
                aria-selected={on}
                onClick={() => jump(ev.seq)}
                style={{ padding: '4px 8px', opacity: past ? 1 : 0.45, gap: 8 }}
              >
                <span className="mono tabular tertiary" style={{ width: 44, flex: 'none' }}>
                  {fmt(ev.t)}
                </span>
                <span style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, background: laneColor(li), flex: 'none', opacity: 0.9 }} />
                <span style={{ width: 18, textAlign: 'center', flex: 'none' }}>{glyph(ev)}</span>
                <span className="truncate grow" style={{ fontSize: 12 }}>
                  {describeEvent(ev)}
                </span>
                {ev.targets.length > 0 && <span className="chip cyan">{ev.targets.length}</span>}
              </button>
            );
          })}
        </div>
        <div className="stack" style={{ width: 200, flex: 'none', gap: 6, paddingLeft: 12, borderLeft: '1px solid var(--separator)' }}>
          <span className="eyebrow">From Bob’s result event</span>
          <Stat label="Duration" value={stats?.duration_ms !== undefined ? `${(stats.duration_ms / 1000).toFixed(1)} s` : '—'} />
          <Stat label="Tool calls" value={stats?.tool_calls ?? '—'} />
          <Stat label="Tokens" value={stats?.total_tokens !== undefined ? stats.total_tokens.toLocaleString() : '—'} />
          <Stat label="Bobcoins" value={stats?.session_costs !== undefined ? stats.session_costs.toFixed(2) : '—'} />
          <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
            {rec.lanes.map((l, i) => (
              <span key={l.id} className="chip" title={l.label} style={{ color: laneColor(i), maxWidth: 190 }}>
                <span className="dot" />
                <span className="truncate">{l.kind === 'main' ? 'Bob' : `${l.subagentType ?? 'subagent'}`}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </motion.section>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="row" style={{ justifyContent: 'space-between' }}>
      <span className="caption">{label}</span>
      <span className="headline tabular">{value}</span>
    </div>
  );
}

function Timeline({ events, total, time, laneIndex, laneRows, onSeek }: { events: RecEvent[]; total: number; time: number; laneIndex: Map<string, number>; laneRows: number; onSeek: (t: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const rowH = 7;
  const h = Math.max(22, laneRows * rowH + 8);
  const seekAt = (clientX: number) => {
    const r = ref.current?.getBoundingClientRect();
    if (r) onSeek(((clientX - r.left) / r.width) * total);
  };
  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-label="Scrub timeline"
      aria-valuemin={0}
      aria-valuemax={Math.round(total)}
      aria-valuenow={Math.round(time)}
      onPointerDown={(e) => {
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        seekAt(e.clientX);
      }}
      onPointerMove={(e) => e.buttons === 1 && seekAt(e.clientX)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') onSeek(time + total / 50);
        if (e.key === 'ArrowLeft') onSeek(time - total / 50);
      }}
      style={{ position: 'relative', height: h, borderRadius: 8, background: 'rgba(255,255,255,0.05)', cursor: 'pointer', overflow: 'hidden', touchAction: 'none' }}
    >
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${total ? (time / total) * 100 : 0}%`, background: 'linear-gradient(90deg, rgba(100,210,255,0.08), rgba(100,210,255,0.22))' }} />
      {events.map((ev) => {
        const li = laneIndex.get(ev.lane) ?? 0;
        const isTool = ev.type === 'tool_use';
        return (
          <span
            key={ev.seq}
            style={{
              position: 'absolute',
              left: `${total ? (ev.t / total) * 100 : 0}%`,
              top: 4 + li * rowH,
              width: isTool ? 3 : 2,
              height: rowH - 2,
              borderRadius: 2,
              background: ev.type === 'message' && ev.isReasoning ? '#ffffff88' : laneColor(li),
              opacity: ev.t <= time ? 1 : 0.35,
              transform: 'translateX(-50%)',
            }}
          />
        );
      })}
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${total ? (time / total) * 100 : 0}%`, width: 2, background: '#fff', boxShadow: '0 0 10px #64d2ff', transform: 'translateX(-1px)' }} />
    </div>
  );
}
