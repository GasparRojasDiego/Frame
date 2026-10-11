import { useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  AlertTriangle,
  Check,
  ClipboardCopy,
  ClipboardPaste,
  Pencil,
  RotateCcw,
  Table2,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useCourse } from '@/context/CourseContext';
import { cn } from '@/lib/utils';
import {
  isSchedulePromptCustom,
  loadSchedulePrompt,
  parseSchedule,
  saveSchedulePrompt,
  buildSchedulePrompt,
} from '@/lib/schedule';

// ============================================================
// Importar el horario del mes.
//
// El colegio lo reparte como una FOTO, y Frame no lee imágenes. El camino es
// de tres pasos: copiar las instrucciones, dárselas a un asistente junto con
// la foto, y pegar aquí el texto que devuelva.
//
// Las instrucciones no se muestran de entrada —son largas y saturan la
// pantalla— pero SÍ se pueden abrir y editar: el horario del colegio puede
// cambiar de forma sin que la app cambie, y entonces el usuario tiene que
// poder ajustar las reglas sin esperar una versión nueva.
//
// Al guardar, las clases del mes se crean aquí mismo. No hay un segundo paso
// en otra pantalla: importar el horario ES tener las clases.
// ============================================================

const WEEKDAY_LABEL = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

function Step({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">
        {number}
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {children}
      </div>
    </div>
  );
}

