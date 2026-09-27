import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { citationStatus, formatCitation, type GroundingReport } from '@codeverse/grounding';
import type { Citation } from '@codeverse/schema';
import { duration } from '@codeverse/stream';
import { currentIncident, useStore, type IncidentStage, type LoadedIncident } from '../store';
import { DiffView } from './DiffView';
import { GroundingRing } from './GroundingRing';
import { Icon } from './icons';

const STAGES: Array<{ id: IncidentStage; label: string }> = [
  { id: 'investigate', label: 'Investigate' },
  { id: 'replay', label: 'Replay' },
  { id: 'explain', label: 'Explain' },
  { id: 'fix', label: 'Fix' },
  { id: 'verified', label: 'Verify' },
];

/** Moves the incident through its stages: recording → path replay → explanation. */
export function IncidentDirector() {
  const mode = useStore((s) => s.mode);
  const stage = useStore((s) => s.stage);
  const incident = useStore(currentIncident);
  const done = useStore((s) => (s.playback ? s.playback.time >= duration(s.playback.recording) && !s.playback.live : false));
  const progress = useStore((s) => s.pathProgress);
  const set = useStore((s) => s.set);
  const reducedMotion = useStore((s) => s.reducedMotion);
  const steps = incident?.investigation.executionPath ?? [];
  const failIdx = steps.findIndex((s) => s.status === 'failed');
  const stopAt = failIdx >= 0 ? failIdx + 1 : steps.length;

  useEffect(() => {
    if (mode !== 'incident' || stage !== 'investigate' || !done) return;
    const t = setTimeout(() => set({ stage: 'replay', pathProgress: 0 }), reducedMotion ? 0 : 1400);
    return () => clearTimeout(t);
  }, [mode, stage, done, set, reducedMotion]);

  useEffect(() => {
    if (mode !== 'incident' || stage !== 'replay') return;
    if (progress === 1) useStore.getState().flyTo(steps[Math.min(steps.length - 1, Math.max(0, stopAt - 1))]!.file, 40, false);
    if (progress >= stopAt) {
      if (failIdx >= 0) useStore.getState().flyTo(steps[failIdx]!.file, 26, false);
      const t = setTimeout(() => set({ stage: 'explain' }), reducedMotion ? 0 : 1600);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => set({ pathProgress: progress + 1 }), reducedMotion ? 0 : progress === 0 ? 300 : 900);
    return () => clearTimeout(t);
  }, [mode, stage, progress, stopAt, set, reducedMotion, steps, failIdx]);
  return null;
}

