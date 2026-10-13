import { useMemo, useRef, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ArrowLeft, CalendarDays, CheckSquare, FileUp, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { ExtensionIcon } from '@/components/extensions/ExtensionIcons';
import { EchoHeader } from '@/components/shared/EchoWord';
import { useCourse } from '@/context/CourseContext';
import { useToast } from '@/hooks/use-toast';
import {
  dueIso,
  guessMapping,
  interpretTable,
  readNotionFiles,
  type NotionItem,
  type NotionMapping,
  type NotionTable,
} from '@/lib/extensions/notion-import';
// Solo por su limpieza de lo guardado hasta la 1.6.1.
import '@/lib/extensions/registry';
import { DEFAULT_EVENT_COLOR } from '@/lib/calendar-events';
import { cn } from '@/lib/utils';
import { dateLocale, tr } from '@/lib/i18n';

// ============================================================
// Importador de Notion: tareas y fechas. Se abre desde Ajustes (menú de la
// rueda de la cuenta, «Importar de Notion»).
// Ver lib/extensions/notion-import.ts para cómo se leen los archivos.
// ============================================================

type ImportAs = 'tasks' | 'events';

const MAPPING_LABEL: Record<keyof NotionMapping, string> = {
  get title() { return tr('Título'); },
  get date() { return tr('Fecha'); },
  get status() { return tr('Estado'); },
  get course() { return tr('Asignatura'); },
  get priority() { return tr('Prioridad'); },
  get kind() { return tr('Tipo'); },
  get description() { return tr('Descripción'); },
};

const dayLabel = (date: string) => {
  try {
    return format(parseISO(date), tr('d \'de\' MMM yyyy'), { locale: dateLocale() });
  } catch {
    return date;
  }
};

const plain = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();

/** Recuadro de quien lo monta: lo abre «Importar de Notion» del menú de la cuenta en Ajustes. */
export default function NotionImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const setOpen = onOpenChange;
  const { courses, tasks, addTask, addLocalEvent, userProfile } = useCourse();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [tables, setTables] = useState<NotionTable[]>([]);
  const [tableIndex, setTableIndex] = useState(0);
  const [mapping, setMapping] = useState<NotionMapping | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [includeDone, setIncludeDone] = useState(false);
  const [importAs, setImportAs] = useState<ImportAs>('tasks');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const table = tables[tableIndex] ?? null;
  const items = useMemo<NotionItem[]>(
    () => (table && mapping ? interpretTable(table, mapping, courses ?? []) : []),
    [table, mapping, courses]
  );
  const visibleItems = useMemo(
    () => items.filter((i) => (includeDone || !i.done) && (importAs === 'tasks' || i.date)),
    [items, includeDone, importAs]
  );

  /** Ya existe una tarea con el mismo nombre y la misma fecha: no se duplica. */
  const isDuplicate = (item: NotionItem) =>
    (tasks ?? []).some(
      (t) =>
        plain(t.name) === plain(item.title) &&
        (t.dueDate ? format(new Date(t.dueDate), 'yyyy-MM-dd') : null) === item.date
    );

  const reset = () => {
    setTables([]);
    setTableIndex(0);
    setMapping(null);
    setSelected(new Set());
    setError(null);
  };

  const choose = (list: NotionItem[]) => setSelected(new Set(list.filter((i) => !isDuplicate(i)).map((i) => i.key)));

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const found = await readNotionFiles([...files]);
      if (found.length === 0) {
        setError(tr('No encontré ninguna tabla. Elige el .zip que descarga Notion al exportar con «Markdown y CSV», o el .csv de la base de datos.'));
        return;
      }
      setTables(found);
      setTableIndex(0);
      const m = guessMapping(found[0]);
      setMapping(m);
      const first = interpretTable(found[0], m, courses ?? []);
      choose(first.filter((i) => !i.done));
    } catch (e) {
      setError(e instanceof Error ? e.message : tr('No se pudo leer el archivo.'));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const switchTable = (index: number) => {
    setTableIndex(index);
    const m = guessMapping(tables[index]);
    setMapping(m);
    choose(interpretTable(tables[index], m, courses ?? []).filter((i) => !i.done));
  };

  const runImport = () => {
    if (!userProfile) return;
    const chosen = visibleItems.filter((i) => selected.has(i.key));
    if (chosen.length === 0) return;
    if (importAs === 'tasks') {
      const now = Date.now();
      chosen.forEach((item, n) => {
        const course = (courses ?? []).find((c) => c.id === item.courseId) ?? null;
        const notes = [item.description, item.time ? tr('Hora: {time}', { time: item.time }) : '', !course && item.courseLabel ? tr('Notion: {courseLabel}', { courseLabel: item.courseLabel }) : '']
          .filter(Boolean)
          .join('\n');
        addTask({
          name: item.title,
          description: notes,
          dueDate: item.date ? dueIso(item.date) : null,
          priority: item.priority ?? 'Media',
          ...(item.kind ? { kind: item.kind } : {}),
          progress: item.done ? 100 : 0,
          order: -(now + n),
          courseId: course?.id ?? '',
          courseName: course?.name ?? '',
          uid: userProfile.id,
        });
      });
      toast({
        title: tr('{length} {p} de Notion', { length: chosen.length, p: chosen.length === 1 ? tr('tarea importada') : tr('tareas importadas') }),
        description: tr('Las que no tenían asignatura están al final de Inicio, para colocarlas.'),
      });
    } else {
      for (const item of chosen) {
        if (!item.date) continue;
        addLocalEvent({
          title: item.title,
          date: item.startDate ?? item.date,
          ...(item.startDate ? { endDate: item.date } : {}),
          kind: item.kind === 'Examen' ? 'examen' : 'personal',
          color: DEFAULT_EVENT_COLOR,
          display: 'actividad',
          ...(item.description ? { description: item.description } : {}),
        });
      }
      toast({
        title: tr('{length} {p} al calendario', { length: chosen.length, p: chosen.length === 1 ? tr('fecha importada') : tr('fechas importadas') }),
        description: tr('Las verás en Calendario → «Local».'),
      });
    }
    setOpen(false);
    reset();
  };

  const allChosen = visibleItems.length > 0 && visibleItems.every((i) => selected.has(i.key) || isDuplicate(i));
  const chosenCount = visibleItems.filter((i) => selected.has(i.key)).length;

  const close = () => {
    setOpen(false);
    reset();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogContent className="flex max-h-[88vh] flex-col gap-4 sm:max-w-2xl">
        {/* «Atrás» (a elegir otro archivo): flecha en la esquina superior
            izquierda, frente a la X de cerrar. */}
        {table && (
          <Button
            variant="ghost"
            size="icon"
            onClick={reset}
            title={tr('Elegir otro archivo')}
            aria-label={tr('Atrás: elegir otro archivo')}
            className="absolute left-4 top-4 z-10 h-7 w-7 text-muted-foreground hover:bg-primary/10 hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <EchoHeader word={tr('Notion')} className="mb-0">
          <DialogHeader className="items-center">
            <div className="flex items-center justify-center gap-2.5">
              <ExtensionIcon id="notion" className="h-8 w-8" />
              <DialogTitle className="text-xl font-bold text-primary">{tr('Importar de Notion')}</DialogTitle>
            </div>
            <DialogDescription className="text-center text-xs">{tr('Tus tareas y fechas, de una base de datos de Notion a Frame.')}</DialogDescription>
          </DialogHeader>
        </EchoHeader>

        {!table ? (
          <div className="space-y-4">
            <ol className="space-y-2 rounded-xl bg-secondary/40 p-4 text-sm text-foreground/90">
              {[
                tr('En Notion, abre la base de datos con tus tareas.'),
                tr('Pulsa ••• (arriba a la derecha) → «Exportar».'),
                tr('Formato: «Markdown y CSV». Pulsa «Exportar» y se descargará un .zip.'),
                tr('Aquí, elige ese .zip (o el .csv de dentro).'),
              ].map((step, i) => (
                <li key={step} className="flex gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
            <input ref={fileRef} type="file" accept=".zip,.csv" multiple className="hidden" onChange={(e) => void onFiles(e.target.files)} />
            <Button className="w-full gap-2" onClick={() => fileRef.current?.click()} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
              {tr('Elegir el archivo de Notion')}
            </Button>
            {error && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
            <p className="text-center text-[11px] text-muted-foreground">{tr('Todo ocurre en tu equipo: Frame no se conecta a tu cuenta de Notion.')}</p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {tables.length > 1 && (
                <select
                  value={tableIndex}
                  onChange={(e) => switchTable(Number(e.target.value))}
                  className="rounded-md border border-border bg-background px-2 py-1"
                  aria-label={tr('Base de datos')}
                >
                  {tables.map((t, i) => (
                    <option key={t.name} value={i}>
                      {t.name}
                    </option>
                  ))}
                </select>
              )}
              <span className="font-semibold text-foreground">{table.name}</span>
              <span className="text-muted-foreground">· {table.rows.length}{' '}{tr('filas')}</span>
              <div className="ml-auto flex overflow-hidden rounded-full border border-border/70">
                {(['tasks', 'events'] as ImportAs[]).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setImportAs(value)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1 transition-colors',
                      importAs === value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {value === 'tasks' ? <CheckSquare className="h-3.5 w-3.5" /> : <CalendarDays className="h-3.5 w-3.5" />}
                    {value === 'tasks' ? tr('Como tareas') : tr('Como fechas del calendario')}
                  </button>
                ))}
              </div>
            </div>

            {mapping && (
              <div className="flex flex-wrap gap-1.5 text-[11px]">
                {(Object.keys(MAPPING_LABEL) as (keyof NotionMapping)[]).map((key) =>
                  mapping[key] ? (
                    <span key={key} className="rounded-full border border-border/70 px-2 py-0.5 text-muted-foreground">
                      {MAPPING_LABEL[key]}: <span className="text-foreground">{mapping[key]}</span>
                    </span>
                  ) : null
                )}
              </div>
            )}

            <div className="flex items-center justify-between gap-3 text-xs">
              <label className="flex items-center gap-2">
                <Checkbox checked={allChosen} onCheckedChange={(v) => (v ? choose(visibleItems) : setSelected(new Set()))} />
                {tr('Seleccionar todo')}
              </label>
              {mapping?.status && (
                <label className="flex items-center gap-2 text-muted-foreground">
                  {tr('Incluir las ya terminadas')}
                  <Switch checked={includeDone} onCheckedChange={setIncludeDone} />
                </label>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-border/70">
              {visibleItems.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">
                  {importAs === 'events' ? tr('Ninguna fila tiene fecha.') : tr('No hay filas para importar.')}
                </p>
              ) : (
                visibleItems.map((item) => {
                  const dup = isDuplicate(item);
                  return (
                    <label
                      key={item.key}
                      className={cn(
                        'flex cursor-pointer items-start gap-3 border-b border-border/50 px-3 py-2 text-sm last:border-0 hover:bg-secondary/30',
                        dup && 'cursor-default opacity-50'
                      )}
                    >
                      <Checkbox
                        className="mt-0.5"
                        disabled={dup}
                        checked={selected.has(item.key)}
                        onCheckedChange={(v) =>
                          setSelected((prev) => {
                            const next = new Set(prev);
                            if (v) next.add(item.key);
                            else next.delete(item.key);
                            return next;
                          })
                        }
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-foreground">{item.title}</span>
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {item.date ? (item.startDate ? `${dayLabel(item.startDate)} → ${dayLabel(item.date)}` : dayLabel(item.date)) : tr('Sin fecha')}
                          {item.time ? ` · ${item.time}` : ''}
                          {' · '}
                          {item.courseId ? item.courseLabel : item.courseLabel ? tr('{courseLabel} (sin asignatura igual en Frame)', { courseLabel: item.courseLabel }) : tr('Sin asignatura')}
                          {item.done ? tr(' · terminada') : ''}
                          {dup ? tr(' · ya está en Frame') : ''}
                        </span>
                      </span>
                    </label>
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button variant="gris" onClick={close}>
                {tr('Cancelar')}
              </Button>
              <Button onClick={runImport} disabled={chosenCount === 0}>
                {tr('Importar')}{' '}{chosenCount}{' '}
                {importAs === 'tasks' ? (chosenCount === 1 ? tr('tarea') : tr('tareas')) : chosenCount === 1 ? tr('fecha') : tr('fechas')}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
