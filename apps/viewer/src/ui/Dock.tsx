import { useCallback, useMemo, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { eventIndexAt } from '@codeverse/stream';
import { applyFix, goChapter } from '../chapters';
import { usePlaybackState } from '../scene/useHighlights';
import { clockFor, momentsFor } from '../story/clock';
import { flowsFor } from '../story/flows';
import { impactFacts } from '../story/impact';
import { firstSentence, fmtClock, momentAt } from '../story/moments';
import { BEATS, startStory, story } from '../story/StoryDirector';
import { currentIncident, useStore, type LoadedIncident } from '../store';
import { DiffView } from './DiffView';
import { Icon } from './icons';
import { insets } from './insets';

const card = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -8 }, transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] as const } };

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <span className="eyebrow">{children}</span>;
}

function ExploreCard() {
  const world = useStore((s) => s.world)!;
  const set = useStore((s) => s.set);
  const isMobile = useStore((s) => s.isMobile);
  const flows = flowsFor(world);
  const services = world.semantic?.services.length ?? world.graph.nodes.filter((n) => n.kind === 'service' && !n.isTest).length;
  const hasIncident = world.incidents.length > 0;
  return (
    <motion.div className="stack" style={{ gap: 14 }} {...card}>
      <Eyebrow>Chapter 1 · Explore the system</Eyebrow>
      <div className="stack" style={{ gap: 6 }}>
        <span className="title-2">
          {world.entry.title}: {services} services and {world.graph.project.fileCount} files, drawn from the code.
        </span>
        <span className="body">{isMobile ? 'Tap' : 'Click'} any district, tower, gateway or the glowing core to see what it does.</span>
      </div>
      {flows.length > 0 && (
        <div className="row wrap" style={{ gap: 6 }} role="group" aria-label="Follow a request">
          <span className="caption" style={{ marginRight: 2 }}>
            <Icon.route /> Follow a request:
          </span>
          {flows.map((f) => (
            <button key={f.id} className={`chip ${f.incident ? 'red' : 'cyan'}`} style={{ cursor: 'pointer' }} onClick={() => set({ flow: { id: f.id, step: 0, playing: !useStore.getState().reducedMotion }, selected: undefined })}>
              {f.name}
            </button>
          ))}
        </div>
      )}
      <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
        <button className="btn ghost sm" onClick={() => set({ legendOpen: true })}>
          <Icon.book /> How to read the city
        </button>
        {hasIncident && (
          <button className="btn primary" onClick={() => goChapter('investigate', { autoplay: true })}>
            Watch Bob investigate <Icon.arrow />
          </button>
        )}
      </div>
    </motion.div>
  );
}

function FlowCard() {
  const world = useStore((s) => s.world)!;
  const flow = useStore((s) => s.flow)!;
  const set = useStore((s) => s.set);
  const openCode = useStore((s) => s.openCode);
  const f = flowsFor(world).find((x) => x.id === flow.id);
  if (!f) return null;
  const hop = f.hops[flow.step]!;
  const go = (step: number) => set({ flow: { ...flow, step: Math.max(0, Math.min(f.hops.length - 1, step)), playing: false } });
  const tone = hop.status === 'failed' ? 'var(--red-text)' : hop.status === 'not-reached' ? 'var(--label-3)' : undefined;
  return (
    <motion.div className="stack" style={{ gap: 12 }} {...card} key={f.id}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div className="stack" style={{ gap: 3, minWidth: 0 }}>
          <Eyebrow>Following a request</Eyebrow>
          <span className="title-3">{f.name}</span>
          <span className="caption">{f.origin}</span>
        </div>
        <button className="btn icon sm" aria-label="Stop following this request" onClick={() => set({ flow: undefined })}>
          <Icon.close />
        </button>
      </div>
      <div className="row" style={{ gap: 4 }} aria-hidden>
        {f.hops.map((h, i) => (
          <span key={i} style={{ flex: 1, height: 4, borderRadius: 3, background: i < flow.step ? (h.status === 'failed' ? 'var(--red)' : f.incident ? 'var(--green)' : 'var(--cyan)') : i === flow.step ? '#fff' : 'rgba(255,255,255,0.12)', transition: 'background 300ms' }} />
        ))}
      </div>
      <p className="title-3" style={{ margin: 0, fontWeight: 520, color: tone, minHeight: 42 }} aria-live="polite">
        <span className="tertiary tabular" style={{ marginRight: 8 }}>
          {flow.step + 1}/{f.hops.length}
        </span>
        {hop.sentence}
      </p>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="row" style={{ gap: 6 }}>
          <button className="btn icon" aria-label="Previous hop" disabled={flow.step === 0} onClick={() => go(flow.step - 1)}>
            <Icon.back />
          </button>
          <button className="btn icon" aria-label={flow.playing ? 'Pause' : 'Play'} onClick={() => set({ flow: { ...flow, playing: !flow.playing, step: !flow.playing && flow.step >= f.hops.length - 1 ? 0 : flow.step } })}>
            {flow.playing ? <Icon.pause /> : <Icon.play />}
          </button>
          <button className="btn icon" aria-label="Next hop" disabled={flow.step >= f.hops.length - 1} onClick={() => go(flow.step + 1)}>
            <Icon.fwd />
          </button>
        </div>
        {hop.citation && (
          <button className="btn tinted sm" onClick={() => openCode({ file: hop.citation!.file, line: hop.citation!.line, tone: hop.status === 'failed' ? 'red' : 'yellow', title: hop.via })}>
            <Icon.code /> {hop.citation.file.split('/').pop()}
            {hop.citation.line ? `:${hop.citation.line}` : ''}
          </button>
        )}
      </div>
    </motion.div>
  );
}

