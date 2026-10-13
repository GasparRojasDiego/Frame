// ============================================================
// ¿Suena este archivo en Frame, y cuánto dura?
//
// Lo responde el propio motor de audio de Frame (el de WebView2) leyendo solo
// la cabecera. Al importar, una canción que no puede sonar se avisa y no
// entra: es mejor que una canción muda en la biblioteca. La duración que da
// es la real, la que verá el reproductor.
// ============================================================

export interface AudioProbe {
  playable: boolean;
  /** Segundos; sin valor si el archivo no la declara y no se pudo medir. */
  duration?: number;
}

const PROBE_TIMEOUT_MS = 10_000;

export function probeAudio(file: Blob): Promise<AudioProbe> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.muted = true;
    let settled = false;
    const finish = (result: AudioProbe) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      audio.onloadedmetadata = null;
      audio.ondurationchange = null;
      audio.onerror = null;
      audio.removeAttribute('src');
      audio.load();
      URL.revokeObjectURL(url);
      resolve(result);
    };
    // Si el motor no contesta, no se rechaza la canción por eso.
    const timer = window.setTimeout(() => finish({ playable: true }), PROBE_TIMEOUT_MS);
    const measured = () => (Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : undefined);
    audio.onloadedmetadata = () => {
      if (audio.duration === Infinity) {
        // WebM o MP3 sin duración en la cabecera: se pide el final y el motor la calcula.
        audio.ondurationchange = () => {
          if (Number.isFinite(audio.duration)) finish({ playable: true, duration: measured() });
        };
        audio.currentTime = 1e9;
        return;
      }
      finish({ playable: true, duration: measured() });
    };
    audio.onerror = () => finish({ playable: false });
    audio.src = url;
  });
}
