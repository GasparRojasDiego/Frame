// Sustituye a src/lib/error-report.ts en la prueba de sincronización: lo que
// se anotaría en el registro de errores queda a la vista del probador.
interface ErrorInput {
  scope: string;
  name: string;
  message: string;
}

export function reportError(input: ErrorInput) {
  const g = globalThis as unknown as { __reported?: ErrorInput[] };
  (g.__reported ??= []).push(input);
}
