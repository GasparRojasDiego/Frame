import { RotateCcw, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import {
  CARD_IMAGE_DEFAULT,
  CARD_IMAGE_MAX,
  CARD_IMAGE_MIN,
  setCardImageHeight,
  useCardImageHeight,
} from '@/lib/card-image-height';

/** Engranaje de Asignaturas: el alto de la imagen de todas las tarjetas. */
export default function CardImageSettings() {
  const height = useCardImageHeight();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="icon" variant="fantasma" className="h-9 w-9" title="Ajustes de las tarjetas" data-tour="asig-ajustes">
          <Settings className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm font-semibold text-foreground">Alto de las imágenes</p>
          <span className="text-xs tabular-nums text-muted-foreground">{height} px</span>
        </div>
        <Slider
          min={CARD_IMAGE_MIN}
          max={CARD_IMAGE_MAX}
          step={4}
          value={[height]}
          onValueChange={([value]) => setCardImageHeight(value)}
          aria-label="Alto de la imagen de las tarjetas"
        />
        <Button
          size="sm"
          variant="gris"
          className="w-full text-xs"
          disabled={height === CARD_IMAGE_DEFAULT}
          onClick={() => setCardImageHeight(CARD_IMAGE_DEFAULT)}
        >
          <RotateCcw className="mr-2 h-3.5 w-3.5" />
          Valor predeterminado
        </Button>
      </PopoverContent>
    </Popover>
  );
}
