import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ground } from '@codeverse/grounding';
import { eventIndexAt } from '@codeverse/stream';
import { goChapter } from './chapters';
import { TourPanel } from './features/tour/TourPanel';
import { loadIndex, loadWorld, readUserFile, worldFromGraph } from './data';
import { connectBridge, liveParams, sendRun } from './live/bridgeClient';
import { CityScene } from './scene/CityScene';
import { currentIncident, useStore } from './store';
import { momentsFor } from './story/clock';
import { parseLink } from './story/deeplink';
import { FlowDirector } from './story/FlowDirector';
import { flowsFor } from './story/flows';
import { IncidentDirector } from './story/IncidentDirector';
import { StoryDirector, startStory, story } from './story/StoryDirector';
import { UrlSync } from './story/UrlSync';
import { CodePanel } from './ui/CodePanel';
import { Dock } from './ui/Dock';
import { EventLog, PlaybackClock } from './ui/FlightRecorder';
import { Intro } from './ui/Intro';
import { Legend } from './ui/Legend';
import { Map2D } from './ui/Map2D';
import { ReplayBadge, Toast } from './ui/Overlays';
import { ChapterPanel, Inspector, TicketCard } from './ui/Panels';
import { Search } from './ui/Search';
import { Splash } from './ui/Splash';
import { TopBar } from './ui/TopBar';
import { insets } from './ui/insets';

function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

const LEGEND_SEEN = 'codeverse.legendSeen';
const readFlag = (k: string) => {
  try {
    return window.localStorage.getItem(k) === '1';
  } catch {
    return false;
  }
};
const writeFlag = (k: string) => {
  try {
    window.localStorage.setItem(k, '1');
  } catch {
    // storage unavailable (private mode): the legend simply shows again next time
  }
};

