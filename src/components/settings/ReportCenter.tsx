import { useState, type ReactNode } from 'react';
import { ScrollText } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import GeneralReportCard from '@/components/settings/GeneralReportCard';
import PerformanceReportCard from '@/components/settings/PerformanceReportCard';
import { HabitsReportCard, PendingReportCard } from '@/components/settings/QuickReportCards';
import { cn } from '@/lib/utils';
import type { UserProfile } from '@/types';

// ============================================================
// Centro de informes (Ajustes, abajo a la derecha).
//
// Los cuatro informes de Frame, a la vista y sin pasar por la rueda de la
// cuenta. Se ven de uno en uno y a todo el ancho del recuadro: los cuatro
// juntos no caben en media pantalla sin que se monten sus textos.
//
// Los cuatro quedan montados en la misma celda y solo se ve el elegido.
// Así el recuadro mide siempre lo que el más alto —no salta al cambiar de
// pestaña— y cada informe conserva lo que se eligió en él (periodo, modo).
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
    <Card className="flex h-full flex-col p-5" data-tour="informes">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-primary/10">
          <ScrollText className="h-5 w-5 text-primary" />
        </span>
        <div>
          <h3 className="text-lg font-bold text-primary">Centro de informes</h3>
          <p className="text-xs text-muted-foreground">
            General, rendimiento, pendientes y hábitos, en PDF o Word.
          </p>
        </div>
      </div>

      <Tabs value={active} onValueChange={(value) => setActive(value as ReportKey)} className="mb-3 w-full">
        <TabsList className="grid w-full grid-cols-4" data-tour="informes-tipos">
          {TABS.map((tab, index) => (
            <TabsTrigger key={tab.key} value={tab.key} className={cn(index < TABS.length - 1 && 'border-r')}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="grid flex-1">
        {TABS.map(({ key }) => {
          const shown = key === active;
          return (
            <div
              key={key}
              className={cn('col-start-1 row-start-1 flex flex-col [&>*]:flex-1', !shown && 'invisible')}
              inert={!shown}
              aria-hidden={!shown}
            >
              {panels[key]}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
