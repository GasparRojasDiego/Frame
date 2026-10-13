import { useCallback, useEffect, useRef, useState } from 'react';
import { LoaderCircle, Minus, Move, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { tr } from '@/lib/i18n';

// ============================================================
// Encuadre de una imagen antes de guardarla.
//
// 1.6.6 (Diego): se ve la IMAGEN COMPLETA. Encima, un recuadro con la
// proporción exacta del hueco donde se verá (la tarjeta de la asignatura, la
// cabecera de la playlist, la foto de perfil…): lo de dentro queda a la vista
// y lo de fuera, oscurecido. El recuadro se arrastra para elegir qué parte se
// usa y se achica para acercar (rueda, pellizco, deslizador o botones). Al
// guardar se recorta de verdad (lienzo), así se ve igual en cualquier pantalla.
// ============================================================

const MAX_ZOOM = 4;
/** Alto máximo del escenario donde se ve la imagen entera. */
const STAGE_MAX_H = 360;

/** Proporción (ancho/alto) del hueco donde se verá la imagen, medida en vivo. */
export function aspectOf(element: HTMLElement | null | undefined, fallback = 16 / 9): number {
  const rect = element?.getBoundingClientRect();
  if (!rect || rect.width < 8 || rect.height < 8) return fallback;
  return rect.width / rect.height;
}
/** Ancho del resultado: nítido en pantallas grandes sin pesar demasiado. */
const OUTPUT_WIDTH = 1600;

interface ImageCropperProps {
  src: string;
  /** Proporción ancho/alto del hueco de destino. */
  aspect: number;
  /** Recuadro redondo (foto de perfil). */
  round?: boolean;
  /** Ancho fijo del resultado (p. ej. 256 para la foto de perfil). */
  outputWidth?: number;
  busy?: boolean;
  /** Texto del botón de volver (por defecto, «Elegir otra»). */
  cancelLabel?: string;
  onCancel: () => void;
  onConfirm: (dataUrl: string) => void | Promise<void>;
}

export default function ImageCropper({
  src,
  aspect,
  round = false,
  outputWidth,
  busy = false,
  cancelLabel = tr('Elegir otra'),
  onCancel,
  onConfirm,
}: ImageCropperProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [available, setAvailable] = useState(0);
  const [zoom, setZoom] = useState(1);
  /** Centro del recorte, en píxeles de la imagen original. */
  const [centre, setCentre] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null);
  // Dedos sobre la imagen: con dos, se pellizca para acercar (pantallas táctiles).
  const touches = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ distance: number; zoom: number } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const element = stageRef.current?.parentElement;
    if (!element) return;
    const fit = () => setAvailable(element.clientWidth);
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setImage(img);
      setZoom(1);
      setCentre({ x: img.naturalWidth / 2, y: img.naturalHeight / 2 });
    };
    img.src = src;
  }, [src]);

  const iw = image?.naturalWidth ?? 1;
  const ih = image?.naturalHeight ?? 1;
  // La imagen entera cabe en el escenario.
  const scale = image && available ? Math.min(available / iw, STAGE_MAX_H / ih) : 1;
  const stageW = Math.round(iw * scale);
  const stageH = Math.round(ih * scale);
  // Recorte más grande posible con la proporción pedida, achicado por el zoom.
  const maxCropW = Math.min(iw, ih * aspect);
  const cropW = maxCropW / zoom;
  const cropH = cropW / aspect;

  const clampCentre = useCallback(
    (x: number, y: number, w = cropW, h = cropH) => ({
      x: Math.min(iw - w / 2, Math.max(w / 2, x)),
      y: Math.min(ih - h / 2, Math.max(h / 2, y)),
    }),
    [iw, ih, cropW, cropH]
  );

  const setZoomClamped = (next: number) => {
    const z = Math.max(1, Math.min(MAX_ZOOM, next));
    const w = maxCropW / z;
    setZoom(z);
    setCentre((current) => clampCentre(current.x, current.y, w, w / aspect));
  };

  const fingerDistance = () => {
    const [a, b] = [...touches.current.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  };

  const onPointerDown = (event: React.PointerEvent) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    touches.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (touches.current.size === 2) {
      drag.current = null;
      pinch.current = { distance: fingerDistance(), zoom };
      return;
    }
    drag.current = { x: centre.x, y: centre.y, startX: event.clientX, startY: event.clientY };
  };
  const onPointerMove = (event: React.PointerEvent) => {
    if (touches.current.has(event.pointerId)) touches.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pinch.current && touches.current.size >= 2) {
      const distance = fingerDistance();
      if (pinch.current.distance > 0 && distance > 0) setZoomClamped((pinch.current.zoom * distance) / pinch.current.distance);
      return;
    }
    if (!drag.current || scale <= 0) return;
    // Se arrastra el RECUADRO: sigue al puntero sobre la imagen.
    setCentre(
      clampCentre(
        drag.current.x + (event.clientX - drag.current.startX) / scale,
        drag.current.y + (event.clientY - drag.current.startY) / scale
      )
    );
  };
  const onPointerUp = (event: React.PointerEvent) => {
    touches.current.delete(event.pointerId);
    if (touches.current.size < 2) pinch.current = null;
    // Si queda un dedo, sigue arrastrando desde donde está.
    const rest = [...touches.current.values()][0];
    drag.current = rest ? { x: centre.x, y: centre.y, startX: rest.x, startY: rest.y } : null;
  };

  const confirm = async () => {
    if (!image) return;
    setSaving(true);
    try {
      const sx = centre.x - cropW / 2;
      const sy = centre.y - cropH / 2;
      // Sin agrandar una imagen pequeña más allá de su tamaño real.
      const outW = outputWidth ?? Math.round(Math.min(OUTPUT_WIDTH, cropW * 2, Math.max(cropW, 400)));
      const outH = Math.round(outW / aspect);
      const canvas = document.createElement('canvas');
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error(tr('Sin lienzo'));
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(image, sx, sy, cropW, cropH, 0, 0, outW, outH);
      await onConfirm(canvas.toDataURL('image/jpeg', 0.9));
    } finally {
      setSaving(false);
    }
  };

  const working = busy || saving;
  const box = {
    left: (centre.x - cropW / 2) * scale,
    top: (centre.y - cropH / 2) * scale,
    width: cropW * scale,
    height: cropH * scale,
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-center">
        <div
          ref={stageRef}
          className="relative touch-none overflow-hidden rounded-lg bg-secondary"
          style={{ width: image ? stageW : '100%', height: image ? stageH : 200 }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={(event) => setZoomClamped(zoom - event.deltaY * 0.0015)}
        >
          {image ? (
            <>
              <img
                src={src}
                alt=""
                draggable={false}
                className="pointer-events-none absolute inset-0 h-full w-full select-none"
              />
              {/* El recuadro: dentro, la imagen a la vista; fuera, oscurecida. */}
              <div
                className={cn(
                  'absolute cursor-grab border-2 border-primary active:cursor-grabbing',
                  round ? 'rounded-full' : 'rounded-sm'
                )}
                style={{ ...box, boxShadow: '0 0 0 9999px rgb(0 0 0 / 0.55)' }}
              >
                {/* Guías de tercios para encuadrar. */}
                {!round && (
                  <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
                    {Array.from({ length: 9 }).map((_, i) => (
                      <span key={i} className="border border-white/20" />
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center">
              <LoaderCircle className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoomClamped(zoom - 0.2)} title={tr('Alejar')}>
          <Minus className="h-4 w-4" />
        </Button>
        <Slider value={[zoom]} min={1} max={MAX_ZOOM} step={0.01} onValueChange={([value]) => setZoomClamped(value)} className="flex-1" />
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoomClamped(zoom + 0.2)} title={tr('Acercar')}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
        <Move className="h-3.5 w-3.5" />{' '}{tr('Arrastra el recuadro; acerca con la rueda o el deslizador.')}
      </p>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="gris" onClick={onCancel} disabled={working}>
          {cancelLabel}
        </Button>
        <Button type="button" onClick={() => void confirm()} disabled={working || !image}>
          {working && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
          {tr('Guardar')}
        </Button>
      </div>
    </div>
  );
}
