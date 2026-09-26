import { useMemo, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { citationStatus } from '@codeverse/grounding';
import { useStore } from '../store';
import { GroundingRing } from './GroundingRing';
import { Icon } from './icons';

function Card({ children, k }: { children: React.ReactNode; k: string }) {
  return (
    <motion.aside
      key={k}
      className="glass"
      initial={{ x: -30, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -30, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 280, damping: 30 }}
      style={{ position: 'fixed', left: 16, top: 72, width: 'min(330px, calc(100vw - 32px))', maxHeight: 'calc(100vh - 290px)', zIndex: 25, display: 'flex', flexDirection: 'column' }}
    >
      <div className="scroll" style={{ padding: 16 }}>
        {children}
      </div>
    </motion.aside>
  );
}

function WorldOverview({ onFile }: { onFile: () => void }) {
  const world = useStore((s) => s.world)!;
  const flyTo = useStore((s) => s.flyTo);
  const set = useStore((s) => s.set);
  const { graph, semantic, semanticGrounding } = world;
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const n of graph.nodes) c[n.kind] = (c[n.kind] ?? 0) + 1;
    return c;
  }, [graph]);
  const services = graph.nodes.filter((n) => n.kind === 'service').sort((a, b) => b.loc - a.loc);
  const semById = new Map(semantic?.services.map((s) => [s.id, s]) ?? []);
  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="stack" style={{ gap: 4 }}>
        <span className="eyebrow">World</span>
        <span className="title-2">{world.entry.title}</span>
        <span className="caption">{world.entry.description}</span>
      </div>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
        <span className="chip cyan">{graph.project.fileCount} files</span>
        <span className="chip">{graph.project.loc.toLocaleString()} loc</span>
        <span className="chip">{counts.service ?? 0} districts</span>
        {counts.route ? <span className="chip">{counts.route} routes</span> : null}
        {counts.database ? <span className="chip">{counts.database} datastore</span> : null}
        <span className="chip">{graph.edges.length} links</span>
      </div>
      {semantic && semanticGrounding ? (
        <div className="stack" style={{ gap: 8 }}>
          <div className="divider" />
          <span className="eyebrow">Bob’s map of this codebase {semantic.synthetic && <span className="chip orange" style={{ marginLeft: 6 }}>synthetic</span>}</span>
          <GroundingRing report={semanticGrounding} size={48} />
          <p className="secondary" style={{ margin: 0, lineHeight: 1.5 }}>
            {semantic.summary}
          </p>
        </div>
      ) : (
        <p className="caption" style={{ margin: 0 }}>
          The city is drawn from static analysis only. Run /codeverse-scan in Bob IDE to add Bob’s semantic layer.
        </p>
      )}
      <div className="stack" style={{ gap: 2 }}>
        <div className="divider" />
        <span className="eyebrow" style={{ marginBottom: 4 }}>
          Districts
        </span>
        {services.map((s) => {
          const sem = semById.get(s.id);
          return (
            <button key={s.id} className="list-item" onClick={() => flyTo(s.id, 22)} title={sem?.responsibility}>
              <span className="stack grow" style={{ minWidth: 0 }}>
                <span className="headline truncate">{sem?.name ?? s.label}</span>
                {sem && <span className="caption truncate">{sem.responsibility}</span>}
              </span>
              <span className="caption tabular">{s.loc}</span>
            </button>
          );
        })}
      </div>
      <div className="divider" />
      <button className="btn" onClick={onFile}>
        <Icon.upload /> Open a graph or recording JSON
      </button>
      <span className="caption" style={{ marginTop: -8 }}>
        Parsed and validated in your browser. Nothing is uploaded.
      </span>
      {world.incidents.length > 0 && (
        <button className="btn primary lg" onClick={() => set({ mode: 'incident' })}>
          <Icon.bolt /> Replay incident: {world.incidents[0]!.title}
        </button>
      )}
    </div>
  );
}

