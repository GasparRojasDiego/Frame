import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { EchoHeader } from '@/components/shared/EchoWord';
import { cn } from '@/lib/utils';
import { tr } from '@/lib/i18n';

// ============================================================
// Selector de color (1.6.7): un recuadro centrado, como los de los programas
// de diseño. Cuadro de saturación y brillo, barras de tono y de transparencia
// (las tres se arrastran o se mueven con el teclado), los valores HEX, R, G,
// B y A para escribirlos a mano, la paleta de Frame como atajo y, arriba, el
// color anterior junto al nuevo.
//
// Devuelve hex de 6 dígitos (opaco) o de 8 (con alfa), el mismo formato que
// guardan los eventos del calendario. Sin dependencias.
// ============================================================

interface Hsva {
  h: number; // 0..360
  s: number; // 0..1
  v: number; // 0..1
  a: number; // 0..1
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const hex2 = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0').toUpperCase();

function hsvToRgb({ h, s, v }: Hsva): [number, number, number] {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return [f(5) * 255, f(3) * 255, f(1) * 255];
}

function rgbToHsv(r: number, g: number, b: number): Omit<Hsva, 'a'> {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const d = max - Math.min(rn, gn, bn);
  let h = 0;
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
  }
  return { h: (h * 60 + 360) % 360, s: max === 0 ? 0 : d / max, v: max };
}

/** «#RGB», «#RRGGBB» o «#RRGGBBAA» → HSVA; null si no es un color. */
function parseHexColor(value: string): Hsva | null {
  let hex = value.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(hex)) hex = hex.split('').map((c) => c + c).join('');
  if (!/^([0-9a-f]{6}|[0-9a-f]{8})$/i.test(hex)) return null;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
  return { ...rgbToHsv(r, g, b), a };
}

function toHex(color: Hsva): string {
  const [r, g, b] = hsvToRgb(color);
  const alpha = Math.round(color.a * 255);
  return `#${hex2(r)}${hex2(g)}${hex2(b)}${alpha >= 255 ? '' : hex2(alpha)}`;
}

const CHECKER =
  'repeating-conic-gradient(hsl(var(--muted-foreground) / 0.25) 0% 25%, transparent 0% 50%) 50% / 10px 10px';

/** Superficie que se arrastra: devuelve la posición del puntero en 0..1. */
function useDrag(onMove: (x: number, y: number) => void) {
  const ref = useRef<HTMLDivElement>(null);
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    onMove(clamp((event.clientX - rect.left) / rect.width, 0, 1), clamp((event.clientY - rect.top) / rect.height, 0, 1));
  };
  return {
    ref,
    onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId);
      move(event);
    },
    onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) move(event);
    },
  };
}

function Slider({
  label,
  value,
  max,
  step,
  background,
  thumbColor,
  onChange,
  format,
}: {
  label: string;
  value: number;
  max: number;
  step: number;
  background: string;
  thumbColor: string;
  onChange: (next: number) => void;
  format: (value: number) => string;
}) {
  const drag = useDrag((x) => onChange(x * max));
  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const delta = event.key === 'ArrowRight' || event.key === 'ArrowUp' ? step : event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -step : 0;
    if (!delta) return;
    event.preventDefault();
    onChange(clamp(value + delta * (event.shiftKey ? 10 : 1), 0, max));
  };
  return (
    <div
      {...drag}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.round(value)}
      aria-valuetext={format(value)}
      onKeyDown={onKey}
      className="relative h-3.5 cursor-pointer touch-none rounded-full outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      style={{ background }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgb(0_0_0/0.35),0_2px_6px_rgb(0_0_0/0.35)]"
        style={{ left: `${(value / max) * 100}%`, background: thumbColor }}
      />
    </div>
  );
}