function Timeline({ incident }: { incident: LoadedIncident }) {
  const pb = useStore((s) => s.playback);
  const seek = useStore((s) => s.seek);
  const ref = useRef<HTMLDivElement>(null);
  const rec = incident.recording!;
  const clock = clockFor(rec);
  const moments = momentsFor(rec);
  const story = pb?.pace === 'story';
  const total = story ? clock.total : (rec.events.at(-1)?.t ?? 1);
  const pos = (real: number) => (story ? clock.toStory(real) : real) / Math.max(total, 1);
  const now = pb ? pos(pb.time) : 0;
  const seekAt = (clientX: number) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const f = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    seek(story ? clock.toReal(f * total) : f * total);
  };
  return (
    <div
      ref={ref}
      className="timeline"
      role="slider"
      tabIndex={0}
      aria-label="Investigation timeline"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(now * 100)}
      aria-valuetext={`Bob's clock ${fmtClock(pb?.time ?? 0)} of ${fmtClock(rec.result?.stats?.duration_ms ?? rec.events.at(-1)?.t ?? 0)}`}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest('.mark')) return;
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
        seekAt(e.clientX);
      }}
      onPointerMove={(e) => e.buttons === 1 && !(e.target as HTMLElement).closest('.mark') && seekAt(e.clientX)}
      onKeyDown={(e) => {
        const i = moments.findIndex((m) => m.t > (pb?.time ?? 0));
        if (e.key === 'ArrowRight') seek((i < 0 ? moments.at(-1) : moments[i])!.t, false);
        if (e.key === 'ArrowLeft') {
          const prev = [...moments].reverse().find((m) => m.t < (pb?.time ?? 0) - 1);
          seek(prev?.t ?? 0, false);
        }
      }}
    >
      <div className="track">
        <div className="fill" style={{ width: `${now * 100}%` }} />
      </div>
      {moments.map((m) => (
        <button key={m.id} className={`mark ${pos(m.t) <= now + 0.0001 ? 'past' : ''}`} style={{ left: `${pos(m.t) * 100}%` }} aria-label={m.title} title={m.title} onClick={() => seek(m.t, false)} />
      ))}
    </div>
  );
}

