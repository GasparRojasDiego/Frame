import HelpAsk from '@/components/help/HelpAsk';
import { exitHelp } from '@/components/help/HelpButton';
import { useRouter } from '@/lib/navigation';

// Interfaz «Ayuda»: ocupa todo el espacio entre el menú lateral y la
// cabecera. Se entra y se sale con el botón redondo de abajo a la derecha.
export default function AyudaPage() {
  const router = useRouter();
  return <HelpAsk onExit={() => exitHelp(router)} />;
}
