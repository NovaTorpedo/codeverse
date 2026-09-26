import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ground } from '@codeverse/grounding';
import { TourPanel } from './features/tour/TourPanel';
import { loadIndex, loadWorld, readUserFile, worldFromGraph } from './data';
import { connectBridge, liveParams, sendRun } from './live/bridgeClient';
import { CityScene } from './scene/CityScene';
import { currentIncident, useStore, type Mode } from './store';
import { CodePanel } from './ui/CodePanel';
import { FlightRecorder, PlaybackClock } from './ui/FlightRecorder';
import { IncidentDirector, IncidentPanel } from './ui/IncidentPanel';
import { Map2D } from './ui/Map2D';
import { CaptionRail, HelpSheet, Minimap, ReplayBadge, Toast } from './ui/Overlays';
import { Search } from './ui/Search';
import { Sidebar } from './ui/Sidebar';
import { Splash } from './ui/Splash';
import { TopBar } from './ui/TopBar';

function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

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
    <div className="glass capsule caption tabular" style={{ position: 'fixed', right: 16, bottom: 16, padding: '6px 12px', zIndex: 50 }}>
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
      style={{ position: 'fixed', top: 110, left: '50%', transform: 'translateX(-50%)', zIndex: 34, padding: 6, gap: 6, width: 'min(560px, calc(100vw - 32px))' }}
      onSubmit={(e) => {
        e.preventDefault();
        if (!sendRun('investigate', text)) useStore.getState().notify('Bridge not connected', 'error');
      }}
    >
      <span className="chip red" style={{ marginLeft: 4 }}>
        <span className="dot" /> LIVE
      </span>
      <input aria-label="Symptom for Bob to investigate" value={text} maxLength={400} onChange={(e) => setText(e.target.value)} style={{ flex: 1, background: 'transparent', border: 0, outline: 0, fontSize: 13 }} />
      <button className="btn primary" type="submit">
        Ask Bob
      </button>
    </form>
  );
}

