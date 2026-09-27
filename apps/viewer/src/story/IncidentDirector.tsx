import { useEffect } from 'react';
import { duration } from '@codeverse/stream';
import { currentIncident, useStore } from '../store';

/** Moves the incident through its stages: recording → failure replay → explanation. Pauses with the story. */
export function IncidentDirector() {
  const mode = useStore((s) => s.mode);
  const stage = useStore((s) => s.stage);
  const incident = useStore(currentIncident);
  const done = useStore((s) => (s.playback ? s.playback.time >= duration(s.playback.recording) && !s.playback.live : false));
  const progress = useStore((s) => s.pathProgress);
  const paused = useStore((s) => Boolean(s.story && !s.story.playing));
  const set = useStore((s) => s.set);
  const reducedMotion = useStore((s) => s.reducedMotion);
  const steps = incident?.investigation.executionPath ?? [];
  const failIdx = steps.findIndex((s) => s.status === 'failed');
  const stopAt = failIdx >= 0 ? failIdx + 1 : steps.length;

  useEffect(() => {
    if (mode !== 'incident' || stage !== 'investigate' || !done || paused) return;
    const t = setTimeout(() => useStore.getState().stage === 'investigate' && set({ stage: 'replay', pathProgress: 0, playback: undefined }), reducedMotion ? 300 : 1400);
    return () => clearTimeout(t);
  }, [mode, stage, done, set, reducedMotion, paused]);

  useEffect(() => {
    if (mode !== 'incident' || stage !== 'replay' || paused) return;
    const s = useStore.getState();
    if (progress === 1) s.frame(steps.map((x) => x.file));
    if (progress >= stopAt) {
      const t = setTimeout(() => useStore.getState().stage === 'replay' && set({ stage: 'explain', pathProgress: steps.length }), reducedMotion ? 400 : 1800);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => set({ pathProgress: progress + 1 }), reducedMotion ? 250 : progress === 0 ? 400 : 1100);
    return () => clearTimeout(t);
  }, [mode, stage, progress, stopAt, set, reducedMotion, steps, paused]);
  return null;
}
