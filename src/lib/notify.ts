// Sistema de notificaciones de Frame: notificaciones nativas del SO (Tauri)
// con sonido propio. Funciona aunque la ventana esté oculta en la bandeja,
// porque el webview sigue vivo. En navegador cae a la API web Notification.
import { isTauri } from '@tauri-apps/api/core';
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';
import { getNotificationPrefs, logNotification, type LogKind } from '@/lib/notification-log';

let audioEl: HTMLAudioElement | null = null;

function playChime() {
  try {
    if (!audioEl) {
      audioEl = new Audio('/sounds/notification.wav');
      audioEl.volume = 0.65;
    }
    audioEl.currentTime = 0;
    audioEl.play()?.catch(() => undefined);
  } catch {
    /* sin audio disponible */
  }
}

export async function ensureNotificationPermission(): Promise<boolean> {
  if (isTauri()) {
    if (await isPermissionGranted()) return true;
    return (await requestPermission()) === 'granted';
  }
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  return (await Notification.requestPermission()) === 'granted';
}

export interface NotifyOptions {
  title: string;
  body: string;
  /** reproduce el chime de Frame (por defecto true) */
  sound?: boolean;
  /** Cómo se anota en la campana (por defecto, «aviso»). */
  kind?: LogKind;
  /** Interfaz a la que lleva desde la campana. */
  route?: string;
}

export async function notify({ title, body, sound = true, kind = 'aviso', route }: NotifyOptions): Promise<void> {
  // Todo queda en el registro de la campana, aunque las notificaciones estén
  // desactivadas: así se puede repasar lo que pasó.
  logNotification({ kind, title, detail: body, route });
  const prefs = getNotificationPrefs();
  if (!prefs.enabled) return;
  if (!prefs.sound) sound = false;
  // El sonido va PRIMERO y por su cuenta: antes esperaba a la respuesta del
  // permiso de notificaciones, y si esa llamada fallaba el fin de la sesión de
  // enfoque se quedaba mudo (con un rechazo de promesa sin atender de propina).
  if (sound) {
    try {
      playChime();
    } catch {
      /* sin audio disponible */
    }
  }
  try {
    const granted = await ensureNotificationPermission();
    if (!granted) return;
    if (isTauri()) {
      sendNotification({ title, body });
    } else {
      new Notification(title, { body });
    }
  } catch (e) {
    console.warn('No se pudo mostrar la notificación', e);
  }
}
