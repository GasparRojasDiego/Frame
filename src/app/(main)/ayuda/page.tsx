import HelpAsk from '@/components/help/HelpAsk';
import { exitHelp } from '@/components/help/HelpButton';
import { useRouter } from '@/lib/navigation';

// Centro de ayuda: ocupa todo el espacio entre el menú lateral y la
// cabecera. Se entra con su botón de la barra superior y se sale con él,
// con la flecha de Atrás o con Esc.
export default function AyudaPage() {
  const router = useRouter();
  return <HelpAsk onExit={() => exitHelp(router)} />;
}
