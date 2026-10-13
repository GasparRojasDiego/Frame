// Pronóstico del clima para Frame vía Open-Meteo: el proveedor abierto más
// preciso que puede integrarse sin clave de API (modelos ECMWF/GFS/ICON
// combinados con selección automática del mejor modelo por región).
// Cachea la última respuesta para funcionar offline.
//
// El NOMBRE del lugar detectado automáticamente lo resuelve
// `@/lib/reverse-geocode` (Open-Meteo sólo hace geocoding directo).
import { cleanCountryCode, reverseGeocode, formatCoords, type GeoSource } from '@/lib/reverse-geocode';
import { activeProfileId, weatherCacheKey, weatherImagesKey, weatherPlaceKey } from '@/lib/profile-scope';
import { getLang, tr, type Lang } from '@/lib/i18n';

export { formatCoords };
export type { GeoSource };

export interface WeatherCurrent {
  temperature: number;
  apparent: number;
  humidity: number;
  weatherCode: number;
  isDay: boolean;
  windSpeed: number;
}

export interface WeatherDay {
  date: string; // YYYY-MM-DD
  tMax: number;
  tMin: number;
  weatherCode: number;
  precipProb: number;
}

/** Un punto del pronóstico por horas (hora local del lugar). */
export interface WeatherHour {
  time: string; // YYYY-MM-DDTHH:00
  temperature: number;
  weatherCode: number;
  isDay: boolean;
  precipProb: number;
}

export interface WeatherData {
  current: WeatherCurrent;
  daily: WeatherDay[];
  /** Próximas horas, de tres en tres. Opcional: la caché anterior a la 1.4.8 no lo trae. */
  hourly?: WeatherHour[];
  fetchedAt: number;
}

/** Cada cuántas horas se muestra un punto del pronóstico del día. */
const HOURLY_STEP = 3;

export interface WeatherPlace {
  name: string;
  admin?: string;
  country?: string;
  /** Código ISO del país (1.6.9). Los lugares guardados antes no lo tienen. */
  countryCode?: string;
  latitude: number;
  longitude: number;
  /** true si la ubicación se detectó automáticamente (GPS o IP) */
  auto?: boolean;
  /** Distrito/barrio: permite corroborar de un vistazo la precisión del GPS. */
  locality?: string;
  /** Precisión del GPS en metros (navigator.geolocation coords.accuracy). */
  accuracy?: number;
  /** true si `name` viene de geocodificación inversa real (no de coordenadas). */
  resolved?: boolean;
  /** Proveedor que resolvió el nombre (diagnóstico en el tooltip). */
  source?: GeoSource;
  /** epoch ms del último INTENTO de resolución (evita bucles y reintenta a las 6 h). */
  resolvedAt?: number;
  /** Último idioma con el que se intentó (evita reintentar sin red en bucle). */
  langTriedAt?: Lang;
  /** Idioma de los nombres (1.6.7). Ausente: español. Al cambiar el idioma de
   *  la interfaz, el lugar se vuelve a nombrar en el nuevo. */
  lang?: Lang;
}

// El lugar, el pronóstico guardado y las fotos del lugar son del perfil
// (1.6.7): otra cuenta de este equipo nunca ve la ciudad de esta.
const profileOrNone = () => activeProfileId() ?? 'sin-perfil';
const placeKey = () => weatherPlaceKey(profileOrNone());
const cacheKey = () => weatherCacheKey(profileOrNone());

export function loadWeatherPlace(): WeatherPlace | null {
  try {
    const raw = localStorage.getItem(placeKey());
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Aviso de que cambió el lugar del clima (aquí o desde otro dispositivo). */
export const WEATHER_PLACE_EVENT = 'frame:weather-place';

export function saveWeatherPlace(place: WeatherPlace) {
  localStorage.setItem(placeKey(), JSON.stringify(place));
  window.dispatchEvent(new Event(WEATHER_PLACE_EVENT));
}

export function loadWeatherCache(): WeatherData | null {
  try {
    const raw = localStorage.getItem(cacheKey());
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// ---------------- Ubicación automática ----------------

/** Coordenadas GPS de alta precisión del dispositivo (o null si no hay permiso/señal). */
function getGpsCoords(): Promise<{ latitude: number; longitude: number; accuracy?: number } | null> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : undefined,
        }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 5 * 60 * 1000 }
    );
  });
}

