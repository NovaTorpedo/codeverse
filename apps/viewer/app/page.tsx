'use client';

import dynamic from 'next/dynamic';
import { Splash } from '../src/ui/Splash';

const App = dynamic(() => import('../src/App').then((m) => m.App), { ssr: false, loading: () => <Splash message="Loading CodeVerse" /> });

export default function Page() {
  return <App />;
}