function InvestigateCard({ incident }: { incident: LoadedIncident }) {
  const pb = useStore((s) => s.playback);
  const set = useStore((s) => s.set);
  const state = usePlaybackState();
  const rec = incident.recording!;
  const moments = momentsFor(rec);
  const idx = pb ? eventIndexAt(rec, pb.time) : -1;
  const m = momentAt(moments, idx);
  const words = state?.reasoning?.content ? firstSentence(state.reasoning.content, 180) : undefined;
  const total = rec.result?.stats?.duration_ms ?? rec.events.at(-1)?.t ?? 0;
  const ended = pb ? pb.time >= (rec.events.at(-1)?.t ?? 0) : false;
  return (
    <motion.div className="stack" style={{ gap: 12 }} {...card} key="investigate">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <Eyebrow>Chapter 2 · Watch Bob investigate</Eyebrow>
        <span className="caption tabular" title="Bob's real clock in the recorded session">
          Bob's clock {fmtClock(pb?.time ?? 0)} / {fmtClock(total)}
        </span>
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={m?.id ?? 'none'} className="stack" style={{ gap: 8, minHeight: 64 }} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
          <span className="title-2" aria-live="polite">
            {m?.title ?? 'Bob starts with the ticket and the logs, nothing else.'}
          </span>
          {m?.id === 'rootcause' || m?.id === 'blocked' || m?.id === 'done' ? (
            <p className="quote">{m.detail}</p>
          ) : words ? (
            <p className="quote">
              <span className="tertiary">Bob: </span>
              {words}
            </p>
          ) : null}
        </motion.div>
      </AnimatePresence>
      <Timeline incident={incident} />
      <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
        <div className="row" style={{ gap: 6 }}>
          <button
            className="btn icon"
            aria-label={pb?.playing ? 'Pause' : ended ? 'Replay from the start' : 'Play'}
            onClick={() => {
              if (!pb) return;
              if (ended) useStore.getState().startPlayback(rec, { pace: pb.pace, autoplay: true });
              else set({ playback: { ...pb, playing: !pb.playing } });
            }}
          >
            {pb?.playing ? <Icon.pause /> : ended ? <Icon.restart /> : <Icon.play />}
          </button>
          <div className="segmented only-desktop" role="group" aria-label="Pace">
            <button aria-pressed={pb?.pace === 'story'} onClick={() => pb && set({ playback: { ...pb, pace: 'story', storyTime: clockFor(rec).toStory(pb.time) } })} title="Quiet gaps shortened; every event kept, in order">
              Story pace
            </button>
            <button aria-pressed={pb?.pace === 'real'} onClick={() => pb && set({ playback: { ...pb, pace: 'real' } })} title="Bob's real timing">
              Real time
            </button>
          </div>
          <button className="btn ghost sm" onClick={() => set({ eventsOpen: true })}>
            All {rec.events.length} events
          </button>
        </div>
        <button className={`btn ${ended ? 'primary' : ''}`} onClick={() => goChapter('investigate', { moment: 'failure' })}>
          {ended ? 'Replay the failure' : 'Skip to the failure'} <Icon.arrow />
        </button>
      </div>
    </motion.div>
  );
}

function ReplayCard({ incident }: { incident: LoadedIncident }) {
  const progress = useStore((s) => s.pathProgress);
  const steps = incident.investigation.executionPath;
  const cur = steps[Math.max(0, Math.min(steps.length - 1, progress - 1))];
  const failed = cur?.status === 'failed';
  return (
    <motion.div className="stack" style={{ gap: 12 }} {...card} key="replay">
      <Eyebrow>Chapter 2 · The failing request</Eyebrow>
      <span className="title-2">Replaying the request Bob reconstructed</span>
      <ol className="row" style={{ gap: 4, listStyle: 'none', margin: 0, padding: 0 }} aria-label="Request steps">
        {steps.map((s, i) => {
          const shown = i < progress;
          const bg = !shown ? 'rgba(255,255,255,0.12)' : s.status === 'failed' ? 'var(--red)' : s.status === 'not-reached' ? 'rgba(255,255,255,0.28)' : 'var(--green)';
          return <li key={s.id} aria-label={`${s.label}: ${shown ? s.status : 'not yet shown'}`} style={{ flex: 1, height: 4, borderRadius: 3, background: bg, transition: 'background 300ms' }} />;
        })}
      </ol>
      <div className="stack" style={{ gap: 4, minHeight: 58 }} aria-live="polite">
        <span className="title-3" style={{ color: failed ? 'var(--red-text)' : undefined }}>
          {cur ? `${progress}. ${cur.label}${failed ? ` · ${incident.investigation.failure.errorType}` : ''}` : 'Starting…'}
        </span>
        {cur?.note && <span className="body">{cur.note}</span>}
      </div>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn ghost sm" onClick={() => goChapter('investigate', { moment: 'explain' })}>
          Skip <Icon.fwd />
        </button>
      </div>
    </motion.div>
  );
}

