import { useEffect, useMemo, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from '../store';
import { highlightLine } from './highlight';
import { Icon } from './icons';

export function CodePanel() {
  const code = useStore((s) => s.code);
  const openCode = useStore((s) => s.openCode);
  const sources = useStore((s) => s.world?.graph.sources);
  const flyTo = useStore((s) => s.flyTo);
  const scroller = useRef<HTMLDivElement>(null);
  const text = code ? sources?.[code.file] : undefined;
  const lines = useMemo(() => (text ?? '').split('\n'), [text]);
  const from = code?.line ?? 0;
  const to = code?.endLine ?? code?.line ?? 0;

  useEffect(() => {
    if (!code?.line) return;
    const el = scroller.current?.querySelector(`[data-line="${code.line}"]`);
    el?.scrollIntoView({ block: 'center' });
  }, [code]);

  return (
    <AnimatePresence>
      {code && (
        <motion.aside
          key="code"
          className="glass thick"
          role="dialog"
          aria-label={`Source of ${code.file}`}
          initial={{ x: 60, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 60, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 280, damping: 30 }}
          style={{ position: 'fixed', right: 16, top: 72, bottom: 16, width: 'min(620px, calc(100vw - 32px))', zIndex: 60, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        >
          <header className="row" style={{ padding: '12px 14px', borderBottom: '1px solid var(--separator)', gap: 10 }}>
            <Icon.file />
            <div className="stack grow" style={{ minWidth: 0 }}>
              <span className="headline truncate">{code.file.split('/').pop()}</span>
              <span className="caption truncate mono">
                {code.file}
                {code.line ? `:${code.line}${to > from ? `-${to}` : ''}` : ''}
                {code.title ? ` · ${code.title}` : ''}
              </span>
            </div>
            <button className="btn" onClick={() => flyTo(code.file)}>
              Show in city
            </button>
            <button className="btn icon" aria-label="Close code" onClick={() => openCode(undefined)}>
              <Icon.close />
            </button>
          </header>
          <div ref={scroller} className="scroll code" style={{ flex: 1, padding: '10px 0' }}>
            {text === undefined ? (
              <div className="caption" style={{ padding: 16 }}>
                Source for this file isn’t bundled in this world.
              </div>
            ) : (
              lines.map((l, i) => {
                const n = i + 1;
                const hl = from > 0 && n >= from && n <= Math.max(from, to);
                return (
                  <span key={n} data-line={n} className={`line ${hl ? (code.tone === 'red' ? 'hl-red' : 'hl') : ''}`}>
                    <span className="ln">{n}</span>
                    {highlightLine(l)}
                  </span>
                );
              })
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
