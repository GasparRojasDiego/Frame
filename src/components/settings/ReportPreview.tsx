import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { renderDocHtml, type DocModel } from '@/lib/report-doc';

// ============================================================
// Vista previa REAL del informe: el mismo HTML que se imprime como PDF
// (renderDocHtml), partido en páginas A4 y mostrado de dos en dos.
//
// Cómo se pagina sin imprimir: el cuerpo del documento se vierte en columnas
// del tamaño exacto del área útil de una hoja A4 (210 × 297 mm menos los
// márgenes de @page, 15 × 13 mm; el documento usa border-box, así que el
// cuerpo mide la hoja entera y el margen va por dentro). Las columnas CSS respetan las mismas reglas
// de corte que la impresión (no partir filas ni figuras, saltos forzados en
// `.brk`), así que cada columna es una página tal como saldrá. Cada página es
// un iframe del documento desplazado hasta su columna y reducido a escala.
// ============================================================

const MM = 96 / 25.4;
const PAGE_W = 210 * MM;
const PAGE_H = 297 * MM;
const MARGIN_X = 13 * MM;
const MARGIN_Y = 15 * MM;
const COLUMN_W = PAGE_W - 2 * MARGIN_X;
const COLUMN_H = PAGE_H - 2 * MARGIN_Y;
/** De una columna a la siguiente hay exactamente un ancho de hoja. */
const GAP = 2 * MARGIN_X;

/** El documento con la maquetación de «hoja»: columnas = páginas. */
function pagedHtml(html: string, page: number): string {
  const css = `
    html, body { margin: 0 !important; overflow: hidden !important; background: #fff; }
    body { box-sizing: border-box; padding: ${MARGIN_Y}px ${MARGIN_X}px !important; width: ${PAGE_W}px; height: ${PAGE_H}px; }
    .frame-pages { width: ${COLUMN_W}px; height: ${COLUMN_H}px; column-width: ${COLUMN_W}px; column-gap: ${GAP}px; column-fill: auto;
      transform: translateX(${-page * PAGE_W}px); }
    .brk { break-before: column; }
    tr, .fig { break-inside: avoid; }
    h1, h2, h3 { break-after: avoid; }`;
  return html
    .replace('</head>', `<style>${css}</style></head>`)
    .replace(/<body([^>]*)>/, '<body$1><div class="frame-pages">')
    .replace('</body>', '</div></body>');
}

export default function ReportPreview({ doc, fill = false }: { doc: DocModel | null; fill?: boolean }) {
  // El documento cambia con cada filtro: se espera a que el usuario pare de
  // tocar para no repaginar en cada clic.
  const [html, setHtml] = useState<string | null>(null);
  useEffect(() => {
    if (!doc) return;
    const timer = window.setTimeout(() => setHtml(renderDocHtml(doc)), 180);
    return () => window.clearTimeout(timer);
  }, [doc]);

  // Cuántas páginas salen: se mide en un iframe oculto con todo el documento.
  const [pages, setPages] = useState(0);
  const probe = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    const frame = probe.current;
    if (!frame || html === null) return;
    const measure = () => {
      const box = frame.contentDocument?.querySelector('.frame-pages') as HTMLElement | null;
      if (!box) return;
      setPages(Math.max(1, Math.round((box.scrollWidth + GAP) / PAGE_W)));
    };
    frame.addEventListener('load', measure, { once: true });
    frame.srcdoc = pagedHtml(html, 0);
    return () => frame.removeEventListener('load', measure);
  }, [html]);

  // Escala de cada hoja: dos por fila, al ancho que tenga el recuadro.
  const grid = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4);
  useLayoutEffect(() => {
    const element = grid.current;
    if (!element) return;
    const update = () => {
      const gap = 16;
      const width = (element.clientWidth - gap) / 2;
      if (width > 0) setScale(Math.min(0.75, width / PAGE_W));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const sources = useMemo(
    () => (html === null ? [] : Array.from({ length: pages }, (_, index) => pagedHtml(html, index))),
    [html, pages]
  );

  return (
    <div className={cn('relative', fill && 'flex min-h-0 flex-1 flex-col')}>
      <iframe ref={probe} title="" aria-hidden tabIndex={-1} className="pointer-events-none fixed -left-[9999px] top-0 opacity-0"
        style={{ width: PAGE_W, height: PAGE_H }} />
      {/* `fill`: ocupa el alto que le deje su recuadro (Informes en Ajustes, 1.6.6). */}
      <ScrollArea className={cn('rounded-lg border border-border/70 bg-muted/40', fill ? 'min-h-0 flex-1' : 'h-[min(30rem,60vh)]')}>
        <div ref={grid} className="grid grid-cols-2 gap-4 p-4" data-tour="informe-vista">
          {sources.length === 0 ? (
            <div className="col-span-2 flex h-60 items-center justify-center">
              <LoaderCircle className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : (
            sources.map((source, index) => (
              <figure key={index} className="m-0 flex flex-col items-center gap-1.5">
                <div
                  className="overflow-hidden rounded-sm bg-white shadow-md ring-1 ring-black/10"
                  style={{ width: PAGE_W * scale, height: PAGE_H * scale }}
                >
                  <iframe
                    title={`Página ${index + 1}`}
                    srcDoc={source}
                    tabIndex={-1}
                    className="pointer-events-none origin-top-left border-0"
                    style={{ width: PAGE_W, height: PAGE_H, transform: `scale(${scale})` }}
                  />
                </div>
                <figcaption className="text-[10px] tabular-nums text-muted-foreground">
                  {index + 1} / {sources.length}
                </figcaption>
              </figure>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
