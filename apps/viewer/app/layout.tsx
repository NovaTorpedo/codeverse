import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CodeVerse · See your software think',
  description: 'A living 3D city of your codebase, and a flight recorder for how IBM Bob investigates it.',
  icons: { icon: '/icon.svg' },
};

export const viewport: Viewport = {
  themeColor: '#04060a',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
