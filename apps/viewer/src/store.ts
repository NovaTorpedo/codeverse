import { create } from 'zustand';
import type { AnalysisGraph, Investigation, Recording, SemanticLayer, Tour, WorldEntry, WorldIndex } from '@codeverse/schema';
import type { GroundingReport } from '@codeverse/grounding';
import type { CityLayout } from './layout/cityLayout';
import { resolveNodeId } from './nodeIds';

export type Mode = 'explore' | 'incident' | 'tour';
export type IncidentStage = 'investigate' | 'replay' | 'explain' | 'fix' | 'verified';

export interface LoadedIncident {
  id: string;
  title: string;
  investigation: Investigation;
  recording?: Recording;
  grounding: GroundingReport;
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
  time: number;
  playing: boolean;
  speed: 1 | 2 | 4;
  live: boolean;
}

interface State {
  index?: WorldIndex;
  world?: LoadedWorld;
  loadError?: string;
  loading: boolean;
  mode: Mode;
  selected?: string;
  hovered?: string;
  focus?: { id: string; nonce: number; distance?: number };
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
  helpOpen: boolean;
  toast?: { text: string; tone: 'info' | 'error'; nonce: number };
  liveStatus?: 'connecting' | 'connected' | 'closed';

  set: (p: Partial<State>) => void;
  select: (id?: string) => void;
  flyTo: (id: string, distance?: number, select?: boolean) => void;
  openCode: (c: CodeTarget | undefined) => void;
  notify: (text: string, tone?: 'info' | 'error') => void;
  startPlayback: (recording: Recording, opts?: { live?: boolean; autoplay?: boolean }) => void;
}

export const useStore = create<State>((set, get) => ({
  loading: true,
  mode: 'explore',
  searchOpen: false,
  stage: 'investigate',
  pathProgress: 0,
  healed: false,
  reducedMotion: false,
  view2d: false,
  helpOpen: false,
  set: (p) => set(p),
  select: (id) => set({ selected: id }),
  flyTo: (raw, distance, select = true) => {
    const nodes = get().world?.graph.nodes;
    const id = nodes ? resolveNodeId(new Set(nodes.map((n) => n.id)), raw) : raw;
    set({ focus: { id, nonce: (get().focus?.nonce ?? 0) + 1, distance }, ...(select ? { selected: id } : {}) });
  },
  openCode: (c) => set({ code: c }),
  notify: (text, tone = 'info') => set({ toast: { text, tone, nonce: (get().toast?.nonce ?? 0) + 1 } }),
  startPlayback: (recording, opts = {}) =>
    set({ playback: { recording, time: opts.live ? (recording.events.at(-1)?.t ?? 0) : 0, playing: opts.autoplay ?? true, speed: get().playback?.speed ?? 1, live: Boolean(opts.live) } }),
}));

export const currentIncident = (s: Pick<State, 'world' | 'incidentId'>): LoadedIncident | undefined =>
  s.world?.incidents.find((i) => i.id === s.incidentId) ?? s.world?.incidents[0];
