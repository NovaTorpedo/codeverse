import { ground } from '@codeverse/grounding';
import { parseDocument, type Recording } from '@codeverse/schema';
import { indexGraph, RecordingBuilder } from '@codeverse/stream';
import { useStore } from '../store';

/**
 * Live mode: connects to the local CodeVerse bridge when the page is opened with
 * `#live=<port>.<token>` (printed by `npm run bridge`). The token travels as a WebSocket
 * subprotocol, never in the URL sent to a server. Only loopback addresses are allowed.
 */
export type BridgeCommand = 'investigate' | 'scan' | 'tour';

let socket: WebSocket | undefined;
let builder: RecordingBuilder | undefined;
let runMeta: { id: string; title: string; target: string } | undefined;

export function liveParams(hash = typeof location !== 'undefined' ? location.hash : ''): { port: number; token: string } | undefined {
  const m = /[#&]live=(\d{2,5})\.([A-Za-z0-9_-]{16,128})/.exec(hash);
  if (!m) return undefined;
  const port = Number(m[1]);
  if (port < 1024 || port > 65535) return undefined;
  return { port, token: m[2]! };
}

export function connectBridge(): void {
  const p = liveParams();
  if (!p || socket) return;
  const s = useStore.getState();
  s.set({ liveStatus: 'connecting' });
  socket = new WebSocket(`ws://127.0.0.1:${p.port}/`, ['codeverse.v1', `token.${p.token}`]);
  socket.onopen = () => useStore.getState().set({ liveStatus: 'connected' });
  socket.onclose = () => {
    useStore.getState().set({ liveStatus: 'closed' });
    socket = undefined;
  };
  socket.onmessage = (e) => {
    if (typeof e.data !== 'string' || e.data.length > 4 * 1024 * 1024) return;
    let msg: { type?: string; [k: string]: unknown };
    try {
      msg = JSON.parse(e.data);
    } catch {
      return;
    }
    handle(msg);
  };
}

function handle(msg: { type?: string; [k: string]: unknown }) {
  const st = useStore.getState();
  const world = st.world;
  if (msg.type === 'run-start' && world) {
    const meta = msg.meta as { id?: string; title?: string; target?: string } | undefined;
    runMeta = { id: String(meta?.id ?? 'live').toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 60) || 'live', title: String(meta?.title ?? 'Live IBM Bob run').slice(0, 150), target: String(meta?.target ?? world.graph.project.root) };
    builder = new RecordingBuilder(indexGraph(world.graph));
    st.notify('Bob run started');
  } else if (msg.type === 'raw' && builder && runMeta && msg.event && typeof msg.event === 'object') {
    builder.pushObject(msg.event as Record<string, unknown>);
    const rec = snapshot();
    if (rec) {
      const pb = useStore.getState().playback;
      if (pb?.live && pb.recording.id === rec.id) useStore.getState().set({ playback: { ...pb, recording: rec, time: rec.events.at(-1)?.t ?? 0 } });
      else useStore.getState().startPlayback(rec, { live: true });
    }
  } else if (msg.type === 'run-end') {
    const rec = snapshot();
    const pb = useStore.getState().playback;
    if (rec && pb) useStore.getState().set({ playback: { ...pb, recording: rec, live: false, playing: false } });
    st.notify(`Bob run finished${typeof msg.exitCode === 'number' ? ` (exit ${msg.exitCode})` : ''}`);
    builder = undefined;
  } else if (msg.type === 'document' && world && typeof msg.text === 'string') {
    const parsed = parseDocument(msg.text);
    if (!parsed.ok) return st.notify(`Bob wrote an invalid document: ${parsed.error}`, 'error');
    const doc = parsed.value;
    if (doc.kind === 'codeverse.investigation') {
      const inc = { id: `live-${Date.now()}`, title: doc.symptom, investigation: doc, grounding: ground(doc, world.graph) };
      st.set({ world: { ...world, incidents: [inc, ...world.incidents] }, incidentId: inc.id });
      st.notify(`New investigation from Bob: ${doc.symptom}`);
    } else if (doc.kind === 'codeverse.semantic') {
      st.set({ world: { ...world, semantic: doc, semanticGrounding: ground(doc, world.graph) } });
      st.notify('Bob’s semantic layer updated');
    } else if (doc.kind === 'codeverse.tour') {
      st.set({ world: { ...world, tour: doc, tourGrounding: ground(doc, world.graph) } });
      st.notify('New tour from Bob');
    }
  } else if (msg.type === 'error') {
    st.notify(String(msg.message ?? 'Bridge error').slice(0, 200), 'error');
  }
}

function snapshot(): Recording | undefined {
  if (!builder || !runMeta) return undefined;
  try {
    return builder.build({ ...runMeta, synthetic: false, source: 'bob-shell', recordedAt: new Date().toISOString() });
  } catch {
    return undefined;
  }
}

export function sendRun(command: BridgeCommand, prompt: string): boolean {
  if (!socket || socket.readyState !== WebSocket.OPEN) return false;
  socket.send(JSON.stringify({ type: 'run', command, prompt: prompt.slice(0, 2000) }));
  return true;
}