function ExplainCard({ incident }: { incident: LoadedIncident }) {
  const set = useStore((s) => s.set);
  const g = incident.grounding;
  const inv = incident.investigation;
  return (
    <motion.div className="stack" style={{ gap: 12 }} {...card} key="explain">
      <Eyebrow>Chapter 2 · Root cause</Eyebrow>
      <span className="title-2">{inv.rootCause.title}</span>
      <div className="row wrap" style={{ gap: 6 }}>
        <span className="chip green">
          <Icon.check /> {g.grounded} of {g.total} claims verified against the code
        </span>
        {g.unverified === 0 && <span className="chip">0 phantoms</span>}
        <span className="chip">{inv.ruledOut.length} hypotheses ruled out</span>
      </div>
      <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
        <div className="row" style={{ gap: 6 }}>
          <button className="btn ghost sm" onClick={() => goChapter('investigate', { autoplay: true })}>
            <Icon.restart /> Watch again
          </button>
          <button className="btn ghost sm only-mobile" onClick={() => set({ sheet: 'rootcause' })}>
            Details
          </button>
        </div>
        <button className="btn primary" onClick={() => goChapter('fixed')}>
          See the fix <Icon.arrow />
        </button>
      </div>
    </motion.div>
  );
}

function FixedCard({ incident }: { incident: LoadedIncident }) {
  const world = useStore((s) => s.world)!;
  const stage = useStore((s) => s.stage);
  const set = useStore((s) => s.set);
  const inv = incident.investigation;
  const f = useMemo(() => impactFacts(world, incident, incident.baseline), [world, incident]);
  const tests = (t?: { passed: number; failed: number }) => (t ? `${t.passed} of ${t.passed + t.failed}` : '?');
  const hunk = inv.fix ? inv.fix.diff.split('\n').filter((l) => !l.startsWith('---') && !l.startsWith('+++')).join('\n') : '';
  if (stage !== 'verified') {
    return (
      <motion.div className="stack" style={{ gap: 12 }} {...card} key="fix">
        <Eyebrow>Chapter 3 · See it fixed</Eyebrow>
        <span className="title-2">Bob's fix: {f.fixLinesChanged === 1 ? 'one line' : `${f.fixLinesChanged ?? 'a few'} lines`} in {inv.fix?.diff.match(/^\+\+\+ b\/(.+)$/m)?.[1]?.split('/').pop() ?? 'the code'}</span>
        {inv.fix && <DiffView diff={hunk} maxHeight={150} />}
        <div className="row wrap" style={{ justifyContent: 'space-between', gap: 8 }}>
          {f.testsBefore ? (
            <span className="chip red" title={`npm run test:demo on ${f.testsBefore.ref}`}>
              Before: {tests(f.testsBefore)} tests pass on {f.testsBefore.ref}
            </span>
          ) : (
            <span />
          )}
          <button className="btn primary" onClick={applyFix} disabled={inv.verification?.status !== 'passed'}>
            <Icon.play /> Apply the fix and replay
          </button>
        </div>
      </motion.div>
    );
  }
  return (
    <motion.div className="stack" style={{ gap: 12 }} {...card} key="verified">
      <Eyebrow>Chapter 3 · Fixed</Eyebrow>
      <span className="title-2">Same request. Now it flows all the way through.</span>
      <div className="row wrap" style={{ gap: 6 }}>
        {f.testsBefore && <span className="chip red">Before: {tests(f.testsBefore)} tests</span>}
        <span className="chip green">
          <Icon.check /> After Bob's fix: {tests(f.testsAfter)} tests pass
        </span>
      </div>
      <div className="row wrap" style={{ justifyContent: 'space-between', gap: 8 }}>
        <div className="row" style={{ gap: 6 }}>
          <button className="btn ghost sm" onClick={startStory}>
            <Icon.restart /> Watch the story again
          </button>
          <button className="btn ghost sm only-mobile" onClick={() => set({ sheet: 'impact' })}>
            The numbers
          </button>
        </div>
        <button className="btn primary" onClick={() => goChapter('explore')}>
          Explore on your own <Icon.arrow />
        </button>
      </div>
    </motion.div>
  );
}