function NodeInspector({ id }: { id: string }) {
  const world = useStore((s) => s.world)!;
  const select = useStore((s) => s.select);
  const openCode = useStore((s) => s.openCode);
  const flyTo = useStore((s) => s.flyTo);
  const node = world.graph.nodes.find((n) => n.id === id);
  const semantic = world.semantic?.services.find((s) => s.id === id || s.id === node?.service);
  if (!node) return null;
  const out = world.graph.edges.filter((e) => e.source === id);
  const inc = world.graph.edges.filter((e) => e.target === id);
  const short = (x: string) => x.split('/').pop()!.replace(/^svc:/, '');
  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div className="stack" style={{ gap: 3, minWidth: 0 }}>
          <span className="eyebrow">{node.kind === 'file' ? (node.isTest ? 'test file' : 'module') : node.kind}</span>
          <span className="title-2" style={{ wordBreak: 'break-all' }}>
            {node.label}
          </span>
          {node.path && <span className="caption mono" style={{ wordBreak: 'break-all' }}>{node.path}</span>}
        </div>
        <button className="btn icon" aria-label="Close inspector" onClick={() => select(undefined)}>
          <Icon.close />
        </button>
      </div>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
        {node.loc > 0 && <span className="chip cyan">{node.loc} loc</span>}
        <button className="chip" style={{ border: 0 }} onClick={() => flyTo(node.service, 22)}>
          district · {semantic?.name ?? node.service.replace(/^svc:/, '')}
        </button>
        {node.isEntry && <span className="chip green">entry point</span>}
      </div>
      {semantic && (
        <div className="stack" style={{ gap: 4 }}>
          <span className="eyebrow">Bob says</span>
          <p className="secondary" style={{ margin: 0 }}>
            {semantic.responsibility}
          </p>
          {world.semanticGrounding && semantic.citations.slice(0, 2).map((c, i) => {
            const st = citationStatus(world.semanticGrounding!, c);
            return (
              <span key={i} className="caption mono" style={{ color: st === 'grounded' ? 'var(--green)' : 'var(--orange)' }}>
                {st === 'grounded' ? '✓' : '⚠'} {c.file.split('/').pop()}
                {c.line ? `:${c.line}` : ''}
              </span>
            );
          })}
        </div>
      )}
      {node.path && node.kind === 'file' && (
        <button className="btn tinted" onClick={() => openCode({ file: node.path! })}>
          <Icon.file /> View source
        </button>
      )}
      {node.symbols.length > 0 && (
        <div className="stack">
          <span className="eyebrow" style={{ marginBottom: 4 }}>
            Symbols
          </span>
          {node.symbols.slice(0, 40).map((s) => (
            <button key={`${s.name}:${s.line}`} className="list-item" style={{ padding: '4px 8px' }} onClick={() => openCode({ file: node.path!, line: s.line, endLine: s.endLine, title: s.name })}>
              <span className="chip" style={{ width: 58, justifyContent: 'center', fontSize: 10 }}>
                {s.kind}
              </span>
              <span className="mono truncate grow" style={{ fontSize: 11.5, opacity: s.exported ? 1 : 0.65 }}>
                {s.name}
              </span>
              <span className="caption tabular">{s.line}</span>
            </button>
          ))}
        </div>
      )}
      {(out.length > 0 || inc.length > 0) && (
        <div className="stack" style={{ gap: 2 }}>
          <span className="eyebrow" style={{ marginBottom: 4 }}>
            Connections
          </span>
          {[...out.map((e) => ({ e, dir: '→', other: e.target })), ...inc.map((e) => ({ e, dir: '←', other: e.source }))].slice(0, 30).map(({ e, dir, other }) => (
            <button key={e.id + dir} className="list-item" style={{ padding: '4px 8px' }} onClick={() => flyTo(other)}>
              <span style={{ width: 14, color: dir === '→' ? 'var(--cyan)' : 'var(--orange)' }}>{dir}</span>
              <span className="truncate grow">{short(other)}</span>
              <span className="caption">{e.kind}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Sidebar({ onFile }: { onFile: (f: File) => void }) {
  const world = useStore((s) => s.world);
  const selected = useStore((s) => s.selected);
  const mode = useStore((s) => s.mode);
  const fileInput = useRef<HTMLInputElement>(null);
  if (!world) return null;
  const showOverview = mode === 'explore' && !selected;
  return (
    <>
      <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      <AnimatePresence mode="wait">
        {selected ? (
          <Card k={`node-${selected}`}>
            <NodeInspector id={selected} />
          </Card>
        ) : showOverview ? (
          <Card k="overview">
            <WorldOverview onFile={() => fileInput.current?.click()} />
          </Card>
        ) : null}
      </AnimatePresence>
    </>
  );
}
