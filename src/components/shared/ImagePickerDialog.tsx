import { useRef, useState } from 'react';
import { LoaderCircle, Upload } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import ImageCropper from '@/components/shared/ImageCropper';
import {
  NATIVE_PICTURE_CATEGORIES,
  nativePictureToDataUrl,
  type NativePictureCategory,
} from '@/lib/native-pictures';

// ============================================================
// Selector de imagen unificado de Frame: al presionar un botón de
// "elegir imagen" se abren DOS caminos:
//   1. La galería nativa (categorías arriba, miniaturas abajo).
//   2. "Subir imagen": el usuario escoge su propio archivo.
// En ambos casos devuelve un data-URL, así que quien lo usa lo
// guarda exactamente igual que una imagen subida a mano.
//
// Con `aspect` (ancho/alto del hueco donde se verá), antes de guardar se
// abre el encuadre: zoom y desplazamiento dentro de un marco de esa misma
// proporción (ImageCropper). Sin `aspect`, la imagen se guarda tal cual.
// ============================================================

export default function ImagePickerDialog({
  open,
  onOpenChange,
  onSelect,
  title = 'Elegir imagen',
  aspect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (dataUrl: string) => void | Promise<void>;
  title?: string;
  /** Proporción del hueco de destino: si llega, se encuadra antes de guardar. */
  aspect?: number;
}) {
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const cropping = Boolean(aspect && aspect > 0 && Number.isFinite(aspect));

  /** Imagen elegida: al encuadre, o directa si no hay proporción. */
  const accept = async (dataUrl: string) => {
    if (cropping) {
      setCropSrc(dataUrl);
      return;
    }
    await onSelect(dataUrl);
    onOpenChange(false);
  };

  const saveCrop = async (dataUrl: string) => {
    setSaving(true);
    try {
      await onSelect(dataUrl);
      setCropSrc(null);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };
  const [category, setCategory] = useState<NativePictureCategory['id']>('ciudades');
  const [busySrc, setBusySrc] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const active = NATIVE_PICTURE_CATEGORIES.find((c) => c.id === category)!;

  const handlePick = async (src: string) => {
    if (busySrc) return;
    setBusySrc(src);
    try {
      const dataUrl = await nativePictureToDataUrl(src);
      await accept(dataUrl);
    } finally {
      setBusySrc(null);
    }
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      await accept(reader.result as string);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setCropSrc(null);
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-2xl" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle className="text-xl text-primary font-bold text-center">
            {cropSrc ? 'Encuadra la imagen' : title}
          </DialogTitle>
        </DialogHeader>

        {cropSrc && aspect ? (
          <ImageCropper
            src={cropSrc}
            aspect={aspect}
            busy={saving}
            onCancel={() => setCropSrc(null)}
            onConfirm={saveCrop}
          />
        ) : (
        <>

        {/* Las categorías de la galería nativa */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          {NATIVE_PICTURE_CATEGORIES.map((c) => (
            <Button
              key={c.id}
              size="sm"
              variant={category === c.id ? 'default' : 'fantasma'}
              className="text-xs"
              onClick={() => setCategory(c.id)}
            >
              {c.label}
            </Button>
          ))}
        </div>

        {/* Miniaturas de la categoría activa */}
        <ScrollArea className="h-[340px] rounded-md border p-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {active.pictures.map((pic) => (
              <button
                key={pic.src}
                type="button"
                disabled={!!busySrc}
                onClick={() => void handlePick(pic.src)}
                className={cn(
                  'group relative overflow-hidden rounded-md border border-border/60 text-left transition-all',
                  'hover:border-primary hover:shadow-[0_0_12px_hsl(var(--primary)/0.25)]',
                  busySrc && busySrc !== pic.src && 'opacity-50'
                )}
              >
                <img
                  src={pic.src}
                  alt={pic.label}
                  loading="lazy"
                  className="aspect-video w-full object-cover transition-transform group-hover:scale-105"
                />
                <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-2 pb-1 pt-4 text-[10px] font-semibold text-white">
                  {pic.label}
                </span>
                {busySrc === pic.src && (
                  <span className="absolute inset-0 flex items-center justify-center bg-background/60">
                    <LoaderCircle className="h-5 w-5 animate-spin text-primary" />
                  </span>
                )}
              </button>
            ))}
          </div>
        </ScrollArea>

        <Separator />

        {/* Segunda opción: subir material propio */}
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            ¿Prefieres tu propia imagen? Súbela desde tu equipo.
          </p>
          <Button variant="outline" size="sm" className="text-xs" onClick={() => fileRef.current?.click()}>
            <Upload className="mr-2 h-4 w-4" />
            Subir imagen
          </Button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
        </div>
        </>
        )}
      </DialogContent>
    </Dialog>
  );
}
