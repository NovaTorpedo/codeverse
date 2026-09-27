import { currentIncident, useStore } from './store';
import { momentsFor } from './story/clock';
import type { Chapter, LinkMoment } from './story/deeplink';

/**
 * Chapter navigation shared by the chapter bar, the keyboard, deep links and the guided story.
 * Each chapter resets the scene to a clean, known state so every link opens the same view.
 */
export function goChapter(chapter: Chapter, opts: { moment?: LinkMoment; autoplay?: boolean; keepStory?: boolean } = {}) {
  const s = useStore.getState();
  const inc = currentIncident(s);
  const common = { chapter, selected: undefined, code: undefined, flow: undefined, eventsOpen: false, introOpen: false, orbit: false, caption: undefined, ...(opts.keepStory ? {} : { story: undefined }) };

  if (chapter === 'explore' || !inc) {
    s.set({ ...common, chapter: 'explore', mode: 'explore', playback: undefined, stage: 'investigate', pathProgress: 0, healed: false });
    s.overview();
    return;
  }

  const steps = inc.investigation.executionPath.length;
  if (chapter === 'investigate') {
    const m = opts.moment;
    if (m === 'failure') {
      s.set({ ...common, mode: 'incident', stage: 'replay', pathProgress: 0, healed: false, playback: undefined });
      return;
    }
    if (m === 'explain' || !inc.recording) {
      s.set({ ...common, mode: 'incident', stage: m === 'explain' ? 'explain' : 'replay', pathProgress: m === 'explain' ? steps : 0, healed: false, playback: undefined });
      if (m === 'explain') focusFailure();
      return;
    }
    s.set({ ...common, mode: 'incident', stage: 'investigate', pathProgress: 0, healed: false });
    const at = m ? momentsFor(inc.recording).find((x) => x.id === m)?.t : undefined;
    s.startPlayback(inc.recording, { autoplay: opts.autoplay ?? !m, pace: 'story', at: at ?? 0 });
    s.overview();
    return;
  }

  // fixed
  const healed = opts.moment === 'healed' || opts.moment === 'impact';
  s.set({ ...common, mode: 'incident', stage: healed ? 'verified' : 'fix', pathProgress: steps, healed, playback: undefined });
  if (healed) s.overview(0.9);
  else focusFailure();
}

/** Frames the whole failing request, so the break is seen in context. */
export function focusFailure() {
  const s = useStore.getState();
  const inc = currentIncident(s);
  if (inc) s.frame(inc.investigation.executionPath.map((x) => x.file));
}

export function applyFix() {
  const s = useStore.getState();
  s.set({ stage: 'verified', healed: true, selected: undefined });
  s.overview(0.9);
}

export function nextChapter(): Chapter | undefined {
  const c = useStore.getState().chapter;
  return c === 'explore' ? 'investigate' : c === 'investigate' ? 'fixed' : undefined;
}
