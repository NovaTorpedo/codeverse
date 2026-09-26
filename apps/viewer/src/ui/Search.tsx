import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from '../store';
import { Icon } from './icons';

interface Hit {
  id: string;
  label: string;
  detail: string;
  kind: 'file' | 'symbol' | 'service' | 'route' | 'database';
  score: number;
  line?: number;
}

/** Subsequence fuzzy score: higher is better, -1 when no match. */
export function fuzzy(query: string, text: string): number {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (!q) return 0;
  const idx = t.indexOf(q);
  if (idx >= 0) return 100 - idx + (idx === 0 || /[/._ ]/.test(t[idx - 1] ?? '') ? 30 : 0) - t.length * 0.1;
  let ti = 0;
  let score = 0;
  for (const ch of q) {
    const found = t.indexOf(ch, ti);
    if (found < 0) return -1;
    score += found === ti ? 3 : 1;
    ti = found + 1;
  }
  return score - t.length * 0.05;
}

export function Search() {
  const open = useStore((s) => s.searchOpen);
  const set = useStore((s) => s.set);
  const graph = useStore((s) => s.world?.graph);
  const semantic = useStore((s) => s.world?.semantic);
  const flyTo = useStore((s) => s.flyTo);
  const openCode = useStore((s) => s.openCode);
  const [q, setQ] = useState('');
  const [cursor, setCursor] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  const corpus = useMemo(() => {
    const items: Omit<Hit, 'score'>[] = [];
    const names = new Map(semantic?.services.map((s) => [s.id, s.name]) ?? []);
    for (const n of graph?.nodes ?? []) {
      if (n.kind === 'service') items.push({ id: n.id, label: names.get(n.id) ?? n.label, detail: `district · ${n.loc} loc`, kind: 'service' });
      else if (n.kind === 'route') items.push({ id: n.id, label: n.label, detail: 'API route', kind: 'route' });
      else if (n.kind === 'database') items.push({ id: n.id, label: n.label, detail: 'datastore', kind: 'database' });
      else {
        items.push({ id: n.id, label: n.label, detail: n.id, kind: 'file' });
        for (const s of n.symbols) if (s.exported || s.kind === 'method') items.push({ id: n.id, label: s.name, detail: `${s.kind} · ${n.label}:${s.line}`, kind: 'symbol', line: s.line });
      }
    }
    return items;
  }, [graph, semantic]);

  const hits = useMemo(() => {
    if (!q.trim()) return corpus.filter((c) => c.kind === 'service').slice(0, 8).map((c) => ({ ...c, score: 0 }));
    return corpus
      .map((c) => ({ ...c, score: Math.max(fuzzy(q, c.label), fuzzy(q, c.detail) - 20) }))
      .filter((c) => c.score >= 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);
  }, [q, corpus]);

  useEffect(() => {
    if (open) {
      setQ('');
      setCursor(0);
      setTimeout(() => input.current?.focus(), 30);
    }
  }, [open]);

  const choose = (h: Hit | undefined) => {
    if (!h) return;
    flyTo(h.id);
    if (h.kind === 'symbol') openCode({ file: h.id, line: h.line, tone: 'yellow', title: h.label });
    set({ searchOpen: false });
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div key="search-bg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(0,0,0,0.25)' }} onClick={() => set({ searchOpen: false })}>
          <motion.div
            role="dialog"
            aria-label="Search"
            className="glass thick"
            initial={{ y: -16, scale: 0.98, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: -10, scale: 0.98, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            style={{ position: 'absolute', top: '14vh', left: '50%', x: '-50%', width: 'min(600px, calc(100vw - 32px))', padding: 10 }}
          >
            <div className="field" style={{ height: 44, borderRadius: 14 }}>
              <Icon.search />
              <input
                ref={input}
                value={q}
                placeholder="Find a file, symbol, service or route… e.g. PaymentService"
                aria-label="Search query"
                maxLength={120}
                onChange={(e) => {
                  setQ(e.target.value);
                  setCursor(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setCursor((c) => Math.min(hits.length - 1, c + 1));
                  }
                  if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setCursor((c) => Math.max(0, c - 1));
                  }
                  if (e.key === 'Enter') choose(hits[cursor]);
                  if (e.key === 'Escape') set({ searchOpen: false });
                }}
                style={{ fontSize: 15 }}
              />
              <span className="kbd">esc</span>
            </div>
            <div className="scroll" role="listbox" style={{ maxHeight: 360, marginTop: 8 }}>
              {hits.length === 0 && <div className="caption" style={{ padding: 12 }}>No matches</div>}
              {hits.map((h, i) => (
                <button key={`${h.kind}:${h.id}:${h.label}:${i}`} role="option" aria-selected={i === cursor} className="list-item" onMouseEnter={() => setCursor(i)} onClick={() => choose(h)}>
                  <span className="chip" style={{ width: 62, justifyContent: 'center' }}>
                    {h.kind}
                  </span>
                  <span className="stack grow" style={{ minWidth: 0 }}>
                    <span className="headline truncate">{h.label}</span>
                    <span className="caption truncate mono">{h.detail}</span>
                  </span>
                </button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
