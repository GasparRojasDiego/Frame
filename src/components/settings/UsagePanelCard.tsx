import { BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isFrameOwner } from '@/lib/owner';
import { useRouter } from '@/lib/navigation';
import type { UserProfile } from '@/types';

/**
 * «Panel de uso», dentro del menú de la rueda de la cuenta (Ajustes). Solo lo
 * ve el responsable de Frame; para cualquier otra cuenta no se dibuja nada.
 * (Antes era una tarjeta del recuadro «Ajustes de cuenta», que ya no existe.)
 */
export default function UsagePanelButton({
  userProfile,
  onOpen,
}: {
  userProfile: UserProfile | null;
  /** Para cerrar el menú antes de cambiar de interfaz. */
  onOpen?: () => void;
}) {
  const router = useRouter();
  if (!isFrameOwner(userProfile)) return null;

  return (
    <Button
      variant="fantasma"
      size="sm"
      className="w-full justify-start"
      onClick={() => {
        onOpen?.();
        router.push('/uso');
      }}
    >
      <BarChart3 className="h-4 w-4" />
      Panel de uso
    </Button>
  );
}
