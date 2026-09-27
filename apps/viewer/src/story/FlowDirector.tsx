import { useEffect } from 'react';
import { useStore } from '../store';
import { flowsFor } from './flows';

const HOP_DWELL_MS = 2800;

/** Follow a request: frames the current hop and, while playing, advances one hop at a time. */
export function FlowDirector() {
  const flow = useStore((s) => s.flow);
  const world = useStore((s) => s.world);
  const f = flow && world ? flowsFor(world).find((x) => x.id === flow.id) : undefined;

  useEffect(() => {
    if (!flow || !f) return;
    const hop = f.hops[flow.step];
    if (hop) useStore.getState().frame([hop.from, hop.to], 0.9);
  }, [flow?.id, flow?.step, f]);

  useEffect(() => {
    if (!flow?.playing || !f) return;
    const t = setTimeout(() => {
      const cur = useStore.getState().flow;
      if (!cur || cur.id !== flow.id) return;
      if (cur.step >= f.hops.length - 1) useStore.getState().set({ flow: { ...cur, playing: false } });
      else useStore.getState().set({ flow: { ...cur, step: cur.step + 1 } });
    }, HOP_DWELL_MS);
    return () => clearTimeout(t);
  }, [flow?.id, flow?.step, flow?.playing, f]);

  return null;
}
