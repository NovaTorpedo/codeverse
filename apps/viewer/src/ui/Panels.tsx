import { useMemo, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { citationStatus, formatCitation, type GroundingReport } from '@codeverse/grounding';
import type { Citation } from '@codeverse/schema';
import { explainNode, type Explanation } from '../story/explain';
import { impactFacts } from '../story/impact';
import { fmtClock } from '../story/moments';
import { logSignals, ticketOf } from '../story/ticket';
import { currentIncident, useStore, type LoadedIncident } from '../store';
import { GroundingRing } from './GroundingRing';
import { Icon } from './icons';

const slide = { initial: { x: 36, opacity: 0 }, animate: { x: 0, opacity: 1 }, exit: { x: 36, opacity: 0 }, transition: { type: 'spring' as const, stiffness: 300, damping: 32 } };

export function CitationLink({ c, report, tone }: { c: Citation; report: GroundingReport; tone?: 'red' | 'yellow' }) {
  const openCode = useStore((s) => s.openCode);
  const status = citationStatus(report, c);
  const icon = status === 'grounded' ? '✓' : status === 'weak' ? '~' : '⚠';
  const color = status === 'grounded' ? 'var(--green)' : status === 'weak' ? 'var(--yellow)' : 'var(--orange)';
  const claim = report.claims.find((x) => x.citation === c || (x.citation?.file === c.file && x.citation?.line === c.line && x.citation?.symbol === c.symbol));
  const opens = !(status === 'unverified' && !claim?.nodes.length);
  return (
    <button
      className="list-item"
      style={{ padding: '6px 8px', gap: 8 }}
      title={claim?.reason}
      onClick={() => opens && openCode({ file: c.file, line: c.line, endLine: c.endLine, tone, title: c.symbol })}
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

function PanelShell({ label, eyebrow, title, subtitle, onClose, children, k }: { label: string; eyebrow: string; title: React.ReactNode; subtitle?: React.ReactNode; onClose?: () => void; children: React.ReactNode; k: string }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  return (
    <motion.aside key={k} className="glass thick panel" aria-label={label} {...slide}>
      <div className="sheet-handle" />
      <header>
        <div className="stack grow" style={{ gap: 4, minWidth: 0 }}>
          <span className="eyebrow">{eyebrow}</span>
          <span className="title-2" style={{ overflowWrap: 'anywhere' }}>
            {title}
          </span>
          {subtitle && <span className="caption">{subtitle}</span>}
        </div>
        {onClose && (
          <button ref={closeRef} className="btn icon sm" aria-label={`Close ${label}`} onClick={onClose}>
            <Icon.close />
          </button>
        )}
      </header>
      <div className="scroll stack" style={{ gap: 18 }}>
        {children}
      </div>
    </motion.aside>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="stack" style={{ gap: 8 }}>
      <span className="eyebrow">{title}</span>
      {children}
    </section>
  );
}

const SOURCE: Record<string, string> = { 'bob-scan': "From Bob's scan of the code", 'bob-tour': "From Bob's guided tour", 'bob-investigation': "From Bob's investigation", analyzer: 'From the static analyzer' };
const KIND: Record<Explanation['kind'], string> = { district: 'Service district', file: 'File', route: 'API route', datastore: 'Datastore' };

/** Click anything, understand it: plain language first, then connections, then the code. */
export function Inspector() {
  const world = useStore((s) => s.world);
  const selected = useStore((s) => s.selected);
  const select = useStore((s) => s.select);
  const flyTo = useStore((s) => s.flyTo);
  const openCode = useStore((s) => s.openCode);
  const e = useMemo(() => (world && selected ? explainNode(world, selected) : undefined), [world, selected]);
  return (
    <AnimatePresence mode="wait">
      {e && (
        <PanelShell k={`inspect:${e.id}`} label="Details" eyebrow={KIND[e.kind]} title={e.title} subtitle={e.subtitle} onClose={() => select(undefined)}>
          {e.summary && (
            <div className="stack" style={{ gap: 6 }}>
              <p className="body" style={{ margin: 0, color: 'var(--label)' }}>
                {e.summary.text}
              </p>
              <span className="caption">
                {SOURCE[e.summary.source]}
                {e.summary.verified && (
                  <span style={{ color: 'var(--green)', marginLeft: 6 }}>
                    <Icon.check /> citations verified
                  </span>
                )}
              </span>
            </div>
          )}
          {e.incident && (
            <div className="stack" style={{ gap: 6, padding: 12, borderRadius: 14, background: e.incident.failed ? 'rgba(255,69,58,0.1)' : 'rgba(255,255,255,0.04)', boxShadow: `0 0 0 0.5px ${e.incident.failed ? 'rgba(255,69,58,0.4)' : 'rgba(255,255,255,0.08)'} inset` }}>
              <span className="eyebrow" style={{ color: e.incident.failed ? 'var(--red-text)' : undefined }}>
                In the incident · {e.incident.label}
              </span>
              <span className="body" style={{ color: 'var(--label)' }}>
                {e.incident.note}
              </span>
              <span className="caption">{SOURCE['bob-investigation']}</span>
            </div>
          )}
          {e.facts.length > 0 && (
            <ul className="stack caption" style={{ margin: 0, paddingLeft: 16, gap: 4 }}>
              {e.facts.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          )}
          <div className="row wrap" style={{ gap: 8 }}>
            {e.code && (
              <button className="btn tinted" onClick={() => openCode({ file: e.code!.file, line: e.code!.line, title: e.code!.title })}>
                <Icon.code /> Show the code
              </button>
            )}
            <button className="btn" onClick={() => flyTo(e.id, e.kind === 'district' ? 26 : undefined)}>
              Fly there
            </button>
          </div>
          {e.links.length > 0 && (
            <Section title="Talks to">
              <div className="row wrap" style={{ gap: 6 }}>
                {e.links.slice(0, 16).map((l) => (
                  <button key={`${l.dir}:${l.id}`} className="chip" style={{ cursor: 'pointer' }} onClick={() => flyTo(l.id, l.id.startsWith('svc:') ? 26 : undefined)} title={`${l.dir === 'out' ? 'Uses' : 'Used by'} ${l.name} (${l.kind})`}>
                    <span style={{ color: l.dir === 'out' ? 'var(--cyan)' : 'var(--amber)' }}>{l.dir === 'out' ? '→' : '←'}</span>
                    {l.name}
                  </button>
                ))}
              </div>
              <span className="caption">→ it uses · ← it is used by. Links come from imports and calls the analyzer can prove.</span>
            </Section>
          )}
          {e.files && e.files.length > 0 && (
            <Section title="Files">
              <div className="stack">
                {e.files.map((f) => (
                  <button key={f.id} className="list-item" onClick={() => flyTo(f.id)}>
                    <span className="grow truncate">{f.label}</span>
                    <span className="caption tabular">{f.loc} lines</span>
                  </button>
                ))}
              </div>
            </Section>
          )}
        </PanelShell>
      )}
    </AnimatePresence>
  );
}

function RootCauseBody({ incident }: { incident: LoadedIncident }) {
  const flyTo = useStore((s) => s.flyTo);
  const inv = incident.investigation;
  const report = incident.grounding;
  const failStep = inv.executionPath.find((s) => s.id === inv.failure.stepId);
  const [lead, ...rest] = inv.rootCause.explanation.split(/(?<=[.!?])\s+/);
  return (
    <>
      <div className="stack" style={{ gap: 8 }}>
        <GroundingRing report={report} size={56} />
        <span className="caption">Every file, line, symbol and call Bob cites is checked against a deterministic map of the code. A claim that doesn't match would appear as a flickering phantom.</span>
      </div>
      <Section title="Root cause">
        <p className="body" style={{ margin: 0, color: 'var(--label)' }}>
          {lead}
        </p>
        {rest.length > 0 && (
          <details>
            <summary className="caption" style={{ color: 'var(--cyan)' }}>
              <span className="chev">›</span> Bob's full explanation
            </summary>
            <p className="body" style={{ margin: '8px 0 0' }}>
              {rest.join(' ')}
            </p>
          </details>
        )}
        <div className="stack">
          {inv.rootCause.citations.map((c, i) => (
            <CitationLink key={i} c={c} report={report} tone="yellow" />
          ))}
        </div>
      </Section>
      <Section title="Where it breaks">
        <div className="row wrap" style={{ gap: 8 }}>
          <span className="chip red">{inv.failure.errorType}</span>
          {failStep && (
            <button className="btn sm" onClick={() => flyTo(failStep.file, 30, false)}>
              {failStep.label}
            </button>
          )}
        </div>
        <code className="mono secondary" style={{ whiteSpace: 'pre-wrap' }}>
          {inv.failure.message}
        </code>
        {inv.failure.citations.map((c, i) => (
          <CitationLink key={i} c={c} report={report} tone="red" />
        ))}
      </Section>
      {inv.ruledOut.length > 0 && (
        <Section title={`Ruled out (${inv.ruledOut.length})`}>
          {inv.ruledOut.map((r, i) => (
            <details key={i} className="stack">
              <summary className="row" style={{ alignItems: 'flex-start', gap: 8 }}>
                <span className="chev tertiary">›</span>
                <span className="headline" style={{ textDecoration: 'line-through', textDecorationColor: 'rgba(255,255,255,0.35)', color: 'var(--label-2)' }}>
                  {r.hypothesis}
                </span>
              </summary>
              <div className="stack" style={{ gap: 4, padding: '6px 0 0 18px' }}>
                <span className="caption" style={{ lineHeight: 1.5 }}>
                  {r.reason}
                </span>
                {r.citations.map((c, j) => (
                  <CitationLink key={j} c={c} report={report} />
                ))}
              </div>
            </details>
          ))}
        </Section>
      )}
      {inv.evidence.length > 0 && (
        <details>
          <summary className="eyebrow">
            <span className="chev">›</span> Evidence Bob used ({inv.evidence.length})
          </summary>
          <div className="stack" style={{ gap: 8, marginTop: 10 }}>
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
          </div>
        </details>
      )}
    </>
  );
}

function ImpactBody({ incident }: { incident: LoadedIncident }) {
  const world = useStore((s) => s.world)!;
  const f = useMemo(() => impactFacts(world, incident, incident.baseline), [world, incident]);
  const pct = Math.round(f.grounding.score * 100);
  const tiles: Array<{ v: string; k: string } | undefined> = [
    f.rootCauseAtMs !== undefined ? { v: fmtClock(f.rootCauseAtMs), k: `into Bob's run when it named the root cause${f.runMs ? ` (the full ${fmtClock(f.runMs)} run includes blocked attempts to save its report)` : ''}` } : undefined,
    f.filesBobRead !== undefined ? { v: `${f.filesBobRead} of ${f.filesInCodebase}`, k: `files Bob read itself${f.subagents ? `, plus ${f.subagents} subagents in parallel` : ''}` } : undefined,
    { v: String(f.hypothesesRuledOut), k: 'hypotheses ruled out with evidence, including the three warnings in the ticket' },
    { v: `${pct}%`, k: `of Bob's claims verified against the code (${f.grounding.grounded} of ${f.grounding.total}, ${f.grounding.unverified} phantoms)` },
    f.fixLinesChanged !== undefined ? { v: f.fixLinesChanged === 1 ? '1 line' : `${f.fixLinesChanged} lines`, k: "in Bob's proposed fix" } : undefined,
    f.testsAfter ? { v: `${f.testsBefore ? `${f.testsBefore.passed}/${f.testsBefore.passed + f.testsBefore.failed} → ` : ''}${f.testsAfter.passed}/${f.testsAfter.passed + f.testsAfter.failed}`, k: `demo tests passing${f.testsBefore ? ` (${f.testsBefore.ref} → Bob's fix branch)` : ''}` } : undefined,
    f.toolCalls !== undefined ? { v: String(f.toolCalls), k: 'tool calls in the recorded session' } : undefined,
    f.bobcoins !== undefined ? { v: f.bobcoins.toFixed(2), k: 'Bobcoins for the recorded session' } : undefined,
  ];
  return (
    <>
      <div className="stat-grid">
        {tiles.filter(Boolean).map((t) => (
          <div key={t!.k} className="stat">
            <span className="v">{t!.v}</span>
            <span className="k">{t!.k}</span>
          </div>
        ))}
      </div>
      <p className="caption" style={{ margin: 0, lineHeight: 1.55 }}>
        Every number comes from Bob's recorded session (its result event and stream), the grounding check, or real test runs. One incident on a sample app: a measurement, not a benchmark.
      </p>
    </>
  );
}

/** The right-hand panel for the current chapter when nothing is selected (desktop), or the open sheet (phones). */
export function ChapterPanel() {
  const chapter = useStore((s) => s.chapter);
  const mode = useStore((s) => s.mode);
  const stage = useStore((s) => s.stage);
  const selected = useStore((s) => s.selected);
  const isMobile = useStore((s) => s.isMobile);
  const sheet = useStore((s) => s.sheet);
  const story = useStore((s) => s.story);
  const set = useStore((s) => s.set);
  const incident = useStore(currentIncident);
  if (!incident || selected || mode !== 'incident') return null;
  const wantRoot = chapter === 'investigate' && stage === 'explain';
  const wantImpact = chapter === 'fixed' && stage === 'verified';
  const show = isMobile ? (sheet === 'rootcause' && wantRoot ? 'root' : sheet === 'impact' && wantImpact ? 'impact' : undefined) : wantRoot && (!story || story.beat >= 5) ? 'root' : wantImpact ? 'impact' : undefined;
  const close = isMobile ? () => set({ sheet: undefined }) : undefined;
  return (
    <AnimatePresence mode="wait">
      {show === 'root' && (
        <PanelShell k="root" label="Root cause details" eyebrow="Why it fails" title="Bob's diagnosis, checked" onClose={close}>
          <RootCauseBody incident={incident} />
        </PanelShell>
      )}
      {show === 'impact' && (
        <PanelShell k="impact" label="Impact" eyebrow="What Bob did" title="In real numbers" onClose={close}>
          <ImpactBody incident={incident} />
        </PanelShell>
      )}
    </AnimatePresence>
  );
}

/** The incident ticket, as the on-call engineer received it (desktop, chapter 2). */
export function TicketCard() {
  const world = useStore((s) => s.world);
  const chapter = useStore((s) => s.chapter);
  const stage = useStore((s) => s.stage);
  const selected = useStore((s) => s.selected);
  const intro = useStore((s) => s.introOpen);
  const openCode = useStore((s) => s.openCode);
  const ticket = useMemo(() => (world ? ticketOf(world) : undefined), [world]);
  const logs = useMemo(() => (world ? logSignals(world) : undefined), [world]);
  const show = !intro && chapter === 'investigate' && (stage === 'investigate' || stage === 'replay') && ticket;
  return (
    <AnimatePresence>
      {show && (
        <motion.aside key="ticket" className="glass panel-float" aria-label="Incident ticket" initial={{ x: -24, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -24, opacity: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 32 }} style={{ padding: 16, opacity: selected ? 0.5 : 1 }}>
          <div className="stack" style={{ gap: 10 }}>
            <div className="row" style={{ gap: 8 }}>
              <span className="chip red">
                <span className="dot" /> {ticket.id}
              </span>
              {ticket.severity && <span className="caption">{ticket.severity}</span>}
              {ticket.opened && <span className="caption tertiary">· {ticket.opened}</span>}
            </div>
            <span className="title-3">{ticket.title}</span>
            {logs && logs.signals.length > 0 && (
              <div className="stack" style={{ gap: 6 }}>
                <span className="eyebrow">In the logs</span>
                <div className="row wrap" style={{ gap: 5 }}>
                  {logs.signals.map((s) => (
                    <button key={`${s.level}:${s.event}`} className={`chip ${s.level === 'error' ? 'red' : 'orange'}`} style={{ cursor: 'pointer', fontFamily: 'var(--mono)', fontWeight: 500, fontSize: 10.5 }} onClick={() => openCode({ file: logs.file, line: s.line, tone: s.level === 'error' ? 'red' : 'yellow', title: s.event })}>
                      {s.event}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <button className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => openCode({ file: ticket.file, title: ticket.id })}>
              Read the ticket
            </button>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
