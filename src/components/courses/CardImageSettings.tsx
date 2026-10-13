import { RotateCcw, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import {
  CARD_IMAGE_MAX,
  CARD_IMAGE_MIN,
  CARD_RATIO_DEFAULT,
  heightAtReference,
  setCardImageHeightAt,
  setCardImageRatio,
  useCardImageRatio,
  useReferenceWidth,
} from '@/lib/card-image-height';
import { tr } from '@/lib/i18n';

/**
 * Engranaje de Asignaturas: el tamaño de la imagen de todas las tarjetas. Se
 * elige como alto en píxeles de las tarjetas de esta interfaz; el resto de la
 * app conserva esa misma proporción (lib/card-image-height.ts).
 */
export default function CardImageSettings() {
  const ratio = useCardImageRatio();
  const width = useReferenceWidth();
  const height = heightAtReference(ratio, width);
  const isDefault = Math.abs(ratio - CARD_RATIO_DEFAULT) < 1e-6;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="icon" variant="fantasma" className="h-9 w-9" title={tr('Ajustes de las tarjetas')}>
          <Settings className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm font-semibold text-foreground">{tr('Alto de las imágenes')}</p>
          <span className="text-xs tabular-nums text-muted-foreground">{height}{' '}{tr('px')}</span>
        </div>
        <Slider
          min={CARD_IMAGE_MIN}
          max={CARD_IMAGE_MAX}
          step={4}
          value={[Math.min(CARD_IMAGE_MAX, Math.max(CARD_IMAGE_MIN, height))]}
          onValueChange={([value]) => setCardImageHeightAt(value, width)}
          aria-label={tr('Alto de la imagen de las tarjetas')}
        />
        <Button
          size="sm"
          variant="gris"
          className="w-full text-xs"
          disabled={isDefault}
          onClick={() => setCardImageRatio(CARD_RATIO_DEFAULT)}
        >
          <RotateCcw className="mr-2 h-3.5 w-3.5" />
          {tr('Valor predeterminado')}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
