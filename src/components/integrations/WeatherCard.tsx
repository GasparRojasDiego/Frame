import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Sun,
  Moon,
  Cloud,
  CloudSun,
  CloudFog,
  CloudDrizzle,
  CloudRain,
  CloudSnow,
  CloudLightning,
  Droplets,
  Wind,
  MapPin,
  LoaderCircle,
  Search,
  LocateFixed,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  type WeatherData,
  type WeatherPlace,
  type GeoSource,
  loadWeatherPlace,
  saveWeatherPlace,
  loadWeatherCache,
  fetchWeather,
  searchPlaces,
  locatePlace,
  weatherLabel,
  weatherKind,
  getPlaceImage,
  formatCoords,
  needsNameResolution,
  resolvePlaceName,
} from '@/lib/weather';

const KIND_ICON = {
  sun: Sun,
  moon: Moon,
  partly: CloudSun,
  cloud: Cloud,
  fog: CloudFog,
  drizzle: CloudDrizzle,
  rain: CloudRain,
  snow: CloudSnow,
  storm: CloudLightning,
} as const;

function WeatherIcon({ code, isDay, className }: { code: number; isDay: boolean; className?: string }) {
  const Icon = KIND_ICON[weatherKind(code, isDay)];
  return <Icon className={className} />;
}

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const SOURCE_LABEL: Record<GeoSource, string> = {
  bigdatacloud: 'Ubicación GPS · nombre por BigDataCloud',
  photon: 'Ubicación GPS · nombre por Photon (OpenStreetMap)',
  nominatim: 'Ubicación GPS · nombre por Nominatim (OpenStreetMap)',
  ip: 'Ubicación aproximada por IP: puede desviarse decenas de kilómetros',
  manual: 'Ciudad elegida manualmente',
  coords: 'Sin nombre disponible: se muestran las coordenadas',
};

function placeSourceLabel(p: WeatherPlace): string {
  if (p.source) return SOURCE_LABEL[p.source];
  return p.auto ? 'Ubicación detectada automáticamente' : SOURCE_LABEL.manual;
}

/** "Distrito de Miraflores, Lima": lo justo para reconocer el sitio de un vistazo. */
function placeShortLabel(p: WeatherPlace): string {
  return [p.locality && p.locality !== p.name ? p.locality : null, p.name].filter(Boolean).join(', ');
}

/** "Distrito de Miraflores · Lima · Perú": detalle completo, sin repetir partes. */
function placeFullLabel(p: WeatherPlace): string {
  const parts = [p.locality, p.name, p.admin, p.country].filter((v): v is string => !!v);
  return parts.filter((v, i) => parts.indexOf(v) === i).join(' · ');
}