export default function ColorPickerDialog({
  open,
  onOpenChange,
  value,
  onChange,
  presets,
  title = tr('Color'),
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string;
  onChange: (hex: string) => void;
  /** Muestras de la paleta (filas). */
  presets?: string[][];
  title?: string;
}) {
  const [color, setColor] = useState<Hsva>(() => parseHexColor(value) ?? { h: 220, s: 0.3, v: 1, a: 1 });
  const [hexText, setHexText] = useState(value.toUpperCase());

  // Cada vez que se abre, parte del color actual.
  useEffect(() => {
    if (!open) return;
    const parsed = parseHexColor(value) ?? { h: 220, s: 0.3, v: 1, a: 1 };
    setColor(parsed);
    setHexText(toHex(parsed));
  }, [open, value]);

  const update = (next: Hsva) => {
    setColor(next);
    setHexText(toHex(next));
  };

  const [r, g, b] = hsvToRgb(color).map(Math.round);
  const opaque = `rgb(${r} ${g} ${b})`;
  const current = toHex(color);
  const square = useDrag((x, y) => update({ ...color, s: x, v: 1 - y }));
  const onSquareKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 0.1 : 0.01;
    const moves: Record<string, Partial<Hsva>> = {
      ArrowLeft: { s: clamp(color.s - step, 0, 1) },
      ArrowRight: { s: clamp(color.s + step, 0, 1) },
      ArrowUp: { v: clamp(color.v + step, 0, 1) },
      ArrowDown: { v: clamp(color.v - step, 0, 1) },
    };
    if (!moves[event.key]) return;
    event.preventDefault();
    update({ ...color, ...moves[event.key] });
  };

  const setChannel = (index: 0 | 1 | 2, raw: string) => {
    const n = clamp(Number(raw.replace(/[^\d]/g, '')) || 0, 0, 255);
    const rgb = [r, g, b];
    rgb[index] = n;
    update({ ...rgbToHsv(rgb[0], rgb[1], rgb[2]), a: color.a });
  };

  const commitHex = (text: string) => {
    const parsed = parseHexColor(text);
    if (parsed) update(parsed);
    else setHexText(current);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <EchoHeader word={tr('Color')}>
          <DialogHeader>
            <DialogTitle className="text-center text-xl font-bold text-primary">{title}</DialogTitle>
            <DialogDescription className="sr-only">
              {tr('Elige el color en el cuadro y las barras, escribe sus valores o toma uno de la paleta.')}
            </DialogDescription>
          </DialogHeader>
        </EchoHeader>

        <div className="space-y-4">
          {/* Antes y después */}
          <div className="flex h-9 overflow-hidden rounded-md border border-border" style={{ background: CHECKER }}>
            <span className="flex-1" style={{ background: value }} title={tr('Color actual')} />
            <span className="flex-1" style={{ background: current }} title={tr('Color nuevo')} />
          </div>

          {/* Saturación (horizontal) y brillo (vertical) del tono elegido */}
          <div
            {...square}
            role="slider"
            tabIndex={0}
            aria-label={tr('Saturación y brillo')}
            aria-valuetext={tr('Saturación {p} %, brillo {p2} %', { p: Math.round(color.s * 100), p2: Math.round(color.v * 100) })}
            onKeyDown={onSquareKey}
            className="relative h-44 cursor-crosshair touch-none rounded-md outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            style={{
              background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${color.h} 100% 50%))`,
            }}
          >
            <span
              aria-hidden
              className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgb(0_0_0/0.4)]"
              style={{ left: `${color.s * 100}%`, top: `${(1 - color.v) * 100}%`, background: opaque }}
            />
          </div>

          <Slider
            label={tr('Tono')}
            value={color.h}
            max={360}
            step={1}
            background="linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)"
            thumbColor={`hsl(${color.h} 100% 50%)`}
            onChange={(h) => update({ ...color, h })}
            format={(h) => `${Math.round(h)}°`}
          />
          <Slider
            label={tr('Transparencia')}
            value={color.a * 100}
            max={100}
            step={1}
            background={`linear-gradient(to right, transparent, ${opaque}), ${CHECKER}`}
            thumbColor={opaque}
            onChange={(a) => update({ ...color, a: a / 100 })}
            format={(a) => `${Math.round(a)} %`}
          />

          {/* Valores exactos */}
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-1.5">
            {[
              { label: 'HEX', value: hexText },
              { label: 'R', value: String(r) },
              { label: 'G', value: String(g) },
              { label: 'B', value: String(b) },
              { label: 'A', value: String(Math.round(color.a * 100)) },
            ].map((field, index) => (
              <label key={field.label} className="space-y-1 text-center">
                <span className="block text-[10px] font-semibold text-muted-foreground">{field.label}</span>
                <Input
                  value={field.value}
                  inputMode={index === 0 ? 'text' : 'numeric'}
                  spellCheck={false}
                  className="h-8 px-1.5 text-center font-mono text-xs"
                  onChange={(event) => {
                    const text = event.target.value;
                    if (index === 0) setHexText(text.toUpperCase());
                    else if (index === 4) update({ ...color, a: clamp(Number(text.replace(/[^\d]/g, '')) || 0, 0, 100) / 100 });
                    else setChannel((index - 1) as 0 | 1 | 2, text);
                  }}
                  onBlur={index === 0 ? (event) => commitHex(event.target.value) : undefined}
                  onKeyDown={index === 0 ? (event) => event.key === 'Enter' && commitHex((event.target as HTMLInputElement).value) : undefined}
                />
              </label>
            ))}
          </div>

          {presets && presets.length > 0 && (
            <div className="space-y-1.5">
              {presets.map((row, rowIndex) => (
                <div key={rowIndex} className="grid grid-cols-8 gap-1.5">
                  {row.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => {
                        const parsed = parseHexColor(hex);
                        if (parsed) update(parsed);
                      }}
                      aria-label={tr('Color {hex}', { hex })}
                      title={hex}
                      className={cn(
                        'h-6 rounded-md border border-black/10 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-white/15',
                        current.toUpperCase() === hex.toUpperCase() && 'ring-2 ring-primary ring-offset-1 ring-offset-background'
                      )}
                      style={{ background: hex }}
                    />
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="gris" onClick={() => onOpenChange(false)}>
            {tr('Cancelar')}
          </Button>
          <Button
            onClick={() => {
              onChange(current);
              onOpenChange(false);
            }}
          >
            {tr('Usar este color')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
