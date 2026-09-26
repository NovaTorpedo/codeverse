export function Splash({ message, error }: { message?: string; error?: string }) {
  return (
    <div style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', background: 'radial-gradient(ellipse at 50% 60%, #0b1722 0%, #04060a 70%)' }}>
      <div className="stack" style={{ alignItems: 'center', gap: 18 }}>
        <Logo size={56} />
        <div className="title-1" style={{ letterSpacing: '-0.03em' }}>
          CodeVerse
        </div>
        {error ? (
          <div className="glass" role="alert" style={{ padding: '14px 18px', maxWidth: 420, textAlign: 'center' }}>
            <div className="headline" style={{ color: '#ff6961', marginBottom: 4 }}>
              Couldn’t load this world
            </div>
            <div className="caption">{error}</div>
          </div>
        ) : (
          <div className="caption shimmer-text" aria-live="polite">
            {message ?? 'Loading'}
          </div>
        )}
      </div>
    </div>
  );
}

export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <defs>
        <linearGradient id="cv-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#64D2FF" />
          <stop offset="1" stopColor="#5E5CE6" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill="rgba(255,255,255,0.06)" />
      <rect x="14" y="30" width="8" height="20" rx="2" fill="url(#cv-g)" />
      <rect x="28" y="18" width="8" height="32" rx="2" fill="url(#cv-g)" />
      <rect x="42" y="25" width="8" height="25" rx="2" fill="url(#cv-g)" opacity=".8" />
      <circle cx="32" cy="11" r="3" fill="#FFD60A" />
    </svg>
  );
}
