const P = { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };

export const Icon = {
  play: () => (
    <svg {...P} fill="currentColor" stroke="none">
      <path d="M4.5 2.9v10.2c0 .6.7 1 1.2.6l7.6-5.1a.75.75 0 000-1.2L5.7 2.3c-.5-.4-1.2 0-1.2.6z" />
    </svg>
  ),
  pause: () => (
    <svg {...P} fill="currentColor" stroke="none">
      <rect x="3.5" y="2.5" width="3.2" height="11" rx="1" />
      <rect x="9.3" y="2.5" width="3.2" height="11" rx="1" />
    </svg>
  ),
  back: () => (
    <svg {...P}>
      <path d="M10 3.5L5.5 8l4.5 4.5" />
    </svg>
  ),
  fwd: () => (
    <svg {...P}>
      <path d="M6 3.5L10.5 8 6 12.5" />
    </svg>
  ),
  restart: () => (
    <svg {...P}>
      <path d="M3 8a5 5 0 105-5H5.5M5.5 1v2.8h2.8" />
    </svg>
  ),
  search: () => (
    <svg {...P}>
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5L14 14" />
    </svg>
  ),
  close: () => (
    <svg {...P}>
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  ),
  file: () => (
    <svg {...P}>
      <path d="M4 1.8h5l3 3v9.4H4z" />
      <path d="M9 1.8v3h3" />
    </svg>
  ),
  bolt: () => (
    <svg {...P}>
      <path d="M9 1.5L3.5 9H8l-1 5.5L12.5 7H8z" />
    </svg>
  ),
  check: () => (
    <svg {...P}>
      <path d="M3.5 8.5l3 3 6-7" />
    </svg>
  ),
  warn: () => (
    <svg {...P}>
      <path d="M8 2l6.5 11.5h-13z" />
      <path d="M8 6.5v3.2M8 11.8v.1" />
    </svg>
  ),
  upload: () => (
    <svg {...P}>
      <path d="M8 10.5V2.5M5 5.5l3-3 3 3M2.5 10.5v3h11v-3" />
    </svg>
  ),
  map: () => (
    <svg {...P}>
      <path d="M1.5 3.5l4-1.5 5 2 4-1.5v10l-4 1.5-5-2-4 1.5z" />
      <path d="M5.5 2v10M10.5 4v10" />
    </svg>
  ),
  cube: () => (
    <svg {...P}>
      <path d="M8 1.5l5.5 3v7L8 14.5l-5.5-3v-7z" />
      <path d="M2.5 4.5L8 7.5l5.5-3M8 7.5v7" />
    </svg>
  ),
  help: () => (
    <svg {...P}>
      <circle cx="8" cy="8" r="6.5" />
      <path d="M6.2 6.2a1.9 1.9 0 113 1.5c-.7.4-1.2.8-1.2 1.6M8 11.6v.1" />
    </svg>
  ),
  sparkle: () => (
    <svg {...P}>
      <path d="M8 1.5l1.4 4.1L13.5 7l-4.1 1.4L8 12.5 6.6 8.4 2.5 7l4.1-1.4z" />
    </svg>
  ),
  link: () => (
    <svg {...P}>
      <path d="M6.8 9.2a2.8 2.8 0 004 0l2.2-2.2a2.8 2.8 0 00-4-4l-.9.9M9.2 6.8a2.8 2.8 0 00-4 0L3 9a2.8 2.8 0 004 4l.9-.9" />
    </svg>
  ),
  book: () => (
    <svg {...P}>
      <path d="M2.5 3.2c1.8-.6 3.7-.4 5.5.8v9c-1.8-1.2-3.7-1.4-5.5-.8zM13.5 3.2c-1.8-.6-3.7-.4-5.5.8v9c1.8-1.2 3.7-1.4 5.5-.8z" />
    </svg>
  ),
  menu: () => (
    <svg {...P}>
      <circle cx="3.5" cy="8" r=".9" fill="currentColor" />
      <circle cx="8" cy="8" r=".9" fill="currentColor" />
      <circle cx="12.5" cy="8" r=".9" fill="currentColor" />
    </svg>
  ),
  arrow: () => (
    <svg {...P}>
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  ),
  chevron: () => (
    <svg {...P}>
      <path d="M6 3.5L10.5 8 6 12.5" />
    </svg>
  ),
  route: () => (
    <svg {...P}>
      <circle cx="3.5" cy="12.5" r="1.6" />
      <circle cx="12.5" cy="3.5" r="1.6" />
      <path d="M5 12.5h4.5a2 2 0 000-4h-3a2 2 0 010-4H11" />
    </svg>
  ),
  code: () => (
    <svg {...P}>
      <path d="M5.5 4.5L2 8l3.5 3.5M10.5 4.5L14 8l-3.5 3.5" />
    </svg>
  ),
};
