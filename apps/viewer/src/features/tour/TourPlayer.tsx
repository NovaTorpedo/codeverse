import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store';
import { Icon } from '../../ui/icons';
import { dwellMs } from './tourUtils';

/**
 * Guided tour player. Renders a caption rail and playback controls at the
 * bottom of the screen. Mounts only when mode === 'tour' and a tour is loaded
 * (guaranteed by the TourPanel parent guard).
 */
export function TourPlayer() {
  const tour = useStore((s) => s.world?.tour);
  const mode = useStore((s) => s.mode);
  const reducedMotion = useStore((s) => s.reducedMotion);
  const openCode = useStore((s) => s.openCode);

  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [deeperOpen, setDeeperOpen] = useState(false);

  const idxRef = useRef(idx);
  const playingRef = useRef(playing);
  idxRef.current = idx;
  playingRef.current = playing;

  const waypoints = tour?.waypoints ?? [];
  const waypoint = waypoints[idx];
  const dwell = waypoint ? dwellMs(waypoint.narration) : 9_000;
  const progress = Math.min(1, elapsed / dwell);

  // Fly camera and set caption whenever the active stop changes
  useEffect(() => {
    if (!waypoint) return;
    const s = useStore.getState();
    s.flyTo(waypoint.node, undefined, false);
    s.set({ caption: { text: waypoint.narration, kind: 'narration' } });
    setElapsed(0);
    setDeeperOpen(false);
  }, [idx, waypoint]);

  // Clear caption on unmount
  useEffect(() => {
    return () => {
      useStore.getState().set({ caption: undefined });
    };
  }, []);

  // Auto-advance interval (disabled when reducedMotion)
  useEffect(() => {
    if (reducedMotion || !playing) return;
    const id = setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 100;
        if (next >= dwell) {
          // Advance to next stop, or stop at end
          setIdx((i) => {
            const last = waypoints.length - 1;
            if (i >= last) {
              setPlaying(false);
              return i;
            }
            return i + 1;
          });
          return 0;
        }
        return next;
      });
    }, 100);
    return () => clearInterval(id);
  }, [playing, reducedMotion, dwell, waypoints.length]);

  // Keyboard shortcuts (Space, ←, →) — only when mode is tour and no playback active
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useStore.getState();
      if (s.mode !== 'tour') return;
      if (s.playback) return;
      if (s.searchOpen || s.helpOpen) return;
      const typing =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement;
      if (typing) return;

      if (e.key === ' ') {
        e.preventDefault();
        setPlaying((p) => !p);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setIdx((i) => Math.max(0, i - 1));
        setElapsed(0);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setIdx((i) => Math.min(waypoints.length - 1, i + 1));
        setElapsed(0);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [waypoints.length]);

  if (mode !== 'tour' || !tour || !waypoint) return null;

  const canPrev = idx > 0;
  const canNext = idx < waypoints.length - 1;

  const handlePrev = () => {
    if (!canPrev) return;
    setIdx(idx - 1);
    setElapsed(0);
  };
  const handleNext = () => {
    if (!canNext) return;
    setIdx(idx + 1);
    setElapsed(0);
  };
  const handlePlayPause = () => setPlaying((p) => !p);

  // Shared horizontal anchor style
  const anchor: React.CSSProperties = {
    position: 'fixed',
    left: '50%',
    transform: 'translateX(-50%)',
    width: 'min(760px, calc(100vw - 32px))',
    zIndex: 28,
  };

  return (
    <>
      {/* Caption rail — glass thin pill, narration text */}
      <div
        style={{
          ...anchor,
          bottom: 24,
          pointerEvents: 'none',
        }}
        aria-live="polite"
      >
        <div
          className="glass thin"
          style={{ padding: '10px 16px', borderRadius: 18 }}
        >
          <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
            <span
              className="chip cyan"
              style={{ flex: 'none', fontSize: 10, height: 20 }}
            >
              {idx + 1} / {waypoints.length}
            </span>
            <span style={{ fontSize: 13.5, lineHeight: 1.45 }}>
              {waypoint.narration}
            </span>
          </div>
        </div>
      </div>

      {/* Controls strip */}
      <div
        style={{
          ...anchor,
          bottom: 94,
          pointerEvents: 'auto',
        }}
      >
        <div
          className="glass"
          style={{
            padding: '8px 12px',
            borderRadius: 18,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {/* Prev */}
          <button
            className="btn icon"
            aria-label="Previous stop"
            disabled={!canPrev}
            onClick={handlePrev}
          >
            <Icon.back />
          </button>

          {/* Play / Pause */}
          <button
            className="btn icon"
            aria-label={playing ? 'Pause' : 'Play'}
            onClick={handlePlayPause}
            disabled={reducedMotion}
            title={reducedMotion ? 'Auto-advance disabled (reduced motion)' : undefined}
          >
            {playing ? <Icon.pause /> : <Icon.play />}
          </button>

          {/* Next */}
          <button
            className="btn icon"
            aria-label="Next stop"
            disabled={!canNext}
            onClick={handleNext}
          >
            <Icon.fwd />
          </button>

          {/* Progress bar */}
          <div
            role="progressbar"
            aria-valuenow={Math.round(progress * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Stop progress"
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              background: 'rgba(255,255,255,0.10)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${progress * 100}%`,
                background: 'var(--cyan)',
                borderRadius: 2,
                transition: reducedMotion ? 'none' : 'width 100ms linear',
              }}
            />
          </div>

          {/* Go deeper toggle */}
          {waypoint.deeper.length > 0 && (
            <button
              className="btn tinted"
              style={{ flex: 'none' }}
              aria-expanded={deeperOpen}
              onClick={() => setDeeperOpen((o) => !o)}
            >
              {deeperOpen ? 'Close' : 'Go deeper'}
            </button>
          )}
        </div>
      </div>

      {/* Go Deeper panel */}
      {deeperOpen && waypoint.deeper.length > 0 && (
        <div
          style={{
            ...anchor,
            bottom: 152,
            pointerEvents: 'auto',
            maxHeight: '40vh',
          }}
        >
          <div
            className="glass thick scroll"
            style={{ borderRadius: 18, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}
          >
            {waypoint.deeper.map((item, i) => (
              <div key={i} className="stack" style={{ gap: 6 }}>
                <span className="headline">{item.question}</span>
                <span className="caption" style={{ lineHeight: 1.5 }}>
                  {item.answer}
                </span>
                {item.citations.length > 0 && (
                  <div className="row" style={{ flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
                    {item.citations.map((c, ci) => (
                      <span
                        key={ci}
                        className="caption mono"
                        role="link"
                        tabIndex={0}
                        style={{ color: 'var(--cyan)', cursor: 'pointer' }}
                        onClick={() => openCode({ file: c.file, line: c.line })}
                        onKeyDown={(e) =>
                          e.key === 'Enter' &&
                          openCode({ file: c.file, line: c.line })
                        }
                      >
                        {c.file.split('/').pop()}
                        {c.line ? `:${c.line}` : ''}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
