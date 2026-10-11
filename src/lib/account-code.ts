// ============================================================
// El identificador visible de una cuenta: «1234-5678-9012».
//
// Los perfiles locales nacían ya con doce cifras; las cuentas de verdad
// (correo o Google) tienen un UUID de Supabase, largo e ilegible, y en
// Ajustes aparecían como «sin identificador».
//
// Aquí toda cuenta tiene el suyo, y sin guardar nada: el código se DEDUCE
// del UUID de la cuenta (sus 128 bits aleatorios reducidos a doce cifras).
// Por eso las cuentas que ya existían tienen código desde hoy sin
// migración alguna, y sale el mismo en la laptop, en la tablet o en
// cualquier equipo donde se entre con esa cuenta.
// ============================================================

const TWELVE_DIGITS = 10n ** 12n;

/** Doce cifras, en tres grupos de cuatro. */
const group = (digits: string): string => digits.match(/.{1,4}/g)?.join('-') ?? digits;

export function accountCode(uid: string | null | undefined): string | null {
  if (!uid) return null;
  // Perfil local: ya ES un número de doce cifras.
  if (/^\d{12}$/.test(uid)) return group(uid);
  const hex = uid.replace(/-/g, '');
  if (!/^[0-9a-f]{32}$/i.test(hex)) return null;
  const digits = (BigInt(`0x${hex}`) % TWELVE_DIGITS).toString().padStart(12, '0');
  return group(digits);
}
