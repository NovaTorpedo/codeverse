import { useEffect, useRef } from 'react';
import { applyFix, goChapter } from '../chapters';
import { currentIncident, useStore, type LoadedIncident, type LoadedWorld } from '../store';
import { clockFor, momentsFor } from './clock';
import { impactFacts } from './impact';
import { fmtClock, momentAt } from './moments';

/**
 * The guided story ("Watch Bob solve it"): about ninety seconds across the three chapters, with captions.
 * Captions are product narration; every number in them is computed from the recorded data.
 */
export interface Beat {
  id: 'city' | 'links' | 'ticket' | 'investigate' | 'replay' | 'rootcause' | 'ruledout' | 'fix' | 'healed' | 'impact';
  /** Fixed duration, or wait for the recording / the failure replay to finish. */
  ms: number | 'recording' | 'replay';
  caption: (w: LoadedWorld, inc: LoadedIncident) => string;
  enter: () => void;
}

const s = () => useStore.getState();

export const BEATS: Beat[] = [
  {
    id: 'city',
    ms: 6500,
    caption: (w) => `This is ${w.entry.title}, a checkout system drawn from its own code. Each district is a service, and each tower is a file.`,
    enter: () => {
      goChapter('explore', { keepStory: true });
      s().set({ orbit: true });
    },
  },
  {
    id: 'links',
    ms: 5500,
    caption: (w) => `Light travels only along calls the analyzer can prove. IBM Bob added the meaning: it named ${w.semantic ? `all ${w.semantic.services.length}` : 'the'} districts.`,
    enter: () => s().set({ orbit: true }),
  },
  {
    id: 'ticket',
    ms: 6500,
    caption: () => 'The incident: checkout fails for some customers with “Something went wrong”. The logs show three warnings that look guilty: a slow card processor, low stock, degraded email.',
    enter: () => {
      goChapter('investigate', { keepStory: true, autoplay: false });
      s().set({ orbit: false });
    },
  },
  {
    id: 'investigate',
    ms: 'recording',
    caption: (_w, inc) => {
      const pb = s().playback;
      if (!pb || !inc.recording) return 'Bob investigates.';
      const idx = pb.recording.events.findIndex((e) => e.t > pb.time) - 1;
      const m = momentAt(momentsFor(inc.recording), idx < 0 ? pb.recording.events.length - 1 : idx);
      return m ? `${m.title}.${m.detail && m.id === 'rootcause' ? ` “${m.detail}”` : ''}` : 'Bob starts with the ticket and the logs, nothing else.';
    },
    enter: () => {
      const inc = currentIncident(s());
      const pb = s().playback;
      if (inc?.recording && (!pb || pb.recording !== inc.recording)) s().startPlayback(inc.recording, { pace: 'story', autoplay: true });
      else if (pb) s().set({ playback: { ...pb, playing: true } });
    },
  },
  {
    id: 'replay',
    ms: 'replay',
    caption: () => 'Bob rebuilt the failing request from the logs and the code. Watch where it breaks.',
    enter: () => {
      if (s().stage === 'investigate') s().set({ stage: 'replay', pathProgress: 0, playback: undefined });
    },
  },
  {
    id: 'rootcause',
    ms: 8500,
    caption: (_w, inc) => `Bob's root cause: “${inc.investigation.rootCause.title}”. ${inc.grounding.grounded} of ${inc.grounding.total} of its claims check out against the code.`,
    enter: () => {
      if (s().stage !== 'explain') goChapter('investigate', { moment: 'explain', keepStory: true });
    },
  },
  {
    id: 'ruledout',
    ms: 6500,
    caption: (_w, inc) => `The three warnings were red herrings. Bob ruled out ${inc.investigation.ruledOut.length} hypotheses, each with evidence from the logs and the code.`,
    enter: () => undefined,
  },
  {
    id: 'fix',
    ms: 7000,
    caption: (w, inc) => {
      const n = impactFacts(w, inc, inc.baseline).fixLinesChanged;
      return `Bob's fix is ${n === 1 ? 'one line' : `${n ?? 'a few'} lines`}: the check that let SSO sessions skip loading the customer's profile.`;
    },
    enter: () => goChapter('fixed', { keepStory: true }),
  },
  {
    id: 'healed',
    ms: 6500,
    caption: (w, inc) => {
      const f = impactFacts(w, inc, inc.baseline);
      const after = f.testsAfter ? `${f.testsAfter.passed} of ${f.testsAfter.passed + f.testsAfter.failed} tests pass` : 'the tests pass';
      const before = f.testsBefore ? ` (before: ${f.testsBefore.passed} of ${f.testsBefore.passed + f.testsBefore.failed})` : '';
      return `Same request, with the fix applied: it flows all the way through, and ${after}${before}.`;
    },
    enter: () => applyFix(),
  },
  {
    id: 'impact',
    ms: 9000,
    caption: (w, inc) => {
      const f = impactFacts(w, inc, inc.baseline);
      return f.rootCauseAtMs !== undefined ? `Bob named the root cause ${fmtClock(f.rootCauseAtMs)} into its run, reading ${f.filesBobRead ?? 'a few'} of ${f.filesInCodebase} files. Every number here comes from the recorded session and real test runs.` : 'Every number here comes from the recorded session and real test runs.';
    },
    enter: () => undefined,
  },
];

