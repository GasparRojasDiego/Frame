import { BarChart3, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { isFrameOwner } from '@/lib/owner';
import { useRouter } from '@/lib/navigation';
import type { UserProfile } from '@/types';

/**
 * Acceso al panel de uso desde Ajustes de cuenta. Solo lo ve el responsable
 * de Frame; para cualquier otra cuenta no se dibuja nada.
 */
export default function UsagePanelCard({ userProfile }: { userProfile: UserProfile | null }) {
  const router = useRouter();
  if (!isFrameOwner(userProfile)) return null;

  return (
    <Card className="border-primary/40 md:col-span-2">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-headline text-primary">
          <BarChart3 className="h-4 w-4" />
          Panel de uso
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-md text-xs text-muted-foreground">
          Cuántos estudiantes usan Frame cada día, cuánto estudian, con qué versión y qué se rompe.
          Datos seudónimos y agregados; solo tu cuenta puede verlos.
        </p>
        <Button size="sm" onClick={() => router.push('/uso')}>
          Abrir el panel
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}
