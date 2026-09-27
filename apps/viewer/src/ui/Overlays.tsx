import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { currentIncident, useStore } from '../store';
import { Icon } from './icons';

/** Honest provenance for whatever Bob session is on screen: always visible during replays. */
export function ReplayBadge() {
  const pb = useStore((s) => s.playback);
  const incident = useStore(currentIncident);
  const mode = useStore((s) => s.mode);
  const intro = useStore((s) => s.introOpen);
  const isMobile = useStore((s) => s.isMobile);
  const liveStatus = useStore((s) => s.liveStatus);
  if (intro) return null;
  const rec = pb?.recording ?? (mode === 'incident' ? incident?.recording : undefined);
  const inv = mode === 'incident' ? incident?.investigation : undefined;
  if (!rec && !inv) return null;
  const synthetic = rec?.synthetic || inv?.synthetic;
  const stats = rec?.result?.stats;
  const date = rec?.recordedAt && !Number.isNaN(Date.parse(rec.recordedAt)) ? new Date(rec.recordedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : undefined;
  let text: string;
  if (synthetic) text = 'SYNTHETIC FIXTURE · not a real IBM Bob session · development only';
  else if (pb?.live) text = `Live IBM Bob session${liveStatus ? ` · ${liveStatus}` : ''}`;
  else if (rec)
    text = isMobile
      ? `Recorded IBM Bob session${date ? ` · ${date}` : ''}`
      : `Real IBM Bob session, recorded${date ? ` ${date}` : ''}${stats?.tool_calls !== undefined ? ` · ${stats.tool_calls} tool calls` : ''}${stats?.session_costs !== undefined ? ` · ${stats.session_costs.toFixed(2)} Bobcoins` : ''} · replayed`;
  else text = `IBM Bob investigation from Bob IDE${inv?.generatedBy.recordedAt ? ` · ${inv.generatedBy.recordedAt.slice(0, 10)}` : ''}`;
  return (
    <div role="status" className="glass capsule badge" style={{ background: synthetic ? 'rgba(90,60,0,0.6)' : undefined }}>
      <span className="dot" style={{ color: synthetic ? 'var(--orange)' : pb?.live ? 'var(--red)' : 'var(--green)' }} />
      <span className="caption truncate" style={{ color: synthetic ? '#ffcc66' : 'var(--label)' }}>
        {text}
      </span>
    </div>
  );
}

export function Toast() {
  const toast = useStore((s) => s.toast);
  const set = useStore((s) => s.set);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => set({ toast: undefined }), 3800);
    return () => clearTimeout(t);
  }, [toast, set]);
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          key={toast.nonce}
          role={toast.tone === 'error' ? 'alert' : 'status'}
          className="glass thick capsule row"
          initial={{ y: -16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -16, opacity: 0 }}
          style={{ position: 'fixed', top: 112, left: '50%', x: '-50%', zIndex: 90, padding: '10px 16px', gap: 8, maxWidth: 'calc(100vw - 32px)' }}
        >
          {toast.tone === 'error' ? <Icon.warn /> : <Icon.check />}
          <span className="truncate" style={{ color: toast.tone === 'error' ? 'var(--red-text)' : undefined }}>
            {toast.text}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
