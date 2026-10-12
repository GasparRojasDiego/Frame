import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, Inbox, Layers, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCourse } from '@/context/CourseContext';
import { getImage } from '@/lib/music-db';
import { cn } from '@/lib/utils';
import WaveBackdrop from '@/components/courses/WaveBackdrop';
import type { Course } from '@/types';

// ============================================================
// Elegir UNA asignatura, en dos pasos: colección → asignatura.
//
// Las tarjetas de colección primero, porque es como está ordenada la cabeza
// del estudiante: «esto es de ciencias» viene antes que «esto es de física».
// Con doce asignaturas, la lista completa de golpe es una pared; por
// colecciones son cuatro tarjetas y una decisión.
//
// La estética es la del recuadro de cerrar sesión de estudio: portada a
// sangre, línea divisoria y el nombre centrado en azul.
//
// La opción "Sin asignatura" existe a propósito: apuntar algo en caliente no
// puede depender de decidir dónde va. Se coloca después, desde Inicio.
// ============================================================

const LOOSE = '__loose__';

/**
 * Portada guardada bajo la primera clave que tenga imagen; si ninguna la
 * tiene, las olas animadas de siempre. Las colecciones guardan la suya en
 * `spaceImage_<id>` y las asignaturas en `courseImage_<id>`.
 */
