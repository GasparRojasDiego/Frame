import { Suspense, lazy } from 'react';
import { LoaderCircle } from 'lucide-react';

// Carga diferida del módulo de música: divide el bundle y mantiene el
// arranque de la app instantáneo (equivalente optimizado del next/dynamic).
const MusicLibrary = lazy(() => import('@/components/music/MusicLibrary'));

const Loader = (
  <div className="flex h-full w-full items-center justify-center p-8">
    <LoaderCircle className="h-10 w-10 animate-spin text-primary" />
  </div>
);

export default function MusicPage() {
  return (
    <Suspense fallback={Loader}>
      <MusicLibrary />
    </Suspense>
  );
}