/** Construye un lugar automático resolviendo el nombre real del sitio. */
async function buildAutoPlace(
  latitude: number,
  longitude: number,
  opts: { accuracy?: number; ipSource?: boolean } = {}
): Promise<WeatherPlace> {
  const named = await reverseGeocode(latitude, longitude);
  return {
    // Sin nombre real se muestran las coordenadas: nunca un texto fijo.
    name: named?.name ?? formatCoords(latitude, longitude),
    locality: named?.locality,
    admin: named?.admin,
    country: named?.country,
    countryCode: named?.countryCode,
    latitude,
    longitude,
    accuracy: opts.accuracy,
    auto: true,
    resolved: !!named,
    source: opts.ipSource ? 'ip' : named?.source ?? 'coords',
    resolvedAt: Date.now(),
    lang: getLang(),
  };
}

/**
 * Detecta la ubicación del usuario sin que tenga que escribir nada:
 * 1º GPS de alta precisión, 2º geolocalización por IP.
 * Devuelve null si ambas fallan (ahí la UI pide la ciudad manualmente).
 */
export async function locatePlace(): Promise<WeatherPlace | null> {
  const gps = await getGpsCoords();
  if (gps) return buildAutoPlace(gps.latitude, gps.longitude, { accuracy: gps.accuracy });

  // Sin GPS (permiso denegado, sin señal): aproximación por IP.
  try {
    const resp = await fetch('https://ipapi.co/json/');
    if (resp.ok) {
      const d = await resp.json();
      if (typeof d.latitude === 'number' && typeof d.longitude === 'number') {
        // Se geocodifica igualmente: da un nombre consistente y en español.
        const place = await buildAutoPlace(d.latitude, d.longitude, { ipSource: true });
        if (place.resolved) return place;
        const city = typeof d.city === 'string' ? d.city.trim() : '';
        return {
          ...place,
          name: city || place.name,
          admin: typeof d.region === 'string' ? d.region : undefined,
          country: typeof d.country_name === 'string' ? d.country_name : undefined,
          countryCode: cleanCountryCode(d.country_code),
          resolved: !!city,
        };
      }
    }
  } catch {
    /* sin red o bloqueado: cae al modo manual */
  }
  return null;
}

/** Textos fijos que usaban versiones anteriores y que hay que erradicar. */
const LEGACY_PLACEHOLDERS = ['Mi ubicación', 'Mi zona'];
const NAME_RETRY_MS = 6 * 60 * 60 * 1000;

/**
 * ¿Hay que (re)resolver el nombre de este lugar? Falso para los elegidos a mano,
 * falso si ya está resuelto y falso si el intento anterior falló hace menos de 6 h
 * (esa ventana es lo que impide un bucle de render y de red).
 */
export function needsNameResolution(place: WeatherPlace): boolean {
  // Nombres en otro idioma: se vuelven a pedir una vez (también los elegidos
  // a mano, de los que solo cambian la región y el país).
  const otherLang = (place.lang ?? 'es') !== getLang();
  const triedRecently = place.langTriedAt === getLang() && !!place.resolvedAt && Date.now() - place.resolvedAt < NAME_RETRY_MS;
  if (otherLang && !triedRecently) return true;
  if (!place.auto) return false;
  if (LEGACY_PLACEHOLDERS.includes(place.name)) return true;
  if (place.resolved) return false;
  return !place.resolvedAt || Date.now() - place.resolvedAt > NAME_RETRY_MS;
}