// Tarjeta de clima del Inicio (Open-Meteo, sin clave de API, con caché offline).
export default function WeatherCard() {
  const { toast } = useToast();
  const [place, setPlace] = useState<WeatherPlace | null>(() => loadWeatherPlace());
  const [weather, setWeather] = useState<WeatherData | null>(() => loadWeatherCache());
  const [isLoading, setIsLoading] = useState(false);
  const [isPickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<WeatherPlace[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [autoFailed, setAutoFailed] = useState(false);
  const [placeImage, setPlaceImage] = useState<string | null>(null);
  const [isResolvingName, setIsResolvingName] = useState(false);

  const refresh = useCallback(
    async (p: WeatherPlace) => {
      if (!navigator.onLine) return; // offline: se queda la caché
      setIsLoading(true);
      try {
        setWeather(await fetchWeather(p));
      } catch (e: any) {
        toast({ variant: 'destructive', title: 'Clima', description: String(e.message ?? e) });
      } finally {
        setIsLoading(false);
      }
    },
    [toast]
  );

  // Ubicación automática al montar: GPS de alta precisión → IP → manual.
  // Solo se salta si el usuario fijó una ciudad a mano (place sin `auto`).
  useEffect(() => {
    const current = loadWeatherPlace();
    if (current && !current.auto) return;
    if (!navigator.onLine) return; // offline: se queda lo guardado
    setIsLocating(true);
    void locatePlace().then((detected) => {
      setIsLocating(false);
      if (detected) {
        // Evita re-render/fetch si sigue siendo prácticamente el mismo punto,
        // salvo que la detección nueva traiga datos que la guardada no tenía
        // (nombre real ya resuelto o precisión del GPS).
        const moved =
          !current ||
          Math.abs(current.latitude - detected.latitude) > 0.01 ||
          Math.abs(current.longitude - detected.longitude) > 0.01;
        const enriches =
          !!current &&
          ((!current.resolved && !!detected.resolved) ||
            (current.accuracy == null && detected.accuracy != null));
        if (moved || enriches) {
          saveWeatherPlace(detected);
          setPlace(detected);
        }
      } else if (!current) {
        setAutoFailed(true); // sin GPS ni IP: se pide la ciudad manualmente
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Nombre real del lugar: si la geocodificación inversa falló en su momento —o el
  // lugar viene de una versión anterior que guardaba el texto fijo "Mi ubicación"—
  // se reintenta aquí y el nombre corregido queda guardado. El anti-bucle lo
  // garantiza `needsNameResolution`: tras un éxito `resolved` es true y tras un
  // fallo `resolvedAt` es reciente, así que la siguiente evaluación da false.
  useEffect(() => {
    if (!place || !needsNameResolution(place) || !navigator.onLine) return;
    let cancelled = false;
    setIsResolvingName(true);
    void resolvePlaceName(place)
      .then((fixed) => {
        if (cancelled || !fixed) return;
        saveWeatherPlace(fixed);
        setPlace(fixed);
      })
      .finally(() => {
        if (!cancelled) setIsResolvingName(false);
      });
    return () => {
      cancelled = true;
    };
  }, [place]);

  // El refresco depende sólo de las COORDENADAS: corregir el nombre del lugar no
  // debe disparar una consulta extra a Open-Meteo por el mismo punto.
  const placeKey = place ? `${place.latitude},${place.longitude}` : null;
  const placeRef = useRef(place);
  useEffect(() => {
    placeRef.current = place;
  }, [place]);

  // Refresca al montar y cada 30 minutos.
  useEffect(() => {
    const current = placeRef.current;
    if (!current) return;
    void refresh(current);
    const interval = setInterval(() => {
      const p = placeRef.current;
      if (p) void refresh(p);
    }, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [placeKey, refresh]);

  // Foto del lugar: se cachea sola, así que en las próximas visitas aparece al instante.
  useEffect(() => {
    if (!place) {
      setPlaceImage(null);
      return;
    }
    let cancelled = false;
    void getPlaceImage(place).then((url) => {
      if (!cancelled) setPlaceImage(url);
    });
    return () => {
      cancelled = true;
    };
  }, [place]);

  const handleSearch = async () => {
    if (query.trim().length < 2) return;
    setIsSearching(true);
    try {
      setResults(await searchPlaces(query.trim()));
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Clima', description: String(e.message ?? e) });
    } finally {
      setIsSearching(false);
    }
  };

  const handlePick = (p: WeatherPlace) => {
    saveWeatherPlace(p);
    setPlace(p);
    setPickerOpen(false);
    setQuery('');
    setResults([]);
  };

  // Botón "Usar mi ubicación" del diálogo: vuelve al modo automático.
  const handleUseMyLocation = async () => {
    setIsLocating(true);
    try {
      const detected = await locatePlace();
      if (detected) {
        handlePick(detected);
        // El diálogo se cierra al elegir, así que la confirmación va por aviso:
        // es el momento exacto en que el usuario quiere comprobar el acierto.
        toast({
          title: 'Clima',
          description: detected.resolved
            ? `Ubicación detectada: ${placeFullLabel(detected)}${
                detected.accuracy != null ? ` (±${Math.round(detected.accuracy)} m)` : ''
              }`
            : 'Ubicación detectada, pero no se pudo obtener el nombre del lugar. Se muestran las coordenadas.',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Clima',
          description: 'No se pudo detectar tu ubicación. Busca tu ciudad manualmente.',
        });
      }
    } finally {
      setIsLocating(false);
    }
  };

  return (
    <>
      <Card className="relative overflow-hidden">
        {place && placeImage && (
          <div className="pointer-events-none absolute inset-y-0 right-0 w-36 sm:w-48 md:w-56">
            <img src={placeImage} alt="" className="h-full w-full object-cover" draggable={false} />
            <div className="absolute inset-0 bg-gradient-to-r from-card via-card/70 to-transparent" />
          </div>
        )}
        <CardContent className="relative z-10 p-4">
          {!place ? (
            isLocating ? (
              <div className="flex items-center justify-center gap-3 py-4 text-muted-foreground sm:py-2">
                <LoaderCircle className="h-6 w-6 animate-spin text-primary" />
                <p className="text-sm">Detectando tu ubicación…</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 py-4 sm:flex-row sm:justify-between sm:py-2">
                <div className="flex items-center gap-3 text-muted-foreground">
                  <CloudSun className="h-8 w-8 text-primary" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Pronóstico del clima</p>
                    <p className="text-xs">
                      {autoFailed
                        ? 'No pudimos detectar tu ubicación: elige tu ciudad.'
                        : 'Elige tu ciudad para ver el pronóstico en tu Inicio.'}
                    </p>
                  </div>
                </div>
                <Button size="sm" className="text-xs" onClick={() => setPickerOpen(true)} data-tour="clima-ubicacion">
                  <MapPin className="mr-2 h-4 w-4" />
                  Elegir ubicación
                </Button>
              </div>
            )
          ) : (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              {/* Actual */}
              <div className="flex items-center gap-4">
                {weather ? (
                  <WeatherIcon
                    code={weather.current.weatherCode}
                    isDay={weather.current.isDay}
                    className="h-12 w-12 text-primary"
                  />
                ) : (
                  <LoaderCircle className="h-12 w-12 animate-spin text-primary" />
                )}
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-foreground font-headline">
                      {weather ? `${weather.current.temperature}°` : '--°'}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {weather ? weatherLabel(weather.current.weatherCode) : 'Cargando…'}
                    </span>
                  </div>
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          className="flex max-w-[24ch] items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-primary sm:max-w-[34ch]"
                          onClick={() => setPickerOpen(true)}
                          data-tour="clima-ubicacion"
                        >
                          {isResolvingName ? (
                            <LoaderCircle className="h-3 w-3 shrink-0 animate-spin text-primary" />
                          ) : place.auto ? (
                            <LocateFixed className="h-3 w-3 shrink-0 text-primary" />
                          ) : (
                            <MapPin className="h-3 w-3 shrink-0" />
                          )}
                          <span className="truncate">
                            {isResolvingName ? 'Identificando el lugar…' : placeShortLabel(place)}
                          </span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-xs space-y-0.5 text-xs">
                        <p className="font-semibold text-foreground">{placeFullLabel(place)}</p>
                        <p className="text-muted-foreground">
                          {formatCoords(place.latitude, place.longitude)}
                        </p>
                        {place.accuracy != null && (
                          <p className="text-muted-foreground">
                            Precisión GPS: ±{Math.round(place.accuracy)} m
                          </p>
                        )}
                        <p className="text-muted-foreground">{placeSourceLabel(place)}</p>
                        <p className="pt-1 text-muted-foreground opacity-80">
                          Clic para cambiar la ubicación
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                {weather && (
                  <div className="hidden flex-col gap-1 pl-4 text-xs text-muted-foreground md:flex">
                    <span className="flex items-center gap-1.5">
                      <Droplets className="h-3.5 w-3.5 text-primary" /> {weather.current.humidity}% humedad
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Wind className="h-3.5 w-3.5 text-primary" /> {weather.current.windSpeed} km/h
                    </span>
                    <span>Sensación: {weather.current.apparent}°</span>
                  </div>
                )}
              </div>

              {/* Próximas horas: ocupa el hueco entre lo actual y los días.
                  Truco de ajuste: la fila envuelve y solo se ve la primera
                  línea, así caben tantas horas como ancho haya (4, 6, 8…)
                  sin medir nada ni cortar una tarjeta por la mitad. */}
              {weather?.hourly && weather.hourly.length > 0 && (
                <div
                  className={cn(
                    'hidden h-[66px] min-w-0 flex-1 flex-wrap justify-center gap-1 overflow-hidden border-x border-border/60 px-3 md:flex',
                    isLoading && 'opacity-60'
                  )}
                  aria-label="Pronóstico de las próximas horas"
                >
                  {weather.hourly.map((hour) => (
                    <div
                      key={hour.time}
                      className="flex h-[66px] w-[52px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-md border border-border/60"
                      title={`${weatherLabel(hour.weatherCode)} · ${hour.precipProb}% lluvia`}
                    >
                      <span className="text-[10px] font-semibold text-muted-foreground">
                        {hour.time.slice(11, 16)}
                      </span>
                      <WeatherIcon code={hour.weatherCode} isDay={hour.isDay} className="h-[18px] w-[18px] text-primary" />
                      <span className="text-[11px] font-semibold leading-none text-foreground">{hour.temperature}°</span>
                      <span className="text-[9px] leading-none text-muted-foreground">{hour.precipProb}%</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Próximos días */}
              {weather && (
                <div className={cn('flex items-center gap-1', isLoading && 'opacity-60')}>
                  {weather.daily.slice(1, 6).map((day) => {
                    const d = new Date(`${day.date}T12:00:00`);
                    return (
                      <div
                        key={day.date}
                        className="flex w-14 flex-col items-center gap-1 rounded-md bg-secondary/50 py-2"
                        title={`${weatherLabel(day.weatherCode)} · ${day.precipProb}% lluvia`}
                      >
                        <span className="text-[10px] font-semibold text-muted-foreground">
                          {DAY_NAMES[d.getDay()]}
                        </span>
                        <WeatherIcon code={day.weatherCode} isDay className="h-5 w-5 text-primary" />
                        <span className="text-[11px] font-semibold text-foreground">
                          {day.tMax}° <span className="text-muted-foreground">{day.tMin}°</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selector de ubicación */}
      <Dialog open={isPickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl text-primary font-bold text-center">Ubicación del clima</DialogTitle>
            <DialogDescription className="text-center">
              Detección automática por GPS, o busca tu ciudad manualmente.
            </DialogDescription>
          </DialogHeader>
          <Button
            variant="outline"
            className="w-full border-primary/60 text-primary hover:bg-primary/10 hover:text-primary"
            onClick={() => void handleUseMyLocation()}
            disabled={isLocating}
          >
            {isLocating ? (
              <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <LocateFixed className="mr-2 h-4 w-4" />
            )}
            Usar mi ubicación (GPS)
          </Button>
          {place?.auto && (
            <p className="text-center text-xs text-muted-foreground">
              Detectado: <span className="font-medium text-foreground">{placeFullLabel(place)}</span>
              <br />
              <span className="opacity-80">
                {formatCoords(place.latitude, place.longitude)}
                {place.accuracy != null ? ` · ±${Math.round(place.accuracy)} m` : ''}
              </span>
            </p>
          )}
          <div className="relative">
            <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
            <span className="relative mx-auto block w-fit bg-card px-2 text-xs text-muted-foreground">o</span>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Ej: Lima, Madrid, Bogotá…" data-tour="clima-buscar"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void handleSearch()}
              className="bg-card border-primary"
            />
            <Button onClick={() => void handleSearch()} disabled={isSearching || query.trim().length < 2}>
              {isSearching ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
          {results.length > 0 && (
            <div className="mt-2 space-y-1">
              {results.map((r, i) => (
                <button
                  key={`${r.latitude}-${r.longitude}-${i}`}
                  className="w-full rounded-md p-2.5 text-left text-sm transition-colors hover:bg-secondary/60"
                  onClick={() => handlePick(r)}
                >
                  <span className="font-medium text-foreground">{r.name}</span>
                  <span className="text-muted-foreground">
                    {r.admin ? ` · ${r.admin}` : ''}
                    {r.country ? ` · ${r.country}` : ''}
                  </span>
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