export function startStory() {
  useStore.getState().set({ story: { beat: 0, playing: true, elapsed: 0 }, introOpen: false });
  enterBeat(0);
}

function enterBeat(i: number) {
  const beat = BEATS[i];
  if (!beat) return;
  const st = s().story;
  s().set({ story: { beat: i, playing: st?.playing ?? true, elapsed: 0 } });
  beat.enter();
}

export const story = {
  pause() {
    const st = s().story;
    if (!st) return;
    s().set({ story: { ...st, playing: false } });
    const pb = s().playback;
    if (pb?.playing) s().set({ playback: { ...pb, playing: false } });
  },
  resume() {
    const st = s().story;
    if (!st) return;
    const last = st.beat === BEATS.length - 1 && st.elapsed >= (BEATS[st.beat]!.ms as number);
    if (last) return startStory();
    s().set({ story: { ...st, playing: true } });
    const pb = s().playback;
    if (BEATS[st.beat]?.id === 'investigate' && pb && !pb.playing) s().set({ playback: { ...pb, playing: true } });
  },
  toggle() {
    if (s().story?.playing) story.pause();
    else story.resume();
  },
  next() {
    const st = s().story;
    if (st && st.beat < BEATS.length - 1) enterBeat(st.beat + 1);
  },
  prev() {
    const st = s().story;
    if (!st) return;
    const target = Math.max(0, st.beat - 1);
    // Beats that wait on the scene restart from their chapter's clean state.
    if (BEATS[target]!.id === 'replay') goChapter('investigate', { moment: 'failure', keepStory: true });
    enterBeat(target);
  },
  exit() {
    s().set({ story: undefined, orbit: false });
  },
};

/** Advances the story: timed beats run on a clock that pauses; waiting beats watch the scene. */
export function StoryDirector() {
  const st = useStore((x) => x.story);
  const stage = useStore((x) => x.stage);
  const pbDone = useStore((x) => {
    const pb = x.playback;
    if (!pb) return false;
    return pb.pace === 'story' ? pb.storyTime >= clockFor(pb.recording).total : pb.time >= (pb.recording.events.at(-1)?.t ?? 0);
  });
  const started = useRef(0);
  const beat = st ? BEATS[st.beat] : undefined;

  // Timed beats: count elapsed time only while playing.
  useEffect(() => {
    if (!st || !beat || !st.playing || typeof beat.ms !== 'number') return;
    started.current = performance.now() - st.elapsed;
    const id = setInterval(() => {
      const cur = s().story;
      if (!cur || cur.beat !== st.beat || !cur.playing) return;
      const elapsed = performance.now() - started.current;
      if (elapsed >= (beat.ms as number)) {
        clearInterval(id);
        if (st.beat < BEATS.length - 1) enterBeat(st.beat + 1);
        else s().set({ story: { ...cur, playing: false, elapsed: beat.ms as number } });
      } else s().set({ story: { ...cur, elapsed } });
    }, 100);
    return () => clearInterval(id);
  }, [st?.beat, st?.playing, beat]);

  // Waiting beats.
  useEffect(() => {
    if (!st?.playing || !beat) return;
    if (beat.ms === 'recording' && (pbDone || stage !== 'investigate')) {
      const t = setTimeout(() => s().story?.beat === st.beat && enterBeat(st.beat + 1), 900);
      return () => clearTimeout(t);
    }
    if (beat.ms === 'replay' && stage === 'explain') {
      const t = setTimeout(() => s().story?.beat === st.beat && enterBeat(st.beat + 1), 600);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [st?.playing, st?.beat, beat, pbDone, stage]);

  return null;
}