/**
 * Reintenta la geocodificación inversa de un lugar ya guardado.
 * Devuelve el lugar actualizado, o null si no hay nada que cambiar.
 */
export async function resolvePlaceName(place: WeatherPlace): Promise<WeatherPlace | null> {
  const named = await reverseGeocode(place.latitude, place.longitude);
  if (!named) {
    // Sin nombre: al menos se sustituye el texto fijo por coordenadas útiles.
    if (LEGACY_PLACEHOLDERS.includes(place.name)) {
      return {
        ...place,
        name: formatCoords(place.latitude, place.longitude),
        resolved: false,
        source: place.source === 'ip' ? 'ip' : 'coords',
        resolvedAt: Date.now(),
      };
    }
    return { ...place, resolvedAt: Date.now(), langTriedAt: getLang() }; // marca el intento: no reintenta en 6 h
  }
  // Elegido a mano: el nombre es el que eligió la persona; solo se traducen
  // la región y el país.
  if (!place.auto) {
    return { ...place, admin: named.admin ?? place.admin, country: named.country ?? place.country, countryCode: named.countryCode ?? place.countryCode, lang: getLang(), langTriedAt: getLang(), resolvedAt: Date.now() };
  }
  return {
    ...place,
    name: named.name,
    locality: named.locality,
    admin: named.admin ?? place.admin,
    country: named.country ?? place.country,
    countryCode: named.countryCode ?? place.countryCode,
    resolved: true,
    source: place.source === 'ip' ? 'ip' : named.source,
    resolvedAt: Date.now(),
    lang: getLang(),
    langTriedAt: getLang(),
  };
}