function FpsMeter() {
  const [fps, setFps] = useState(0);
  useEffect(() => {
    let raf = 0;
    let frames = 0;
    let last = performance.now();
    const tick = (now: number) => {
      frames++;
      if (now - last >= 1000) {
        setFps(Math.round((frames * 1000) / (now - last)));
        frames = 0;
        last = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div className="glass capsule caption tabular" style={{ position: 'fixed', left: 16, bottom: 16, padding: '6px 12px', zIndex: 50 }}>
      {fps} fps
    </div>
  );
}

function LivePrompt() {
  const liveStatus = useStore((s) => s.liveStatus);
  const [text, setText] = useState('Payment failed during checkout');
  if (liveStatus !== 'connected') return null;
  return (
    <form
      className="glass capsule row"
      style={{ position: 'fixed', top: 112, left: '50%', transform: 'translateX(-50%)', zIndex: 34, padding: 6, gap: 6, width: 'min(560px, calc(100vw - 32px))' }}
      onSubmit={(e) => {
        e.preventDefault();
        if (!sendRun('investigate', text)) useStore.getState().notify('Bridge not connected', 'error');
      }}
    >
      <span className="chip red" style={{ marginLeft: 4 }}>
        <span className="dot" /> LIVE
      </span>
      <input aria-label="Symptom for Bob to investigate" value={text} maxLength={400} onChange={(e) => setText(e.target.value)} style={{ flex: 1, background: 'transparent', border: 0, outline: 0, fontSize: 13 }} />
      <button className="btn accent" type="submit">
        Ask Bob
      </button>
    </form>
  );
}

function openTour() {
  const s = useStore.getState();
  if (!s.world?.tour) return;
  s.set({ mode: 'tour', story: undefined, flow: undefined, playback: undefined, selected: undefined, code: undefined, introOpen: false, sheet: undefined, stage: 'investigate', healed: false, pathProgress: 0 });
}

/** Applies a deep link after the world has loaded. Returns false when there was nothing to apply. */
function applyLink(search: string): boolean {
  const link = parseLink(search);
  const s = useStore.getState();
  if (link.story && s.world?.incidents.length) {
    startStory();
    return true;
  }
  if (link.tour && s.world?.tour) {
    openTour();
    return true;
  }
  if (!link.chapter && !link.node && !link.flow) return false;
  goChapter(link.chapter ?? 'explore', { moment: link.moment, autoplay: !link.moment });
  if (link.flow && s.world && flowsFor(s.world).some((f) => f.id === link.flow)) {
    const f = flowsFor(s.world).find((x) => x.id === link.flow)!;
    s.set({ flow: { id: f.id, step: Math.min(f.hops.length - 1, link.step ?? 0), playing: false } });
  }
  if (link.node && s.world?.graph.nodes.some((n) => n.id === link.node)) s.flyTo(link.node);
  return true;
}

export function App() {
  const world = useStore((s) => s.world);
  const index = useStore((s) => s.index);
  const loadError = useStore((s) => s.loadError);
  const loading = useStore((s) => s.loading);
  const view2d = useStore((s) => s.view2d);
  const isMobile = useStore((s) => s.isMobile);
  const selected = useStore((s) => s.selected);
  const code = useStore((s) => s.code);
  const eventsOpen = useStore((s) => s.eventsOpen);
  const chapter = useStore((s) => s.chapter);
  const stage = useStore((s) => s.stage);
  const mode = useStore((s) => s.mode);
  const set = useStore((s) => s.set);
  const [webgl] = useState(hasWebGL);
  const [showFps] = useState(() => new URLSearchParams(location.search).has('fps'));
  const fileInput = useRef<HTMLInputElement>(null);

  const openWorld = useCallback(
    async (id: string) => {
      const idx = useStore.getState().index;
      const entry = idx?.worlds.find((w) => w.id === id);
      if (!entry) return;
      set({ loading: true, selected: undefined, code: undefined, playback: undefined, flow: undefined, story: undefined, mode: 'explore', chapter: 'explore', stage: 'investigate', pathProgress: 0, healed: false });
      try {
        const w = await loadWorld(entry);
        set({ world: w, loading: false, incidentId: w.incidents[0]?.id, loadError: undefined });
      } catch (e) {
        set({ loadError: (e as Error).message, loading: false });
      }
    },
    [set],
  );

  // Boot: environment, data, deep link or first-run intro.
  useEffect(() => {
    const initialSearch = window.location.search;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const small = window.matchMedia('(max-width: 760px)');
    set({ reducedMotion: reduced.matches, isMobile: small.matches, view2d: small.matches || !webgl });
    const onReduced = () => set({ reducedMotion: reduced.matches });
    const onSmall = () => set({ isMobile: small.matches, ...(small.matches ? { view2d: true } : {}) });
    reduced.addEventListener('change', onReduced);
    small.addEventListener('change', onSmall);
    (async () => {
      try {
        const idx = await loadIndex();
        set({ index: idx });
        const wanted = new URLSearchParams(initialSearch).get('world');
        const first = idx.worlds.find((w) => w.id === wanted) ?? idx.worlds[0];
        if (!first) {
          set({ loadError: 'No codebases were bundled with this build.', loading: false });
          return;
        }
        await openWorld(first.id);
        if (!applyLink(initialSearch)) set({ introOpen: true });
        set({ booted: true });
      } catch (e) {
        set({ loadError: (e as Error).message, loading: false });
      }
    })();
    if (liveParams()) connectBridge();
    return () => {
      reduced.removeEventListener('change', onReduced);
      small.removeEventListener('change', onSmall);
    };
  }, [openWorld, set, webgl]);

  // The legend explains the visual language once, the first time someone explores on their own.
  const prevIntro = useRef(false);
  useEffect(() => {
    return useStore.subscribe((s) => {
      const was = prevIntro.current;
      prevIntro.current = s.introOpen;
      if (was && !s.introOpen && s.chapter === 'explore' && !s.story && !readFlag(LEGEND_SEEN)) {
        writeFlag(LEGEND_SEEN);
        setTimeout(() => useStore.getState().set({ legendOpen: true }), 900);
      }
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useStore.getState();
      const el = e.target as HTMLElement | null;
      const typing = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        s.set({ searchOpen: !s.searchOpen });
        return;
      }
      if (typing || s.introOpen || e.metaKey || e.ctrlKey || e.altKey) return;
      const onControl = el?.closest('button, [role="slider"], [role="menuitem"], summary, a');
      if (e.key === 'Escape') {
        if (s.menuOpen) s.set({ menuOpen: false });
        else if (s.searchOpen) s.set({ searchOpen: false });
        else if (s.legendOpen) s.set({ legendOpen: false });
        else if (s.code) s.openCode(undefined);
        else if (s.eventsOpen) s.set({ eventsOpen: false });
        else if (s.sheet) s.set({ sheet: undefined });
        else if (s.selected) s.select(undefined);
        else if (s.flow) s.set({ flow: undefined });
        else if (s.story?.playing) story.pause();
        return;
      }
      if (s.searchOpen || s.legendOpen || s.menuOpen) return;
      const inTour = s.mode === 'tour';
      if (e.key === '/') {
        e.preventDefault();
        s.set({ searchOpen: true });
      } else if (e.key === '?') s.set({ legendOpen: true });
      else if (e.key.toLowerCase() === 'm') s.set({ view2d: !s.view2d });
      else if (e.key.toLowerCase() === 't' && s.world?.tour) openTour();
      else if (e.key === '1') goChapter('explore');
      else if (e.key === '2' && s.world?.incidents.length) goChapter('investigate', { autoplay: true });
      else if (e.key === '3' && s.world?.incidents.length) goChapter('fixed');
      else if (e.key === ' ' && !inTour && !onControl) {
        e.preventDefault();
        if (s.story) story.toggle();
        else if (s.flow) s.set({ flow: { ...s.flow, playing: !s.flow.playing } });
        else if (s.playback) s.set({ playback: { ...s.playback, playing: !s.playback.playing } });
      } else if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && !inTour && !el?.closest('[role="slider"]')) {
        const fwd = e.key === 'ArrowRight';
        if (s.story) (fwd ? story.next : story.prev)();
        else if (s.flow && s.world) {
          const f = flowsFor(s.world).find((x) => x.id === s.flow!.id);
          if (f) s.set({ flow: { ...s.flow, playing: false, step: Math.max(0, Math.min(f.hops.length - 1, s.flow.step + (fwd ? 1 : -1))) } });
        } else if (s.playback && s.stage === 'investigate') {
          const inc = currentIncident(s);
          const rec = inc?.recording;
          if (!rec || s.playback.recording !== rec) return;
          const ms = momentsFor(rec);
          const idx = eventIndexAt(rec, s.playback.time);
          const target = fwd ? ms.find((m) => m.seq > idx) : [...ms].reverse().find((m) => m.seq < idx);
          s.seek(target?.t ?? (fwd ? s.playback.time : 0), false);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const onFile = useCallback(async (f: File) => {
    const s = useStore.getState();
    try {
      const doc = await readUserFile(f);
      if (doc.kind === 'codeverse.graph') {
        s.set({ world: worldFromGraph(doc), mode: 'explore', chapter: 'explore', playback: undefined, selected: undefined, introOpen: false, story: undefined, flow: undefined });
        s.notify(`Loaded ${doc.nodes.length} nodes from ${f.name}`);
      } else if (doc.kind === 'codeverse.recording') {
        s.set({ mode: 'explore', chapter: 'explore', introOpen: false, story: undefined });
        s.startPlayback(doc, { pace: 'story' });
        s.notify(`Playing ${doc.events.length} events from ${f.name}`);
      } else if (doc.kind === 'codeverse.investigation' && s.world) {
        const inc = { id: `file-${Date.now()}`, title: doc.symptom, investigation: doc, grounding: ground(doc, s.world.graph) };
        s.set({ world: { ...s.world, incidents: [inc, ...s.world.incidents] }, incidentId: inc.id });
        goChapter('investigate', { moment: 'failure' });
      } else {
        s.notify(`${doc.kind} loaded`);
      }
    } catch (e) {
      s.notify(`Couldn’t open ${f.name}: ${(e as Error).message}`, 'error');
    }
  }, []);

  if (loadError && !world) return <Splash error={loadError} />;
  if (!world || !index) return <Splash message="Drawing the city" />;

  const rightPanel = !isMobile && (Boolean(selected) || eventsOpen || mode === 'tour' || (mode === 'incident' && ((chapter === 'investigate' && stage === 'explain') || (chapter === 'fixed' && stage === 'verified'))));
  const reserve = !isMobile && code ? 'calc(min(620px, 46vw) + var(--gutter))' : undefined;
  insets.right = isMobile ? 0 : code ? Math.min(620, window.innerWidth * 0.46) + 20 : rightPanel ? 400 : 0;

  return (
    <main className={rightPanel ? 'has-panel' : undefined} style={reserve ? ({ ['--reserve-right' as string]: reserve } as React.CSSProperties) : undefined} onDragOver={(e) => e.preventDefault()} onDrop={(e) => (e.preventDefault(), e.dataTransfer.files[0] && onFile(e.dataTransfer.files[0]))}>
      <h1 className="sr-only">CodeVerse: {world.entry.title}</h1>
      {view2d || !webgl ? <Map2D world={world} /> : <CityScene key={world.entry.id + world.graph.nodes.length} world={world} />}
      <PlaybackClock />
      <IncidentDirector />
      <StoryDirector />
      <FlowDirector />
      <UrlSync />
      <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      <TopBar onWorld={(id) => void openWorld(id)} onTour={openTour} onFile={() => fileInput.current?.click()} />
      <ReplayBadge />
      <LivePrompt />
      <TicketCard />
      <Dock />
      <ChapterPanel />
      <Inspector />
      <EventLog />
      <TourPanel onClose={() => goChapter('explore')} />
      <CodePanel />
      <Search />
      <Legend />
      <Intro />
      <Toast />
      {showFps && <FpsMeter />}
      <AnimatePresence>
        {loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="glass capsule caption" role="status" style={{ position: 'fixed', bottom: 20, right: 20, padding: '8px 14px', zIndex: 50 }}>
            Loading…
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
