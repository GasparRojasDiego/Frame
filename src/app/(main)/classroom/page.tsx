import { Card } from '@/components/ui/card';
import { isTauri } from '@tauri-apps/api/core';
import { ClassroomLogo } from '@/components/integrations/ClassroomIcon';
import GoogleEmbed from '@/components/integrations/GoogleEmbed';
import { tr } from '@/lib/i18n';

// Interfaz "Classroom": el Google Classroom REAL incrustado, a sangre, igual
// que Drive y Gmail. Comparte la sesión de Google de los otros recuadros.
export default function ClassroomPage() {
  return (
    <div className="flex h-full min-h-0 flex-col py-4">
      {isTauri() ? (
        <Card className="flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-none border-x-0">
          <GoogleEmbed kind="classroom" heightClass="min-h-0 flex-1" />
        </Card>
      ) : (
        <Card className="mx-4 my-auto flex items-center gap-3 p-4 md:mx-8">
          <ClassroomLogo className="h-7 w-7 shrink-0" />
          <p className="text-xs text-muted-foreground">
            {tr('El recuadro de Classroom integrado está disponible en la app de escritorio Frame.')}
          </p>
        </Card>
      )}
    </div>
  );
}
