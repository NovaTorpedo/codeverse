import { motion } from 'framer-motion';
import type { GroundingReport } from '@codeverse/grounding';

/** Activity-ring style Grounding Score: share of Bob's claims verified against the static map. */
export function GroundingRing({ report, size = 64, label = true }: { report: GroundingReport; size?: number; label?: boolean }) {
  const stroke = size * 0.13;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.round(report.score * 100);
  const color = report.score >= 0.9 ? '#30d158' : report.score >= 0.7 ? '#ffd60a' : '#ff453a';
  return (
    <div className="row" style={{ gap: 12 }} aria-label={`Grounding score ${pct} percent`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flex: 'none', filter: `drop-shadow(0 0 8px ${color}55)` }}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke={`${color}33`} strokeWidth={stroke} fill="none" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ * (1 - report.score) }}
          transition={{ type: 'spring', stiffness: 60, damping: 18 }}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text x="50%" y="52%" textAnchor="middle" dominantBaseline="middle" fill="white" fontSize={size * 0.26} fontWeight={700} fontFamily="var(--font)">
          {pct}
        </text>
      </svg>
      {label && (
        <div className="stack" style={{ gap: 2 }}>
          <div className="headline">Grounding Score</div>
          <div className="caption tabular">
            <span style={{ color: '#30d158' }}>✓ {report.grounded}</span>
            {report.weak > 0 && <span style={{ color: '#ffd60a', marginLeft: 8 }}>~ {report.weak}</span>}
            {report.unverified > 0 && <span style={{ color: '#ff9f0a', marginLeft: 8 }}>⚠ {report.unverified}</span>}
            <span className="tertiary" style={{ marginLeft: 8 }}>of {report.total} claims</span>
          </div>
        </div>
      )}
    </div>
  );
}
