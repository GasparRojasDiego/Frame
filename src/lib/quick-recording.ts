// Petición de «empieza a grabar ya», desacoplada de quién la atiende.
//
// El atajo Ctrl+Shift+F vive en la cabecera y la grabadora en su propio
// componente, montado siempre. Un evento evita pasar referencias entre ambos.
export const QUICK_RECORDING_EVENT = 'frame:quick-recording';

export function startQuickRecording() {
  window.dispatchEvent(new Event(QUICK_RECORDING_EVENT));
}
