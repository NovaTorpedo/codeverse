import { create } from 'zustand';
import type { AnalysisGraph, IncidentEntry, Investigation, Recording, SemanticLayer, Tour, WorldEntry, WorldIndex } from '@codeverse/schema';
import type { GroundingReport } from '@codeverse/grounding';
import type { CityLayout } from './layout/cityLayout';
import { resolveNodeId } from './nodeIds';
import { clockFor } from './story/clock';
import type { Chapter } from './story/deeplink';

export type { Chapter } from './story/deeplink';
export type Mode = 'explore' | 'incident' | 'tour';
export type IncidentStage = 'investigate' | 'replay' | 'explain' | 'fix' | 'verified';

export interface LoadedIncident {
  id: string;
  title: string;
  investigation: Investigation;
  recording?: Recording;
  grounding: GroundingReport;
  baseline?: IncidentEntry['baseline'];
}

export interface LoadedWorld {
  entry: WorldEntry;
  graph: AnalysisGraph;
  layout: CityLayout;
  semantic?: SemanticLayer;
  semanticGrounding?: GroundingReport;
  tour?: Tour;
  tourGrounding?: GroundingReport;
  incidents: LoadedIncident[];
  /** Recordings not attached to an incident (live runs, uploads). */
  recordings: Recording[];
}

export interface CodeTarget {
  file: string;
  line?: number;
  endLine?: number;
  tone?: 'yellow' | 'red';
  title?: string;
}

export interface Playback {
  recording: Recording;
  /** Real recording time (ms since the first event). Everything in the scene reads this. */
  time: number;
  playing: boolean;
  speed: 1 | 2 | 4;
  live: boolean;
  /** 'story' compresses quiet gaps so a long session plays in about half a minute; 'real' is wall-clock. */
  pace: 'story' | 'real';
  storyTime: number;
}

export interface FlowState {
  id: string;
  /** Index of the hop in progress; earlier hops are complete. */
  step: number;
  playing: boolean;
}

export interface StoryState {
  beat: number;
  playing: boolean;
  /** ms already spent in the current beat (for pause/resume). */
  elapsed: number;
}

interface State {
  index?: WorldIndex;
  world?: LoadedWorld;
  loadError?: string;
  loading: boolean;
  /** True once the first world is loaded and the deep link (or intro) has been applied. */
  booted: boolean;
  mode: Mode;
  chapter: Chapter;
  introOpen: boolean;
  legendOpen: boolean;
  eventsOpen: boolean;
  menuOpen: boolean;
  /** Slow camera drift (intro and the story's opening shots). */
  orbit: boolean;
  /** Phones: which detail sheet is open over the dock. Desktop shows these panels automatically. */
  sheet?: 'rootcause' | 'impact';
  story?: StoryState;
  flow?: FlowState;
  selected?: string;
  hovered?: string;
  focus?: { id: string; nonce: number; distance?: number; point?: { x: number; y: number; z: number } };
  searchOpen: boolean;
  code?: CodeTarget;
  playback?: Playback;
  incidentId?: string;
  stage: IncidentStage;
  /** 0..n progress along the execution path (steps revealed). */
  pathProgress: number;
  healed: boolean;
  caption?: { text: string; kind: 'reasoning' | 'narration' | 'answer' };
  reducedMotion: boolean;
  view2d: boolean;
  isMobile: boolean;
  helpOpen: boolean;
  toast?: { text: string; tone: 'info' | 'error'; nonce: number };
  liveStatus?: 'connecting' | 'connected' | 'closed';

  set: (p: Partial<State>) => void;
  select: (id?: string) => void;
  flyTo: (id: string, distance?: number, select?: boolean) => void;
  overview: (distance?: number) => void;
  /** Frames a set of nodes (e.g. a request path) so all of them are in view. */
  frame: (ids: string[], k?: number) => void;
  openCode: (c: CodeTarget | undefined) => void;
  notify: (text: string, tone?: 'info' | 'error') => void;
  startPlayback: (recording: Recording, opts?: { live?: boolean; autoplay?: boolean; pace?: Playback['pace']; at?: number }) => void;
  /** Moves playback to a real time, keeping story time in step. */
  seek: (time: number, playing?: boolean) => void;
}

export const OVERVIEW = '__overview__';

export const useStore = create<State>((set, get) => ({
  loading: true,
  booted: false,
  mode: 'explore',
  chapter: 'explore',
  introOpen: false,
  legendOpen: false,
  eventsOpen: false,
  menuOpen: false,
  orbit: false,
  searchOpen: false,
  stage: 'investigate',
  pathProgress: 0,
  healed: false,
  reducedMotion: false,
  view2d: false,
  isMobile: false,
  helpOpen: false,
  set: (p) => set(p),
  select: (id) => set({ selected: id }),
  flyTo: (raw, distance, select = true) => {
    const nodes = get().world?.graph.nodes;
    const id = nodes ? resolveNodeId(new Set(nodes.map((n) => n.id)), raw) : raw;
    set({ focus: { id, nonce: (get().focus?.nonce ?? 0) + 1, distance }, ...(select ? { selected: id } : {}) });
  },
  overview: (distance) => set({ focus: { id: OVERVIEW, nonce: (get().focus?.nonce ?? 0) + 1, distance } }),
  frame: (ids, k = 1) => {
    const layout = get().world?.layout;
    const pts = (layout ? ids.map((id) => layout.anchor(id)) : []).filter((p): p is { x: number; y: number; z: number } => Boolean(p));
    if (!pts.length) return;
    const c = { x: pts.reduce((a, p) => a + p.x, 0) / pts.length, y: pts.reduce((a, p) => a + p.y, 0) / pts.length, z: pts.reduce((a, p) => a + p.z, 0) / pts.length };
    const r = Math.max(...pts.map((p) => Math.hypot(p.x - c.x, p.z - c.z)));
    set({ focus: { id: '__point__', point: c, nonce: (get().focus?.nonce ?? 0) + 1, distance: Math.max(20, r * 2.1 + 14) * k } });
  },
  openCode: (c) => set({ code: c }),
  notify: (text, tone = 'info') => set({ toast: { text, tone, nonce: (get().toast?.nonce ?? 0) + 1 } }),
  startPlayback: (recording, opts = {}) => {
    const pace = opts.live ? 'real' : (opts.pace ?? 'story');
    const time = opts.live ? (recording.events.at(-1)?.t ?? 0) : (opts.at ?? 0);
    set({ playback: { recording, time, storyTime: pace === 'story' ? clockFor(recording).toStory(time) : 0, playing: opts.autoplay ?? true, speed: get().playback?.speed ?? 1, live: Boolean(opts.live), pace } });
  },
  seek: (time, playing) => {
    const pb = get().playback;
    if (!pb) return;
    const end = pb.recording.events.at(-1)?.t ?? 0;
    const t = Math.max(0, Math.min(end, time));
    set({ playback: { ...pb, time: t, storyTime: clockFor(pb.recording).toStory(t), playing: playing ?? pb.playing } });
  },
}));

export const currentIncident = (s: Pick<State, 'world' | 'incidentId'>): LoadedIncident | undefined =>
  s.world?.incidents.find((i) => i.id === s.incidentId) ?? s.world?.incidents[0];
