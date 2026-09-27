import { useMemo } from 'react';
import { eventIndexAt, stateAt, type PlaybackState } from '@codeverse/stream';
import { currentIncident, useStore } from '../store';
import { flowsFor } from '../story/flows';
import type { BuildingTone } from './palette';

export function usePlaybackState(): PlaybackState | undefined {
  const rec = useStore((s) => s.playback?.recording);
  const idx = useStore((s) => (s.playback ? eventIndexAt(s.playback.recording, s.playback.time) : -1));
  const len = useStore((s) => s.playback?.recording.events.length ?? 0);
  return useMemo(() => (rec ? stateAt(rec, idx >= 0 ? rec.events[idx]!.t : -1) : undefined), [rec, idx, len]);
}

export interface Highlights {
  tones: Map<string, BuildingTone>;
  dimOthers: boolean;
}

/** Visual tone per node for the current mode, playback position and incident stage. */
export function useHighlights(): Highlights {
  const mode = useStore((s) => s.mode);
  const selected = useStore((s) => s.selected);
  const stage = useStore((s) => s.stage);
  const pathProgress = useStore((s) => s.pathProgress);
  const healed = useStore((s) => s.healed);
  const incident = useStore(currentIncident);
  const pb = usePlaybackState();
  const world = useStore((s) => s.world);
  const flow = useStore((s) => s.flow);

  return useMemo(() => {
    const tones = new Map<string, BuildingTone>();
    let dimOthers = false;
    const f = flow && world ? flowsFor(world).find((x) => x.id === flow.id) : undefined;
    if (f) {
      dimOthers = true;
      f.hops.forEach((h, i) => {
        if (i > flow!.step) return;
        if (!tones.has(h.from)) tones.set(h.from, 'ok');
        tones.set(h.to, i === flow!.step ? 'active' : h.status === 'failed' ? 'failed' : 'ok');
      });
      if (selected) tones.set(selected, 'selected');
      return { tones, dimOthers };
    }
    if (pb && (mode !== 'incident' || stage === 'investigate')) {
      for (const v of pb.visited) tones.set(v, 'visited');
      for (const m of pb.matched) tones.set(m, 'matched');
      for (const a of pb.active) tones.set(a, 'active');
    }
    if (mode === 'incident' && incident && stage !== 'investigate') {
      dimOthers = true;
      const inv = incident.investigation;
      if (stage !== 'replay') for (const c of inv.rootCause.citations) tones.set(c.file, 'cited');
      inv.executionPath.forEach((step, i) => {
        if (i >= pathProgress && !healed) return;
        if (step.status === 'failed') tones.set(step.file, healed ? 'healed' : 'failed');
        else if (step.status === 'ok' || healed) tones.set(step.file, healed ? 'healed' : 'ok');
      });
    }
    if (selected) tones.set(selected, 'selected');
    return { tones, dimOthers };
  }, [mode, selected, stage, pathProgress, healed, incident, pb, flow, world]);
}