function CitationLink({ c, report, tone }: { c: Citation; report: GroundingReport; tone?: 'red' | 'yellow' }) {
  const openCode = useStore((s) => s.openCode);
  const status = citationStatus(report, c);
  const icon = status === 'grounded' ? '✓' : status === 'weak' ? '~' : '⚠';
  const color = status === 'grounded' ? 'var(--green)' : status === 'weak' ? 'var(--yellow)' : 'var(--orange)';
  const claim = report.claims.find((x) => x.citation === c || (x.citation?.file === c.file && x.citation?.line === c.line && x.citation?.symbol === c.symbol));
  return (
    <button
      className="list-item"
      style={{ padding: '5px 8px', gap: 8 }}
      title={claim?.reason}
      onClick={() => (status === 'unverified' && !claim?.nodes.length ? undefined : openCode({ file: c.file, line: c.line, endLine: c.endLine, tone, title: c.symbol }))}
      aria-label={`${formatCitation(c)}, ${status ?? 'unchecked'}`}
    >
      <span style={{ color, fontWeight: 700, width: 14, textAlign: 'center' }}>{icon}</span>
      <span className="mono truncate grow" style={{ fontSize: 11.5 }}>
        {formatCitation(c).replace(/^demo\/shopfloor\//, '')}
      </span>
      {status === 'unverified' && <span className="chip orange">phantom</span>}
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="stack" style={{ gap: 6 }}>
      <span className="eyebrow">{title}</span>
      {children}
    </section>
  );
}

function Body({ incident }: { incident: LoadedIncident }) {
  const stage = useStore((s) => s.stage);
  const set = useStore((s) => s.set);
  const healed = useStore((s) => s.healed);
  const flyTo = useStore((s) => s.flyTo);
  const inv = incident.investigation;
  const report = incident.grounding;
  const verification = inv.verification;
  const canVerify = verification?.status === 'passed';
  const failStep = inv.executionPath.find((s) => s.id === inv.failure.stepId);

  if (stage === 'investigate') {
    return (
      <div className="stack" style={{ gap: 12 }}>
        <p className="secondary" style={{ margin: 0 }}>
          {incident.recording ? 'Watch IBM Bob investigate. Probes show which files Bob and its subagents read; rings show search hits.' : 'This investigation came from the Bob IDE and has no stream recording. Skip ahead to the replay.'}
        </p>
        <button className="btn tinted" onClick={() => set({ stage: 'replay', pathProgress: 0, playback: undefined })}>
          Skip to failure replay
        </button>
      </div>
    );
  }
  if (stage === 'replay') {
    return (
      <div className="stack" style={{ gap: 8 }}>
        <p className="secondary" style={{ margin: 0 }}>
          Replaying the request path Bob reconstructed…
        </p>
        <PathList incident={incident} />
      </div>
    );
  }
  return (
    <div className="stack" style={{ gap: 16 }}>
      <GroundingRing report={report} size={58} />
      <Section title="Root cause">
        <div className="title-3" style={{ lineHeight: 1.3 }}>
          {inv.rootCause.title}
        </div>
        <p className="secondary" style={{ margin: 0, lineHeight: 1.5 }}>
          {inv.rootCause.explanation}
        </p>
        <div className="stack">
          {inv.rootCause.citations.map((c, i) => (
            <CitationLink key={i} c={c} report={report} tone="yellow" />
          ))}
        </div>
      </Section>
      <Section title="Failure point">
        <div className="row" style={{ gap: 8 }}>
          <span className="chip red">{inv.failure.errorType}</span>
          {failStep && (
            <button className="btn" style={{ height: 24, fontSize: 11 }} onClick={() => flyTo(failStep.file, 14)}>
              {failStep.label}
            </button>
          )}
        </div>
        <code className="mono secondary" style={{ fontSize: 11.5, whiteSpace: 'pre-wrap' }}>
          {inv.failure.message}
        </code>
        {inv.failure.citations.map((c, i) => (
          <CitationLink key={i} c={c} report={report} tone="red" />
        ))}
      </Section>
      <Section title="Path">
        <PathList incident={incident} />
      </Section>
      {inv.ruledOut.length > 0 && (
        <Section title="Ruled out">
          {inv.ruledOut.map((r, i) => (
            <div key={i} className="stack" style={{ gap: 2, padding: '4px 0' }}>
              <span className="headline" style={{ textDecoration: 'line-through', textDecorationColor: 'rgba(255,255,255,0.35)', color: 'var(--label-2)' }}>
                {r.hypothesis}
              </span>
              <span className="caption">{r.reason}</span>
              {r.citations.map((c, j) => (
                <CitationLink key={j} c={c} report={report} />
              ))}
            </div>
          ))}
        </Section>
      )}
      {inv.evidence.length > 0 && (
        <Section title="Evidence">
          {inv.evidence.map((e, i) => (
            <div key={i} className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
              <span className="chip" style={{ flex: 'none' }}>
                {e.kind}
              </span>
              <span className="mono caption" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {e.text}
              </span>
            </div>
          ))}
        </Section>
      )}
      {inv.fix && (
        <Section title="Proposed fix">
          {stage === 'explain' ? (
            <button className="btn primary" onClick={() => set({ stage: 'fix' })}>
              <Icon.sparkle /> Show Bob’s fix
            </button>
          ) : (
            <>
              <p className="secondary" style={{ margin: 0 }}>
                {inv.fix.summary}
              </p>
              <DiffView diff={inv.fix.diff} />
              <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                {canVerify ? (
                  <button className="btn primary" onClick={() => {
                      set({ stage: 'verified', healed: true });
                      const mid = inv.executionPath[Math.floor(inv.executionPath.length / 2)];
                      if (mid) useStore.getState().flyTo(mid.file, 48, false);
                    }} disabled={healed}>
                    <Icon.check /> {healed ? 'Fix verified' : 'Replay with fix applied'}
                  </button>
                ) : (
                  <span className="chip orange" title="Verification comes from a real test run after the fix is applied">
                    Verification pending
                  </span>
                )}
                {verification?.status === 'passed' && (
                  <span className="chip green">
                    <Icon.check /> {verification.testsPassed ?? '?'} passed · {verification.testsFailed ?? 0} failed
                  </span>
                )}
              </div>
            </>
          )}
        </Section>
      )}
    </div>
  );
}

function PathList({ incident }: { incident: LoadedIncident }) {
  const progress = useStore((s) => s.pathProgress);
  const stage = useStore((s) => s.stage);
  const healed = useStore((s) => s.healed);
  const openCode = useStore((s) => s.openCode);
  const steps = incident.investigation.executionPath;
  const shown = stage === 'replay' ? progress : steps.length;
  return (
    <ol className="stack" style={{ listStyle: 'none', margin: 0, padding: 0, gap: 2 }}>
      {steps.map((s, i) => {
        const visible = i < shown;
        const failed = s.status === 'failed' && !healed;
        const color = !visible ? 'var(--label-3)' : failed ? '#ff6961' : s.status === 'not-reached' && !healed ? 'var(--label-3)' : 'var(--green)';
        return (
          <motion.li key={s.id} initial={false} animate={{ opacity: visible ? 1 : 0.35 }}>
            <button className="list-item" style={{ padding: '4px 8px' }} onClick={() => openCode({ file: s.file, line: s.line, tone: failed ? 'red' : 'yellow', title: s.symbol })}>
              <span style={{ color, width: 16, textAlign: 'center', fontWeight: 700 }}>{!visible ? '○' : failed ? '✕' : s.status === 'not-reached' && !healed ? '·' : '✓'}</span>
              <span className="headline" style={{ flex: '0 0 120px', minWidth: 0, overflowWrap: 'anywhere' }}>
                {s.label}
              </span>
              <span className="caption truncate grow">{failed ? (s.note ?? incident.investigation.failure.message) : s.symbol && s.symbol !== s.label ? s.symbol : s.file.split('/').pop()}</span>
            </button>
          </motion.li>
        );
      })}
    </ol>
  );
}

export function IncidentPanel() {
  const mode = useStore((s) => s.mode);
  const stage = useStore((s) => s.stage);
  const incident = useStore(currentIncident);
  const code = useStore((s) => s.code);
  const set = useStore((s) => s.set);
  const startPlayback = useStore((s) => s.startPlayback);
  if (mode !== 'incident') return null;
  const restart = () => {
    set({ stage: 'investigate', pathProgress: 0, healed: false, code: undefined });
    if (incident?.recording) startPlayback(incident.recording);
    else set({ stage: 'replay' });
  };
  return (
    <AnimatePresence>
      {!code && (
        <motion.aside
          key="incident"
          className="glass"
          aria-label="Incident replay"
          initial={{ x: 40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 40, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 30 }}
          style={{ position: 'fixed', right: 16, top: 72, width: 'min(400px, calc(100vw - 32px))', maxHeight: stage === 'investigate' ? 'calc(100vh - 360px)' : 'calc(100vh - 88px)', zIndex: 25, display: 'flex', flexDirection: 'column' }}
        >
          {!incident ? (
            <div style={{ padding: 18 }} className="stack">
              <span className="title-3">No incidents in this world</span>
              <span className="caption">Run /codeverse-investigate in Bob IDE to create one.</span>
            </div>
          ) : (
            <>
              <header className="stack" style={{ padding: '14px 16px 10px', gap: 8, borderBottom: '1px solid var(--separator)' }}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="eyebrow">Incident</span>
                  <button className="btn" style={{ height: 24, fontSize: 11 }} onClick={restart}>
                    <Icon.restart /> Restart
                  </button>
                </div>
                <div className="title-2">“{incident.investigation.symptom}”</div>
                <div className="row" role="list" aria-label="Stages" style={{ gap: 4 }}>
                  {STAGES.map((s, i) => {
                    const cur = STAGES.findIndex((x) => x.id === stage);
                    return (
                      <div key={s.id} role="listitem" className="stack" style={{ flex: 1, gap: 4 }} aria-current={s.id === stage ? 'step' : undefined}>
                        <div style={{ height: 3, borderRadius: 2, background: i <= cur ? (i === 4 ? 'var(--green)' : 'var(--cyan)') : 'rgba(255,255,255,0.12)', transition: 'background 300ms' }} />
                        <span className="caption" style={{ fontSize: 10, color: i === cur ? 'var(--label)' : undefined }}>
                          {s.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </header>
              <div className="scroll" style={{ padding: 16, flex: 1 }}>
                <Body incident={incident} />
              </div>
            </>
          )}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