/** Busca ciudades por nombre (geocoding de Open-Meteo, en español). */
export async function searchPlaces(query: string): Promise<WeatherPlace[]> {
  const params = new URLSearchParams({ name: query, count: '6', language: getLang(), format: 'json' });
  const resp = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`);
  if (!resp.ok) throw new Error(tr('No se pudo buscar la ubicación.'));
  const data = await resp.json();
  return (data.results ?? []).map((r: any) => ({
    name: r.name,
    admin: r.admin1,
    country: r.country,
    countryCode: cleanCountryCode(r.country_code),
    latitude: r.latitude,
    longitude: r.longitude,
    resolved: true,
    source: 'manual' as const,
    lang: getLang(),
  }));
}

export async function fetchWeather(place: WeatherPlace): Promise<WeatherData> {
  const params = new URLSearchParams({
    latitude: String(place.latitude),
    longitude: String(place.longitude),
    current: 'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,is_day,wind_speed_10m',
    daily: 'temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max',
    hourly: 'temperature_2m,weather_code,is_day,precipitation_probability',
    // 25 pasos desde la hora en curso: alcanza para las próximas 24 h.
    forecast_hours: '25',
    timezone: 'auto',
    forecast_days: '6',
  });
  const resp = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!resp.ok) throw new Error(tr('No se pudo obtener el pronóstico.'));
  const data = await resp.json();

  const weather: WeatherData = {
    current: {
      temperature: Math.round(data.current.temperature_2m),
      apparent: Math.round(data.current.apparent_temperature),
      humidity: data.current.relative_humidity_2m,
      weatherCode: data.current.weather_code,
      isDay: data.current.is_day === 1,
      windSpeed: Math.round(data.current.wind_speed_10m),
    },
    daily: data.daily.time.map((date: string, i: number) => ({
      date,
      tMax: Math.round(data.daily.temperature_2m_max[i]),
      tMin: Math.round(data.daily.temperature_2m_min[i]),
      weatherCode: data.daily.weather_code[i],
      precipProb: data.daily.precipitation_probability_max?.[i] ?? 0,
    })),
    hourly: ((data.hourly?.time ?? []) as string[])
      .map((time, i) => ({
        time,
        temperature: Math.round(data.hourly.temperature_2m[i]),
        weatherCode: data.hourly.weather_code[i],
        isDay: data.hourly.is_day?.[i] !== 0,
        precipProb: data.hourly.precipitation_probability?.[i] ?? 0,
      }))
      // El índice 0 es la hora en curso (ya la cuenta «actual»): +3 h, +6 h…
      .filter((_, i) => i > 0 && i % HOURLY_STEP === 0),
    fetchedAt: Date.now(),
  };
  localStorage.setItem(cacheKey(), JSON.stringify(weather));
  return weather;
}

// ---------------- Foto del lugar ----------------

const placeImagesKey = () => weatherImagesKey(profileOrNone());

function placeImageCacheKey(place: WeatherPlace): string {
  return `${place.name}|${place.country ?? ''}`.toLowerCase();
}

function loadPlaceImageCache(): Record<string, string> {
  try {
    const raw = localStorage.getItem(placeImagesKey());
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function savePlaceImage(place: WeatherPlace, url: string) {
  try {
    const cache = loadPlaceImageCache();
    cache[placeImageCacheKey(place)] = url;
    localStorage.setItem(placeImagesKey(), JSON.stringify(cache));
  } catch {
    /* almacenamiento lleno: se ignora, se buscará de nuevo la próxima vez */
  }
}

/**
 * Foto representativa del lugar detectado (Wikipedia REST, sin clave de API).
 * Se cachea la URL en localStorage para mostrarla al instante la próxima vez.
 */
export async function getPlaceImage(place: WeatherPlace): Promise<string | null> {
  // El nombre son coordenadas: buscarlas en Wikipedia daría basura y ensuciaría la
  // caché. Se compara con `false` a propósito: los lugares guardados por versiones
  // anteriores tienen `resolved === undefined` y deben seguir comportándose igual.
  if (place.resolved === false) return null;
  const cache = loadPlaceImageCache();
  const key = placeImageCacheKey(place);
  if (cache[key]) return cache[key];
  if (!navigator.onLine) return null;

  const candidates = [
    place.name,
    place.admin ? `${place.name}, ${place.admin}` : null,
    place.country ? `${place.name}, ${place.country}` : null,
  ].filter((c): c is string => !!c);

  for (const title of candidates) {
    try {
      const resp = await fetch(
        `https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`
      );
      if (!resp.ok) continue;
      const d = await resp.json();
      const url: string | undefined = d.originalimage?.source || d.thumbnail?.source;
      if (url) {
        savePlaceImage(place, url);
        return url;
      }
    } catch {
      /* intenta el siguiente candidato */
    }
  }
  return null;
}

/** Traducción de códigos WMO a descripción en español. */
export function weatherLabel(code: number): string {
  if (code === 0) return tr('Despejado');
  if (code === 1) return tr('Mayormente despejado');
  if (code === 2) return tr('Parcialmente nublado');
  if (code === 3) return tr('Nublado');
  if (code === 45 || code === 48) return tr('Niebla');
  if (code >= 51 && code <= 57) return tr('Llovizna');
  if (code >= 61 && code <= 67) return tr('Lluvia');
  if (code >= 71 && code <= 77) return tr('Nieve');
  if (code >= 80 && code <= 82) return tr('Chubascos');
  if (code === 85 || code === 86) return tr('Chubascos de nieve');
  if (code === 95) return tr('Tormenta');
  if (code === 96 || code === 99) return tr('Tormenta con granizo');
  return tr('Variable');
}

/** Categoría simple para elegir ícono (lucide). */
export function weatherKind(
  code: number,
  isDay: boolean
): 'sun' | 'moon' | 'partly' | 'cloud' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'storm' {
  if (code === 0 || code === 1) return isDay ? 'sun' : 'moon';
  if (code === 2) return 'partly';
  if (code === 3) return 'cloud';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 51 && code <= 57) return 'drizzle';
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 95) return 'storm';
  return 'cloud';
}
