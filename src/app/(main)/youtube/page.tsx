import { isTauri } from '@tauri-apps/api/core';
import { Card } from '@/components/ui/card';
import { YoutubeLogo } from '@/components/integrations/YoutubeIcon';
import GoogleEmbed from '@/components/integrations/GoogleEmbed';

// Interfaz "YouTube": el YouTube real incrustado, a sangre y centrado.
//
// Guardar un vídeo de estudio se hace desde Estudio, en una ventana con este
// mismo YouTube dentro.
//
// Columna flexible: el recuadro ocupa EXACTAMENTE la altura libre, así que
// encoge solo cuando aparece la barra de música y vuelve a crecer al
// ocultarla. Sin `justify-center`: al desbordar dejaba parte del contenido
// por encima del área con scroll, fuera de alcance del ratón.
export default function YoutubePage() {
  return (
    <div className="flex h-full min-h-0 flex-col py-4">
      {isTauri() ? (
        <Card className="flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-none border-x-0">
          <GoogleEmbed kind="youtube" heightClass="min-h-0 flex-1" />
        </Card>
      ) : (
        <Card className="mx-4 my-auto flex items-center gap-3 p-4 md:mx-8">
          <YoutubeLogo className="h-6 w-8 shrink-0" />
          <p className="text-xs text-muted-foreground">
            El recuadro de YouTube integrado está disponible en la app de escritorio Frame.
          </p>
        </Card>
      )}
    </div>
  );
}