function StoryCard() {
  const st = useStore((s) => s.story)!;
  const world = useStore((s) => s.world)!;
  const incident = useStore(currentIncident)!;
  const pb = useStore((s) => s.playback);
  const progress = useStore((s) => s.pathProgress);
  const stage = useStore((s) => s.stage);
  const beat = BEATS[st.beat]!;
  const last = st.beat === BEATS.length - 1;
  const finished = last && !st.playing && st.elapsed >= (beat.ms as number);
  let frac = 0;
  if (typeof beat.ms === 'number') frac = Math.min(1, st.elapsed / beat.ms);
  else if (beat.ms === 'recording' && pb) frac = pb.pace === 'story' ? pb.storyTime / Math.max(1, clockFor(pb.recording).total) : pb.time / Math.max(1, pb.recording.events.at(-1)?.t ?? 1);
  else if (beat.ms === 'replay') frac = stage === 'explain' ? 1 : progress / Math.max(1, incident.investigation.executionPath.length);
  const caption = beat.caption(world, incident);
  return (
    <motion.div className="stack" style={{ gap: 14 }} {...card} key="story">
      <div className="row" style={{ gap: 4 }} aria-hidden>
        {BEATS.map((b, i) => (
          <span key={b.id} style={{ flex: 1, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.14)', overflow: 'hidden' }}>
            <span style={{ display: 'block', height: '100%', width: `${i < st.beat ? 100 : i === st.beat ? frac * 100 : 0}%`, background: '#fff', borderRadius: 2 }} />
          </span>
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.p key={beat.id + (beat.ms === 'recording' ? caption : '')} className="title-2" style={{ margin: 0, fontWeight: 560, minHeight: 50, lineHeight: 1.35 }} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} aria-live="polite">
          {caption}
        </motion.p>
      </AnimatePresence>
      {beat.id === 'investigate' && pb && (
        <span className="caption tabular">
          Bob's real clock {fmtClock(pb.time)} of {fmtClock(pb.recording.result?.stats?.duration_ms ?? 0)} · replayed at story pace, every event in order
        </span>
      )}
      <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
        <div className="row" style={{ gap: 6 }}>
          <button className="btn icon" aria-label="Previous" onClick={story.prev} disabled={st.beat === 0}>
            <Icon.back />
          </button>
          <button className="btn icon" aria-label={st.playing ? 'Pause the story' : finished ? 'Watch again' : 'Play the story'} onClick={story.toggle}>
            {st.playing ? <Icon.pause /> : finished ? <Icon.restart /> : <Icon.play />}
          </button>
          <button className="btn icon" aria-label="Next" onClick={story.next} disabled={last}>
            <Icon.fwd />
          </button>
          <span className="caption tabular only-desktop" style={{ marginLeft: 4 }}>
            {st.beat + 1} / {BEATS.length}
          </span>
        </div>
        {finished ? (
          <button className="btn primary" onClick={() => goChapter('explore')}>
            Explore on your own <Icon.arrow />
          </button>
        ) : (
          <button className="btn ghost sm" onClick={story.exit}>
            Explore from here
          </button>
        )}
      </div>
    </motion.div>
  );
}

/** One calm card at the bottom: the current chapter's content and its single primary action. */
export function Dock() {
  const intro = useStore((s) => s.introOpen);
  const mode = useStore((s) => s.mode);
  const chapter = useStore((s) => s.chapter);
  const stage = useStore((s) => s.stage);
  const flow = useStore((s) => s.flow);
  const hasStory = useStore((s) => Boolean(s.story));
  const incident = useStore(currentIncident);
  const hidden = useStore((s) => s.isMobile && Boolean(s.selected || s.code || s.sheet || s.eventsOpen));
  const observer = useRef<ResizeObserver | undefined>(undefined);
  // Callback ref: attach one observer when the dock mounts, detach when it unmounts (not on every render).
  const ref = useCallback((el: HTMLElement | null) => {
    observer.current?.disconnect();
    observer.current = undefined;
    if (!el) {
      insets.bottom = 0;
      return;
    }
    const measure = () => {
      const h = Math.round(el.getBoundingClientRect().height);
      insets.bottom = h;
      document.documentElement.style.setProperty('--dock-h', `${h}px`);
    };
    measure();
    if (typeof ResizeObserver !== 'undefined') {
      observer.current = new ResizeObserver(measure);
      observer.current.observe(el);
    }
  }, []);

  if (intro || mode === 'tour') return null;
  let content: React.ReactNode = null;
  if (hasStory) content = <StoryCard />;
  else if (flow) content = <FlowCard />;
  else if (chapter === 'explore' || !incident) content = <ExploreCard />;
  else if (chapter === 'investigate') content = stage === 'investigate' && incident.recording ? <InvestigateCard incident={incident} /> : stage === 'replay' ? <ReplayCard incident={incident} /> : <ExplainCard incident={incident} />;
  else content = <FixedCard incident={incident} />;

  return (
    <section ref={ref} className="glass dock" aria-label="Current chapter" style={{ visibility: hidden ? 'hidden' : undefined }}>
      <AnimatePresence mode="wait">{content}</AnimatePresence>
    </section>
  );
}
