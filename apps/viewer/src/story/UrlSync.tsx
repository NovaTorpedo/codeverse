import { useEffect } from 'react';
import { eventIndexAt } from '@codeverse/stream';
import { currentIncident, useStore } from '../store';
import { momentsFor } from './clock';
import { linkSearch, type LinkMoment, type LinkState } from './deeplink';
import { momentAt } from './moments';

/** Keeps the address bar pointing at the current chapter and moment, so any view can be shared. */
export function UrlSync() {
  const booted = useStore((s) => s.booted);
  const intro = useStore((s) => s.introOpen);
  const world = useStore((s) => s.world?.entry.id);
  const mode = useStore((s) => s.mode);
  const chapter = useStore((s) => s.chapter);
  const stage = useStore((s) => s.stage);
  const story = useStore((s) => Boolean(s.story));
  const selected = useStore((s) => s.selected);
  const flow = useStore((s) => s.flow);
  const incident = useStore(currentIncident);
  const momentId = useStore((s) => {
    const pb = s.playback;
    const rec = incident?.recording;
    if (!pb || !rec || pb.recording !== rec) return undefined;
    return momentAt(momentsFor(rec), eventIndexAt(rec, pb.time))?.id;
  });

  useEffect(() => {
    if (!booted) return;
    let state: LinkState = {};
    if (!intro) {
      if (story) state = { world, story: true };
      else if (mode === 'tour') state = { world, tour: true };
      else {
        let moment: LinkMoment | undefined;
        if (chapter === 'investigate') moment = stage === 'investigate' ? momentId : stage === 'replay' ? 'failure' : 'explain';
        if (chapter === 'fixed') moment = stage === 'verified' ? 'healed' : 'fix';
        state = { world, chapter, moment, node: selected, flow: flow?.id, step: flow?.step };
      }
    }
    const search = linkSearch(state);
    if (search !== window.location.search) window.history.replaceState(null, '', `${window.location.pathname}${search}`);
  }, [booted, intro, world, mode, chapter, stage, story, selected, flow?.id, flow?.step, momentId]);
  return null;
}