export default function ScheduleImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { courses, schedules, saveSchedule } = useCourse();
  const { toast } = useToast();
  const [pasted, setPasted] = useState('');
  const [copied, setCopied] = useState(false);

  // Instrucciones: `prompt` es lo que se copia; `draft` lo que se está
  // escribiendo mientras el editor está abierto.
  // El prompt de fábrica se construye con LAS ASIGNATURAS DE ESTE ESTUDIANTE:
  // así la IA devuelve la tabla con sus nombres exactos y Frame puede casar
  // cada clase con su asignatura (ver buildSchedulePrompt).
  const courseNames = useMemo(() => courses.map((course) => course.name), [courses]);
  const [prompt, setPrompt] = useState(() => loadSchedulePrompt(courseNames));
  const [draft, setDraft] = useState(prompt);
  const [editing, setEditing] = useState(false);
  const [custom, setCustom] = useState(() => isSchedulePromptCustom(courseNames));

  // Al reabrir el diálogo se relee lo guardado y se cierra el editor: nadie
  // espera encontrarse un borrador a medias de la vez anterior.
  useEffect(() => {
    if (!open) return;
    const stored = loadSchedulePrompt(courseNames);
    setPrompt(stored);
    setDraft(stored);
    setCustom(isSchedulePromptCustom(courseNames));
    setEditing(false);
    // Lo pegado la vez anterior no debe reaparecer: es la vía para guardar el
    // horario de septiembre en octubre sin darse cuenta.
    setPasted('');
  }, [open, courseNames]);

  const parsed = useMemo(
    () => (pasted.trim() ? parseSchedule(pasted, courses) : null),
    [pasted, courses]
  );

  /** Reparto por día de la semana, para el adelanto. */
  const byWeekday = useMemo(() => {
    if (!parsed) return [];
    const map = new Map<number, typeof parsed.slots>();
    for (const slot of parsed.slots) {
      const list = map.get(slot.weekday);
      if (list) list.push(slot);
      else map.set(slot.weekday, [slot]);
    }
    return [...map.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([weekday, slots]) => ({
        weekday,
        slots: [...slots].sort((a, b) => a.start.localeCompare(b.start)),
      }));
  }, [parsed]);

  const monthLabel = parsed?.month
    ? format(parseISO(`${parsed.month}-01`), "MMMM 'de' yyyy", { locale: es })
    : null;

  const alreadyImported = parsed?.month
    ? schedules.some((s) => s.month === parsed.month)
    : false;

  const canSave = Boolean(parsed?.month && parsed.slots.length > 0);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast({
        variant: 'destructive',
        title: 'No se pudo copiar',
        description: 'Tu equipo no permitió el acceso al portapapeles.',
      });
    }
  };

  const handleSavePrompt = () => {
    saveSchedulePrompt(draft, courseNames);
    const stored = loadSchedulePrompt(courseNames);
    setPrompt(stored);
    setDraft(stored);
    setCustom(isSchedulePromptCustom(courseNames));
    setEditing(false);
    toast({
      title: 'Instrucciones guardadas',
      description: 'El botón "Copiar instrucciones" ya usa tu versión.',
    });
  };

  const handleResetPrompt = () => {
    const factory = buildSchedulePrompt(courseNames);
    saveSchedulePrompt(factory, courseNames);
    setPrompt(factory);
    setDraft(factory);
    setCustom(false);
    toast({
      title: 'Instrucciones originales restauradas',
      description: 'Se descartó tu versión y volvieron las de fábrica.',
    });
  };

  const handleSave = () => {
    if (!parsed?.month || parsed.slots.length === 0) return;
    const created = saveSchedule({
      month: parsed.month,
      importedAt: new Date().toISOString(),
      slots: parsed.slots,
      skipDates: parsed.skipDates,
    });
    toast({
      title: `Horario de ${monthLabel} guardado`,
      description:
        created > 0
          ? `${created} clases creadas en tus asignaturas. Ya están en la pestaña Sesiones.`
          : `${parsed.slots.length} clases por semana, pero el mes no tiene ningún día que encaje.`,
    });
    setPasted('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b px-5 pb-3 pt-5">
          <DialogTitle className="flex items-center justify-center gap-2 text-lg font-bold text-primary">
            <Table2 className="h-5 w-5" />
            Horario del mes
          </DialogTitle>
          <p className="text-center text-[11px] text-muted-foreground">
            El colegio lo reparte como imagen. Estos tres pasos lo convierten en clases dentro de Frame.
          </p>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <Step number={1} title="Copia las instrucciones">
            <p className="text-xs text-muted-foreground">
              Pégalas en ChatGPT o Gemini <strong className="text-foreground">junto con la foto</strong> del
              horario. Le dicen exactamente en qué formato debe responder.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => {
                  setDraft(prompt);
                  setEditing((p) => !p);
                }}
                title="Ver y editar las instrucciones"
              >
                <Pencil className="mr-1.5 h-3.5 w-3.5" />
                Editar
              </Button>
              <Button
                variant={copied ? 'default' : 'outline'}
                size="sm"
                className="text-xs"
                onClick={() => void handleCopy()}
              >
                {copied ? (
                  <>
                    <Check className="mr-1.5 h-3.5 w-3.5" /> Copiado
                  </>
                ) : (
                  <>
                    <ClipboardCopy className="mr-1.5 h-3.5 w-3.5" /> Copiar instrucciones
                  </>
                )}
              </Button>
              {custom && (
                <span className="rounded-md bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  Editadas por ti
                </span>
              )}
            </div>

            {editing && (
              <div className="space-y-2 rounded-lg border border-amber-500/50 bg-amber-500/10 p-2.5">
                <div className="flex items-start gap-2 text-[11px] leading-snug text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <p>
                    Estas instrucciones son lo que hace que el texto pegado se entienda. Los nombres de
                    tus asignaturas puedes cambiarlos con tranquilidad; el{' '}
                    <strong>formato de salida</strong> —la línea «MES:», las seis columnas y su orden— con
                    cuidado: si lo alteras, Frame puede dejar de reconocer las clases.
                  </p>
                </div>
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={14}
                  spellCheck={false}
                  className="resize-none bg-card font-mono text-[10px] leading-relaxed"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" className="text-xs" onClick={handleSavePrompt} disabled={draft === prompt}>
                    <Check className="mr-1.5 h-3.5 w-3.5" />
                    Guardar instrucciones
                  </Button>
                  <Button variant="outline" size="sm" className="text-xs" onClick={handleResetPrompt}>
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                    Volver al original
                  </Button>
                  <Button variant="ghost" size="sm" className="text-xs" onClick={() => setEditing(false)}>
                    Cerrar
                  </Button>
                </div>
              </div>
            )}
          </Step>

          <Step number={2} title="Pega aquí su respuesta">
            <Textarea
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              placeholder={'MES: 2026-09\n| Asignatura | Día | Inicio | Fin | Aula | Profesor |\n|---|---|---|---|---|---|\n| Mathematics | Lunes | 07:30 | 09:00 | A-201 | Carlos Ramos |'}
              rows={7}
              className="resize-none font-mono text-[11px]"
            />
          </Step>

          {parsed && (
            <Step number={3} title="Comprueba antes de guardar">
              {parsed.slots.length === 0 ? (
                <p className="rounded-lg border border-dashed py-6 text-center text-xs text-muted-foreground">
                  No se reconoció ninguna clase en ese texto. Comprueba que pegaste la tabla completa,
                  con sus barras verticales.
                </p>
              ) : (
                <div className="space-y-2.5">
                  <Card className="flex flex-wrap items-center gap-x-5 gap-y-1 p-3 text-xs">
                    <span>
                      <span className="text-muted-foreground">Mes: </span>
                      <span className="font-semibold capitalize text-foreground">
                        {monthLabel ?? 'sin reconocer'}
                      </span>
                    </span>
                    <span>
                      <span className="text-muted-foreground">Clases por semana: </span>
                      <span className="font-semibold tabular-nums text-primary">{parsed.slots.length}</span>
                    </span>
                    {parsed.skipDates.length > 0 && (
                      <span>
                        <span className="text-muted-foreground">Días sin clase: </span>
                        <span className="font-semibold tabular-nums text-foreground">
                          {parsed.skipDates.length}
                        </span>
                      </span>
                    )}
                  </Card>

                  {/* Adelanto por día: es donde se ve de un golpe si algo salió torcido. */}
                  <div className="space-y-2">
                    {byWeekday.map(({ weekday, slots }) => (
                      <div key={weekday} className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            {WEEKDAY_LABEL[weekday]}
                          </span>
                          <span className="h-px flex-1 bg-border" />
                        </div>
                        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                          {slots.map((slot) => (
                            <div
                              key={slot.id}
                              className="flex items-center gap-2 rounded-md border border-border/70 bg-card px-2 py-1.5"
                            >
                              <span className="font-mono text-[10px] tabular-nums text-primary">
                                {slot.start}
                              </span>
                              <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-foreground">
                                {slot.courseName}
                              </span>
                              {slot.room && (
                                <span className="shrink-0 text-[10px] text-muted-foreground">{slot.room}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {(parsed.unknownCourses.length > 0 || parsed.droppedRows > 0 || !parsed.month) && (
                    <div className="flex items-start gap-2 rounded-lg border border-amber-500/50 bg-amber-500/10 p-2.5 text-[11px] text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <div className="min-w-0 space-y-0.5">
                        {!parsed.month && (
                          <p>No se reconoció el mes. Añade una línea «MES: 2026-09» al principio del texto.</p>
                        )}
                        {parsed.unknownCourses.length > 0 && (
                          <p>
                            Estas asignaturas del horario no existen todavía en Frame y se han omitido:{' '}
                            <strong>{parsed.unknownCourses.join(', ')}</strong>. Créalas y vuelve a pegar.
                          </p>
                        )}
                        {parsed.droppedRows > 0 && parsed.unknownCourses.length === 0 && (
                          <p>Se descartaron {parsed.droppedRows} filas por no tener día u hora legibles.</p>
                        )}
                      </div>
                    </div>
                  )}

                  {alreadyImported && (
                    <p className="text-[11px] text-muted-foreground">
                      Ya había un horario guardado para {monthLabel}. Al guardar, el nuevo manda de hoy en
                      adelante: las clases que ya pasaron se quedan tal cual, con sus recursos y tareas, y solo
                      se rehacen las de hoy y las siguientes.
                    </p>
                  )}
                </div>
              )}
            </Step>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t bg-card/60 px-5 py-3">
          <p className="text-[10px] text-muted-foreground">
            Todo ocurre en tu equipo: Frame no envía nada a ningún sitio.
          </p>
          <Button size="sm" onClick={handleSave} disabled={!canSave} className={cn('min-w-[11rem]')}>
            <ClipboardPaste className="mr-1.5 h-4 w-4" />
            Guardar y crear clases
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
