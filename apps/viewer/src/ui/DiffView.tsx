/** Unified diff rendered as text nodes only. */
export function DiffView({ diff }: { diff: string }) {
  const lines = diff.replace(/\n$/, '').split('\n');
  return (
    <div className="scroll code" style={{ borderRadius: 12, background: 'rgba(0,0,0,0.35)', padding: '8px 0', maxHeight: 280, boxShadow: '0 0 0 0.5px rgba(255,255,255,0.08) inset' }}>
      {lines.map((l, i) => {
        const cls = l.startsWith('+++') || l.startsWith('---') ? 'diff-file' : l.startsWith('@@') ? 'diff-hunk' : l.startsWith('+') ? 'diff-add' : l.startsWith('-') ? 'diff-del' : '';
        return (
          <span key={i} className={`line ${cls}`} style={{ paddingLeft: 12 }}>
            {l || ' '}
          </span>
        );
      })}
    </div>
  );
}