export function SubjectCover({ imageKeys, className }: { imageKeys: string[]; className?: string }) {
  const [image, setImage] = useState<string | null>(null);
  const signature = imageKeys.join('|');

  useEffect(() => {
    let alive = true;
    setImage(null);
    void (async () => {
      for (const key of signature.split('|')) {
        if (!key) continue;
        const found = await getImage(key);
        if (!alive) return;
        if (found) {
          setImage(found);
          return;
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [signature]);

  return (
    <span className={cn('relative block overflow-hidden bg-accent', className)}>
      {image ? <img src={image} alt="" className="h-full w-full object-cover" /> : <WaveBackdrop />}
    </span>
  );
}

/** Tarjeta común a colecciones y asignaturas: portada arriba, nombre debajo. */
export function PickCard({
  title,
  subtitle,
  imageKeys,
  selected,
  onSelect,
}: {
  title: string;
  subtitle?: string;
  /** Claves de imagen a probar en orden; sin ninguna válida, olas. */
  imageKeys: string[];
  selected?: boolean;
  /** Atenuada y sin respuesta (p. ej. al llegar al máximo de marcadas). */
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        'relative block w-full overflow-hidden rounded-lg border text-left transition-all',
        selected
          ? 'border-primary shadow-[0_0_0_1px_hsl(var(--primary)/0.35)]'
          : 'border-border/70 hover:border-primary/40',
        disabled && 'cursor-not-allowed opacity-45 hover:border-border/70'
      )}
    >
      <span className="relative block h-16">
        <SubjectCover imageKeys={imageKeys} className="h-full w-full" />
        {selected !== undefined && (
          <span
            className={cn(
              'absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-full border backdrop-blur transition-colors',
              selected
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border/60 bg-background/70 text-transparent'
            )}
          >
            <Check className="h-3 w-3" />
          </span>
        )}
      </span>
      <span
        className={cn(
          'block border-t border-border/60 px-3 py-1.5 transition-colors',
          selected ? 'bg-primary/10' : 'bg-card'
        )}
      >
        <span className="block truncate text-center text-xs font-bold text-primary">{title}</span>
        {subtitle && (
          <span className="block truncate text-center text-[10px] text-muted-foreground">
            {subtitle}
          </span>
        )}
      </span>
    </button>
  );
}

/** Colección de las tarjetas: id, nombre y asignaturas en su orden. */
export type SubjectGroup = { id: string; name: string; courses: Course[] };

/**
 * Grupos en el orden que el usuario eligió en Asignaturas, más un cajón
 * final («Sin colección») con las que no pertenecen a ninguna colección.
 */
export function useSubjectGroups(): SubjectGroup[] {
  const { courses, spaces } = useCourse();
  return useMemo(() => {
    const inSpaces = new Set((spaces ?? []).flatMap((space) => space.courseIds));
    const out: SubjectGroup[] = [];

    for (const space of spaces ?? []) {
      const list = space.courseIds
        .map((id) => (courses ?? []).find((course) => course.id === id))
        .filter((course): course is Course => Boolean(course));
      if (list.length > 0) out.push({ id: space.id, name: space.name, courses: list });
    }

    const loose = (courses ?? []).filter((course) => !inSpaces.has(course.id));
    if (loose.length > 0) out.push({ id: LOOSE, name: 'Sin colección', courses: loose });

    return out;
  }, [courses, spaces]);
}

/** Portadas a probar para una colección: la suya y, si no, las de sus asignaturas. */
export function groupImageKeys(group: SubjectGroup): string[] {
  return [
    ...(group.id === LOOSE ? [] : [`spaceImage_${group.id}`]),
    ...group.courses.map((course) => `courseImage_${course.id}`),
  ];
}

export default function SubjectPicker({
  value,
  onChange,
  /** Añade la tarjeta «Sin asignatura» al principio. */
  allowNone = false,
  noneLabel = 'Sin asignatura',
  noneHint = 'Se guarda en Inicio para colocarla luego',
  className,
}: {
  value: string | null;
  onChange: (courseId: string | null) => void;
  allowNone?: boolean;
  noneLabel?: string;
  noneHint?: string;
  className?: string;
}) {
  const { courses } = useCourse();
  const [search, setSearch] = useState('');
  /** Colección abierta; `null` = paso 1 (las colecciones). */
  const [openSpace, setOpenSpace] = useState<string | null>(null);

  const groups = useSubjectGroups();

  // Con búsqueda escrita se saltan los dos pasos: buscar es justamente lo que
  // se hace cuando ya se sabe el nombre y no se quiere navegar.
  const needle = search.trim().toLowerCase();
  const searchResults = useMemo(
    () => (needle === '' ? [] : (courses ?? []).filter((c) => c.name.toLowerCase().includes(needle))),
    [courses, needle]
  );

  const current = groups.find((group) => group.id === openSpace) ?? null;
  const hasCourses = (courses?.length ?? 0) > 0;
  const selectedCourse = (courses ?? []).find((course) => course.id === value) ?? null;

  const grid = 'grid grid-cols-2 items-start gap-2 sm:grid-cols-3';

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
          {current && needle === '' && (
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 text-muted-foreground hover:text-primary"
              onClick={() => setOpenSpace(null)}
              title="Volver a las colecciones"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          {current && needle === '' ? current.name : '¿De qué asignatura?'}
          {selectedCourse ? (
            <span className="text-xs font-normal text-primary">· {selectedCourse.name}</span>
          ) : (
            value === null &&
            allowNone && <span className="text-xs font-normal text-muted-foreground">sin asignar</span>
          )}
        </p>
        {hasCourses && (
          <div className="relative w-full sm:w-48">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 border-primary/60 bg-card pl-8 text-xs"
            />
          </div>
        )}
      </div>

      {!hasCourses ? (
        <p className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
          Todavía no tienes asignaturas. Créalas en «Asignaturas».
        </p>
      ) : (
        <div className="space-y-3">
          {allowNone && !current && needle === '' && (
            <button
              type="button"
              onClick={() => onChange(null)}
              aria-pressed={value === null}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-all',
                value === null
                  ? 'border-primary bg-primary/10'
                  : 'border-dashed border-border/70 hover:border-primary/40'
              )}
            >
              <Inbox className={cn('h-4 w-4 shrink-0', value === null ? 'text-primary' : 'text-muted-foreground')} />
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-bold text-foreground">{noneLabel}</span>
                <span className="block truncate text-[10px] text-muted-foreground">{noneHint}</span>
              </span>
            </button>
          )}

          {/* --- Búsqueda: resultados directos, sin pasar por colecciones --- */}
          {needle !== '' ? (
            searchResults.length === 0 ? (
              <p className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
                Ninguna asignatura coincide con la búsqueda.
              </p>
            ) : (
              <div className={grid}>
                {searchResults.map((course) => (
                  <PickCard
                    key={course.id}
                    title={course.name}
                    imageKeys={[`courseImage_${course.id}`]}
                    selected={value === course.id}
                    onSelect={() => onChange(course.id)}
                  />
                ))}
              </div>
            )
          ) : current ? (
            /* --- Paso 2: las asignaturas de la colección abierta --- */
            <div className={grid}>
              {current.courses.map((course) => (
                <PickCard
                  key={course.id}
                  title={course.name}
                  imageKeys={[`courseImage_${course.id}`]}
                  selected={value === course.id}
                  onSelect={() => onChange(course.id)}
                />
              ))}
            </div>
          ) : (
            /* --- Paso 1: las colecciones --- */
            <div className={grid}>
              {groups.map((group) => {
                const holdsSelection = group.courses.some((course) => course.id === value);
                return (
                  <div key={group.id} className="relative">
                    <PickCard
                      title={group.name}
                      // La portada de la colección; si no tiene, la de su primera
                      // asignatura con imagen (mejor que unas olas anónimas).
                      imageKeys={[
                        ...(group.id === LOOSE ? [] : [`spaceImage_${group.id}`]),
                        ...group.courses.map((course) => `courseImage_${course.id}`),
                      ]}
                      subtitle={`${group.courses.length} ${group.courses.length === 1 ? 'asignatura' : 'asignaturas'}`}
                      onSelect={() => setOpenSpace(group.id)}
                    />
                    <span className="pointer-events-none absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-background/70 backdrop-blur">
                      <Layers
                        className={cn('h-3 w-3', holdsSelection ? 'text-primary' : 'text-muted-foreground')}
                      />
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Elegir VARIAS asignaturas con las mismas tarjetas.
//
// Mismo recorrido que el selector de una sola (colección → asignaturas,
// o búsqueda directa), pero cada tarjeta se marca y desmarca. La colección
// muestra cuántas de las suyas van marcadas, para no perder la cuenta al
// volver al paso 1.
// ============================================================
export function SubjectMultiPicker({
  values,
  onChange,
  title = '¿De qué asignaturas?',
  max,
  className,
  searchClassName,
}: {
  values: string[];
  onChange: (courseIds: string[]) => void;
  title?: string;
  /** Tope de marcadas: al alcanzarlo, las demás tarjetas se atenúan. */
  max?: number;
  className?: string;
  /** Clases extra para la barra de búsqueda (p. ej. ancho o borde). */
  searchClassName?: string;
}) {
  const { courses } = useCourse();
  const groups = useSubjectGroups();
  const [search, setSearch] = useState('');
  const [openSpace, setOpenSpace] = useState<string | null>(null);

  const needle = search.trim().toLowerCase();
  const searchResults = useMemo(
    () => (needle === '' ? [] : (courses ?? []).filter((c) => c.name.toLowerCase().includes(needle))),
    [courses, needle]
  );
  const current = groups.find((group) => group.id === openSpace) ?? null;
  const hasCourses = (courses?.length ?? 0) > 0;
  const chosen = new Set(values);
  const full = max !== undefined && values.length >= max;

  const toggle = (id: string) =>
    onChange(chosen.has(id) ? values.filter((value) => value !== id) : [...values, id]);

  const grid = 'grid grid-cols-2 items-start gap-2 sm:grid-cols-3';
  const courseCard = (course: Course) => (
    <PickCard
      key={course.id}
      title={course.name}
      imageKeys={[`courseImage_${course.id}`]}
      selected={chosen.has(course.id)}
      disabled={full && !chosen.has(course.id)}
      onSelect={() => toggle(course.id)}
    />
  );

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
          {current && needle === '' && (
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 text-muted-foreground hover:text-primary"
              onClick={() => setOpenSpace(null)}
              title="Volver a las colecciones"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          {current && needle === '' ? current.name : title}
          {values.length > 0 && (
            <span className="text-xs font-normal text-primary">
              · {values.length} {values.length === 1 ? 'marcada' : 'marcadas'}
            </span>
          )}
        </p>
        {hasCourses && (
          <div className={cn('relative w-full sm:w-48', searchClassName)}>
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 border-primary bg-card pl-8 text-xs"
            />
          </div>
        )}
      </div>

      {!hasCourses ? (
        <p className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
          Todavía no tienes asignaturas. Créalas en «Asignaturas».
        </p>
      ) : needle !== '' ? (
        searchResults.length === 0 ? (
          <p className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
            Ninguna asignatura coincide con la búsqueda.
          </p>
        ) : (
          <div className={grid}>{searchResults.map(courseCard)}</div>
        )
      ) : current ? (
        <div className={grid}>{current.courses.map(courseCard)}</div>
      ) : (
        <div className={grid}>
          {groups.map((group) => {
            const marked = group.courses.filter((course) => chosen.has(course.id)).length;
            return (
              <div key={group.id} className="relative">
                <PickCard
                  title={group.name}
                  imageKeys={groupImageKeys(group)}
                  subtitle={
                    marked > 0
                      ? `${marked} de ${group.courses.length} marcadas`
                      : `${group.courses.length} ${group.courses.length === 1 ? 'asignatura' : 'asignaturas'}`
                  }
                  onSelect={() => setOpenSpace(group.id)}
                />
                <span className="pointer-events-none absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-background/70 backdrop-blur">
                  <Layers className={cn('h-3 w-3', marked > 0 ? 'text-primary' : 'text-muted-foreground')} />
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
