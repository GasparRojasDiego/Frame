import { useCallback, useEffect, useRef, useState } from 'react';
import { LoaderCircle, Minus, Move, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

// ============================================================
// Encuadre de una imagen antes de guardarla.
//
// El marco tiene EXACTAMENTE la proporción del hueco donde se va a ver la
// imagen (la tarjeta de la asignatura, la cabecera de la playlist…): lo que
// queda dentro del marco es lo que se verá. Se acerca con la rueda, el
// deslizador o los botones, y se mueve arrastrando. Al guardar se recorta de
// verdad (lienzo), así el resultado se ve igual en cualquier pantalla.
// ============================================================

const MAX_ZOOM = 4;

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
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (dataUrl: string) => void | Promise<void>;
}

export default function ImageCropper({ src, aspect, busy = false, onCancel, onConfirm }: ImageCropperProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [frame, setFrame] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null);
  // Dedos sobre el marco: con dos, se pellizca para acercar (pantallas táctiles).
  const touches = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ distance: number; zoom: number } | null>(null);
  const [saving, setSaving] = useState(false);

  // Marco: tan ancho como quepa, sin pasar de 340 px de alto.
  useEffect(() => {
    const element = frameRef.current?.parentElement;
    if (!element) return;
    const fit = () => {
      const available = element.clientWidth;
      let width = available;
      let height = width / aspect;
      if (height > 340) {
        height = 340;
        width = height * aspect;
      }
      setFrame({ width: Math.round(width), height: Math.round(height) });
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    return () => observer.disconnect();
  }, [aspect]);

  useEffect(() => {
    const img = new Image();
    img.onload = () => setImage(img);
    img.src = src;
    setZoom(1);
    setPos({ x: 0, y: 0 });
  }, [src]);

  // Escala que hace que la imagen CUBRA el marco con zoom 1.
  const base = image && frame.width ? Math.max(frame.width / image.naturalWidth, frame.height / image.naturalHeight) : 1;
  const scale = base * zoom;
  const dispW = image ? image.naturalWidth * scale : 0;
  const dispH = image ? image.naturalHeight * scale : 0;

  const clamp = useCallback(
    (x: number, y: number, s = scale) => {
      if (!image) return { x: 0, y: 0 };
      const maxX = Math.max(0, (image.naturalWidth * s - frame.width) / 2);
      const maxY = Math.max(0, (image.naturalHeight * s - frame.height) / 2);
      return { x: Math.max(-maxX, Math.min(maxX, x)), y: Math.max(-maxY, Math.min(maxY, y)) };
    },
    [image, frame.width, frame.height, scale]
  );

  const setZoomClamped = (next: number) => {
    const z = Math.max(1, Math.min(MAX_ZOOM, next));
    setZoom(z);
    setPos((current) => clamp(current.x, current.y, base * z));
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
    drag.current = { x: pos.x, y: pos.y, startX: event.clientX, startY: event.clientY };
  };
  const onPointerMove = (event: React.PointerEvent) => {
    if (touches.current.has(event.pointerId)) touches.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pinch.current && touches.current.size >= 2) {
      const distance = fingerDistance();
      if (pinch.current.distance > 0 && distance > 0) setZoomClamped((pinch.current.zoom * distance) / pinch.current.distance);
      return;
    }
    if (!drag.current) return;
    setPos(clamp(drag.current.x + event.clientX - drag.current.startX, drag.current.y + event.clientY - drag.current.startY));
  };
  const onPointerUp = (event: React.PointerEvent) => {
    touches.current.delete(event.pointerId);
    if (touches.current.size < 2) pinch.current = null;
    // Si queda un dedo, sigue arrastrando desde donde está.
    const rest = [...touches.current.values()][0];
    drag.current = rest ? { x: pos.x, y: pos.y, startX: rest.x, startY: rest.y } : null;
  };

  const confirm = async () => {
    if (!image || !frame.width) return;
    setSaving(true);
    try {
      const left = frame.width / 2 + pos.x - dispW / 2;
      const top = frame.height / 2 + pos.y - dispH / 2;
      const sx = -left / scale;
      const sy = -top / scale;
      const sw = frame.width / scale;
      const sh = frame.height / scale;
      // Sin agrandar una imagen pequeña más allá de su tamaño real.
      const outW = Math.round(Math.min(OUTPUT_WIDTH, sw * 2, Math.max(sw, 400)));
      const outH = Math.round(outW / aspect);
      const canvas = document.createElement('canvas');
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Sin lienzo');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(image, sx, sy, sw, sh, 0, 0, outW, outH);
      await onConfirm(canvas.toDataURL('image/jpeg', 0.9));
    } finally {
      setSaving(false);
    }
  };

  const working = busy || saving;

  return (
    <div className="space-y-3">
      <div className="flex justify-center">
        <div
          ref={frameRef}
          className="relative cursor-grab touch-none overflow-hidden rounded-lg border-2 border-primary bg-secondary active:cursor-grabbing"
          style={{ width: frame.width || '100%', height: frame.height || 200 }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={(event) => setZoomClamped(zoom - event.deltaY * 0.0015)}
        >
          {image ? (
            <img
              src={src}
              alt=""
              draggable={false}
              className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none"
              style={{
                width: dispW,
                height: dispH,
                transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))`,
              }}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <LoaderCircle className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}
          {/* Guías de tercios para encuadrar. */}
          <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <span key={i} className="border border-white/15" />
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoomClamped(zoom - 0.2)} title="Alejar">
          <Minus className="h-4 w-4" />
        </Button>
        <Slider value={[zoom]} min={1} max={MAX_ZOOM} step={0.01} onValueChange={([value]) => setZoomClamped(value)} className="flex-1" />
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoomClamped(zoom + 0.2)} title="Acercar">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
        <Move className="h-3.5 w-3.5" /> Arrastra para mover; acerca con la rueda, pellizcando o con el deslizador. Lo que
        está dentro del marco es lo que se verá.
      </p>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={working}>
          Elegir otra
        </Button>
        <Button type="button" onClick={() => void confirm()} disabled={working || !image}>
          {working && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
          Guardar
        </Button>
      </div>
    </div>
  );
}
