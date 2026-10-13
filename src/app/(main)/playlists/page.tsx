import { Suspense } from 'react';
import { useSearchParams } from '@/lib/navigation';
import PlaylistDetailsClient from './PlaylistDetailsClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Music } from 'lucide-react';
import { tr } from '@/lib/i18n';

function PlaylistContent() {
  const searchParams = useSearchParams();
  const playlistId = searchParams.get('id');

  if (!playlistId) {
    return (
      <div className="space-y-6 p-6 md:p-8">
        <h1 className="text-3xl font-bold text-primary font-headline">{tr('Playlists')}</h1>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Music />{' '}{tr('Selecciona una playlist')}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">
              {tr('Por favor, selecciona una playlist de la barra lateral para ver sus canciones.')}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <PlaylistDetailsClient id={playlistId} />;
}

export default function PlaylistsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">{tr('Cargando la playlist…')}</div>}>
      <PlaylistContent />
    </Suspense>
  );
}