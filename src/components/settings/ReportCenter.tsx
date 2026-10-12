import { useState, type ReactNode } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import GeneralReportCard from '@/components/settings/GeneralReportCard';
import PerformanceReportCard from '@/components/settings/PerformanceReportCard';
import { HabitsReportCard, PendingReportCard } from '@/components/settings/QuickReportCards';
import { cn } from '@/lib/utils';
import type { UserProfile } from '@/types';

// ============================================================
// Centro de informes (recuadro del botón de informes de la barra superior).
//
// Hasta la 1.6.1 vivía en Ajustes, abajo a la derecha; desde la 1.6.2 se
// abre desde la barra superior, a la derecha de «Crear», en cualquier
// interfaz. Este componente es solo el CUERPO del recuadro: el título y el
// marco los pone la barra (src/components/layout/header.tsx), que además lo
// carga bajo demanda para no sumar los generadores de documentos al arranque.
//
// Los cuatro informes de Frame, de uno en uno y a todo el ancho: los cuatro
// juntos no caben sin que se monten sus textos. Quedan montados en la misma
// celda y solo se ve el elegido. Así el recuadro mide siempre lo que el más
// alto —no salta al cambiar de pestaña— y cada informe conserva lo que se
// eligió en él (periodo, modo).
//
// Cada informe trae su propia tarjeta; aquí se le quitan borde, fondo y
// sombra para que no quede un recuadro dentro de otro.
// ============================================================

type ReportKey = 'general' | 'performance' | 'pending' | 'habits';

const TABS: { key: ReportKey; label: string }[] = [
  { key: 'general', label: 'General' },
  { key: 'performance', label: 'Rendimiento' },
  { key: 'pending', label: 'Pendientes' },
  { key: 'habits', label: 'Hábitos' },
];

export default function ReportCenter({ userProfile }: { userProfile: UserProfile | null }) {
  const [active, setActive] = useState<ReportKey>('general');

  const panels: Record<ReportKey, ReactNode> = {
    general: <GeneralReportCard userProfile={userProfile} />,
    performance: <PerformanceReportCard userProfile={userProfile} />,
    pending: <PendingReportCard />,
    habits: <HabitsReportCard />,
  };

  return (
    <div className="flex flex-col" data-tour="informes">
      <Tabs value={active} onValueChange={(value) => setActive(value as ReportKey)} className="mb-1 w-full">
        <TabsList className="grid w-full grid-cols-4" data-tour="informes-tipos">
          {TABS.map((tab, index) => (
            <TabsTrigger key={tab.key} value={tab.key} className={cn(index < TABS.length - 1 && 'border-r')}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* `-mx-4`: el relleno de cada tarjeta queda alineado con las pestañas. */}
      <div className="-mx-4 grid">
        {TABS.map(({ key }) => {
          const shown = key === active;
          return (
            <div
              key={key}
              className={cn(
                'col-start-1 row-start-1 flex flex-col [&>*]:flex-1 [&>*]:border-0 [&>*]:bg-transparent [&>*]:shadow-none',
                !shown && 'invisible'
              )}
              inert={!shown}
              aria-hidden={!shown}
            >
              {panels[key]}
            </div>
          );
        })}
      </div>
    </div>
  );
}
