import { useEffect, useMemo, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { describeEvent, duration, eventIndexAt } from '@codeverse/stream';
import type { RecEvent } from '@codeverse/schema';
import { laneColor } from '../scene/palette';
import { clockFor } from '../story/clock';
import { useStore } from '../store';
import { Icon } from './icons';

const fmt = (ms: number) => {
  const s = Math.max(0, ms) / 1000;
  return `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;
};

const ACTION_GLYPH: Record<string, string> = { read: '◧', search: '⌕', list: '☰', symbol: 'ƒ', write: '✎', execute: '›_', subagent: '⤷', skill: '✦', mode: '⇄', todo: '☑', question: '?', other: '•' };

function glyph(ev: RecEvent): string {
  if (ev.type === 'message') return ev.isReasoning ? '…' : ev.role === 'user' ? '›' : '◆';
  if (ev.type === 'tool_use') return ACTION_GLYPH[ev.action ?? 'other'] ?? '•';
  if (ev.type === 'tool_result') return ev.status === 'error' ? '✕' : '↩';
  if (ev.type === 'error') return '!';
  if (ev.type === 'result') return '■';
  return '·';
}

/** Drives playback with requestAnimationFrame; writes to the store at ~20 Hz. Story pace maps through the story clock. */
export function PlaybackClock() {
  const playing = useStore((s) => s.playback?.playing);
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const tick = (now: number) => {
      acc += now - last;
      last = now;
      if (acc >= 50) {
        const s = useStore.getState();
        const pb = s.playback;
        if (!pb) return;
        const end = duration(pb.recording);
        if (pb.pace === 'story' && !pb.live) {
          const clock = clockFor(pb.recording);
          const storyTime = Math.min(clock.total, pb.storyTime + acc * pb.speed);
          s.set({ playback: { ...pb, storyTime, time: clock.toReal(storyTime), playing: storyTime < clock.total } });
          acc = 0;
          if (storyTime >= clock.total) return;
        } else {
          const next = Math.min(end, pb.time + acc * pb.speed);
          acc = 0;
          s.set({ playback: { ...pb, time: next, playing: pb.live ? true : next < end } });
          if (next >= end && !pb.live) return;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);
  return null;
}

/** Every event of the recorded session, for people who want the raw detail. Opened from the investigation card. */
export function EventLog() {
  const open = useStore((s) => s.eventsOpen);
  const pb = useStore((s) => s.playback);
  const set = useStore((s) => s.set);
  const seek = useStore((s) => s.seek);
  const flyTo = useStore((s) => s.flyTo);
  const listRef = useRef<HTMLDivElement>(null);
  const rec = pb?.recording;
  const idx = rec && pb ? eventIndexAt(rec, pb.time) : -1;
  const laneIndex = useMemo(() => new Map(rec?.lanes.map((l, i) => [l.id, i]) ?? []), [rec]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector(`[data-seq="${idx}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [idx, open]);

  const stats = rec?.result?.stats;
  return (
    <AnimatePresence>
      {open && rec && pb && (
        <motion.aside
          key="events"
          className="glass thick panel"
          aria-label="All Bob events"
          role="dialog"
          initial={{ x: 40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 40, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 32 }}
          style={{ zIndex: 50 }}
        >
          <div className="sheet-handle" />
          <header>
            <div className="stack grow" style={{ gap: 4 }}>
              <span className="eyebrow">Flight recorder</span>
              <span className="title-3">All {rec.events.length} events, in order</span>
              <span className="caption">
                {stats?.duration_ms !== undefined && `${fmt(stats.duration_ms)} real time · `}
                {stats?.tool_calls ?? '?'} tool calls · {rec.lanes.length - 1} subagents
              </span>
            </div>
            <button className="btn icon sm" aria-label="Close the event list" onClick={() => set({ eventsOpen: false })}>
              <Icon.close />
            </button>
          </header>
          <div className="row wrap" style={{ gap: 6, padding: '0 18px 10px' }}>
            {rec.lanes.map((l, i) => (
              <span key={l.id} className="chip" title={l.label} style={{ color: laneColor(i) }}>
                <span className="dot" />
                {l.kind === 'main' ? 'Bob' : `subagent ${i}`}
              </span>
            ))}
          </div>
          <div ref={listRef} className="scroll" role="list" aria-label="Bob events">
            {rec.events.map((ev) => {
              const li = laneIndex.get(ev.lane) ?? 0;
              const past = ev.seq <= idx;
              return (
                <button
                  key={ev.seq}
                  data-seq={ev.seq}
                  role="listitem"
                  className="list-item"
                  aria-selected={ev.seq === idx}
                  onClick={() => {
                    seek(ev.t, false);
                    if (ev.targets[0]) flyTo(ev.targets[0], 22, false);
                  }}
                  style={{ padding: '5px 8px', opacity: past ? 1 : 0.5, gap: 8 }}
                >
                  <span className="mono tabular tertiary" style={{ width: 46, flex: 'none', fontSize: 11 }}>
                    {fmt(ev.t)}
                  </span>
                  <span style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, background: laneColor(li), flex: 'none' }} />
                  <span style={{ width: 16, textAlign: 'center', flex: 'none', color: ev.status === 'error' ? 'var(--orange)' : undefined }}>{glyph(ev)}</span>
                  <span className="truncate grow" style={{ fontSize: 12.5 }}>
                    {describeEvent(ev)}
                  </span>
                </button>
              );
            })}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