export function App() {
  const world = useStore((s) => s.world);
  const index = useStore((s) => s.index);
  const loadError = useStore((s) => s.loadError);
  const view2d = useStore((s) => s.view2d);
  const set = useStore((s) => s.set);
  const [webgl] = useState(hasWebGL);
  const [showFps] = useState(() => new URLSearchParams(location.search).has('fps'));

  const openWorld = useCallback(
    async (id: string) => {
      const idx = useStore.getState().index;
      const entry = idx?.worlds.find((w) => w.id === id);
      if (!entry) return;
      set({ loading: true, selected: undefined, code: undefined, playback: undefined, mode: 'explore', stage: 'investigate', pathProgress: 0, healed: false });
      try {
        const w = await loadWorld(entry);
        set({ world: w, loading: false, incidentId: w.incidents[0]?.id });
      } catch (e) {
        set({ loadError: (e as Error).message, loading: false });
      }
    },
    [set],
  );

  const changeMode = useCallback((m: Mode) => {
    const s = useStore.getState();
    const inc = currentIncident(s);
    if (m === 'incident') {
      s.set({ mode: m, stage: inc?.recording ? 'investigate' : 'replay', pathProgress: 0, healed: false, selected: undefined, code: undefined });
      if (inc?.recording) s.startPlayback(inc.recording);
      else s.set({ playback: undefined });
    } else {
      s.set({ mode: m, playback: m === 'explore' ? s.playback : undefined, code: undefined });
      if (m === 'explore') s.set({ playback: undefined });
    }
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const small = window.matchMedia('(max-width: 720px)');
    set({ reducedMotion: mq.matches, view2d: small.matches || !webgl });
    const onMq = () => set({ reducedMotion: mq.matches });
    mq.addEventListener('change', onMq);
    (async () => {
      try {
        const idx = await loadIndex();
        set({ index: idx });
        const wanted = new URLSearchParams(location.search).get('world');
        const first = idx.worlds.find((w) => w.id === wanted) ?? idx.worlds[0];
        if (first) await openWorld(first.id);
        else set({ loadError: 'No worlds were bundled with this build.', loading: false });
        if (new URLSearchParams(location.search).get('mode') === 'incident') changeMode('incident');
      } catch (e) {
        set({ loadError: (e as Error).message, loading: false });
      }
    })();
    if (liveParams()) connectBridge();
    return () => mq.removeEventListener('change', onMq);
  }, [openWorld, changeMode, set, webgl]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useStore.getState();
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        s.set({ searchOpen: !s.searchOpen });
        return;
      }
      if (typing) return;
      if (e.key === '/') {
        e.preventDefault();
        s.set({ searchOpen: true });
      }
      else if (e.key === 'Escape') {
        if (s.searchOpen) s.set({ searchOpen: false });
        else if (s.helpOpen) s.set({ helpOpen: false });
        else if (s.code) s.openCode(undefined);
        else s.select(undefined);
      } else if (e.key === ' ' && s.playback) {
        e.preventDefault();
        s.set({ playback: { ...s.playback, playing: !s.playback.playing } });
      } else if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && s.playback) {
        const ev = s.playback.recording.events;
        const cur = ev.findIndex((x) => x.t > s.playback!.time) - 1;
        const i = e.key === 'ArrowRight' ? (cur < 0 ? ev.length - 1 : cur + 1) : Math.max(0, (cur < 0 ? ev.length - 1 : cur) - 1);
        const target = ev[Math.max(0, Math.min(ev.length - 1, i))];
        if (target) s.set({ playback: { ...s.playback, time: target.t, playing: false } });
      } else if (e.key === '1') changeMode('explore');
      else if (e.key === '2' && s.world?.incidents.length) changeMode('incident');
      else if (e.key === '3' && s.world?.tour) changeMode('tour');
      else if (e.key.toLowerCase() === 'm') s.set({ view2d: !s.view2d });
      else if (e.key === '?') s.set({ helpOpen: true });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [changeMode]);

  const onFile = useCallback(async (f: File) => {
    const s = useStore.getState();
    try {
      const doc = await readUserFile(f);
      if (doc.kind === 'codeverse.graph') {
        s.set({ world: worldFromGraph(doc), mode: 'explore', playback: undefined, selected: undefined });
        s.notify(`Loaded ${doc.nodes.length} nodes from ${f.name}`);
      } else if (doc.kind === 'codeverse.recording') {
        s.set({ mode: 'explore' });
        s.startPlayback(doc);
        s.notify(`Playing ${doc.events.length} events from ${f.name}`);
      } else if (doc.kind === 'codeverse.investigation' && s.world) {
        const inc = { id: `file-${Date.now()}`, title: doc.symptom, investigation: doc, grounding: ground(doc, s.world.graph) };
        s.set({ world: { ...s.world, incidents: [inc, ...s.world.incidents] }, incidentId: inc.id });
        changeMode('incident');
      } else {
        s.notify(`${doc.kind} loaded`);
      }
    } catch (e) {
      s.notify(`Couldn’t open ${f.name}: ${(e as Error).message}`, 'error');
    }
  }, [changeMode]);

  if (loadError && !world) return <Splash error={loadError} />;
  if (!world || !index) return <Splash message="Materialising the city" />;

  return (
    <main onDragOver={(e) => e.preventDefault()} onDrop={(e) => (e.preventDefault(), e.dataTransfer.files[0] && onFile(e.dataTransfer.files[0]))}>
      <h1 className="sr-only">CodeVerse: {world.entry.title}</h1>
      {view2d || !webgl ? <Map2D world={world} /> : <CityScene key={world.entry.id + world.graph.nodes.length} world={world} />}
      <PlaybackClock />
      <IncidentDirector />
      <TopBar onWorld={(id) => void openWorld(id)} onMode={changeMode} />
      <ReplayBadge />
      <LivePrompt />
      <Sidebar onFile={onFile} />
      <IncidentPanel />
      <TourPanel />
      <CaptionRail />
      <FlightRecorder />
      {!view2d && <Minimap />}
      <CodePanel />
      <Search />
      <HelpSheet />
      <Toast />
      {showFps && <FpsMeter />}
      <AnimatePresence>
        {useStore.getState().loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="glass capsule caption" style={{ position: 'fixed', bottom: 20, right: 20, padding: '8px 14px', zIndex: 50 }}>
            Loading…
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
