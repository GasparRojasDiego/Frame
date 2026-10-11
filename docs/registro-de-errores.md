# Registro de errores de Frame

Copia legible de la tabla `error_log` de Supabase. La tabla se llena sola: cada fallo que una app reporta (escritorio o Android) se agrupa por huella con sus veces, versiones y estudiantes. La tarea programada «Errores de Frame» la revisa cada día, corrige el código y actualiza este archivo.

**Estados:** `abierto` (por corregir) · `corregido` (arreglo en el código, sale con la versión indicada) · `ignorado` (aviso inofensivo).

Un error corregido que reaparece en una versión igual o posterior a la del arreglo se reabre solo.

## Cómo leer la pila

```bash
node scripts/resolver-pila.mjs 1.5.8 "at Xy (index-AbC123.js:12:3456)"
```

Traduce la pila compacta de un error (columna `stack`) a archivo y línea del código fuente, con los mapas que guarda cada compilación en `sourcemaps/<versión>/`. Solo funciona para versiones compiladas en este equipo desde la 1.5.8.

---

## Abiertos

Ninguno.

## Corregidos

| Detectado | Problema | Arreglo | Sale en |
|---|---|---|---|
| 06-oct-2026 | Ninguna imagen sincronizada llegaba a la nube: cada subida a `user-images` devolvía 400 «Invalid key» porque el nombre usaba «~» (`<clave>~<huella>`), carácter que Storage no admite. Los dispositivos reintentaban cada 2 min sin éxito. | Separador «.» en `objectPath` de `src/lib/image-sync.ts` (escritorio y Frame Movil). Comprobado contra Storage: «~» → 400 InvalidKey, «.» → pasa la validación. | Windows 1.5.8 · Android 1.0.10 |
| 06-oct-2026 | El detector de «motor de descargas caducado» no reconocía el error 403 de YouTube: la expresión tenía caracteres de retroceso invisibles en lugar de `\b`, así que la reparación automática de yt-dlp no se activaba con ese error. | `src/lib/downloadEngine.ts`: `\b403\b`. | Windows 1.5.8 |

## Ignorados

| Desde | Última vez | Veces | Mensaje | Motivo |
|---|---|---|---|---|
| 01-oct-2026 | 01-oct-2026 | 8 | `ResizeObserver loop completed with undelivered notifications.` (window, 1.5.5 Windows) | Aviso del navegador que no rompe nada. Desde la 1.5.8 la app ya no lo envía. |

---

## Historial

- **06-oct-2026 · creación del registro.** Revisados los 6 errores que había en la telemetría:
  - 5 eran de perfiles de prueba en el navegador de desarrollo: «useCourse must be used within a CourseProvider» (recarga en caliente de Vite, 1.5.3) y cuatro «Cannot read properties of undefined» (versión de desarrollo 1.0.0, 20-sep). No existen en la app instalada y se borraron con la limpieza de cuentas inactivas.
  - 1 era el aviso inofensivo de ResizeObserver: queda ignorado.

  Desde la 1.5.8 la app ya no reporta errores en modo desarrollo, y cada error llega con su pantalla y su pila.
