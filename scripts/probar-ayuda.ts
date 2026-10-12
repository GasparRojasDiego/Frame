import { HELP_ENTRIES } from '../src/lib/help/kb/index';
import { HELP_AREAS } from '../src/lib/help/areas';

// Revisión del banco de respuestas del Centro de ayuda (1.6.6: sin buscador,
// solo temas y preguntas). Uso: npx tsx scripts/probar-ayuda.ts < /dev/null

const ROUTES = new Set(['/', '/temporizador', '/habitos', '/knowledge', '/tareas', '/calendario', '/music', '/settings', '/ayuda', '/youtube', '/gmail', '/classroom']);
const problems: string[] = [];
const ids = new Set<string>();

for (const e of HELP_ENTRIES) {
  if (ids.has(e.id)) problems.push(`DUPLICADO ${e.id}`);
  ids.add(e.id);
  if (!HELP_AREAS[e.area]) problems.push(`ÁREA DESCONOCIDA ${e.id} → ${e.area}`);
  if (!e.title.trim()) problems.push(`SIN TÍTULO ${e.id}`);
  if (!e.a.trim()) problems.push(`SIN RESPUESTA ${e.id}`);
  if (e.go && !ROUTES.has(e.go)) problems.push(`RUTA RARA ${e.id} → ${e.go}`);
  const text = [e.a, ...(e.steps ?? []), e.tip ?? ''].join('\n');
  if ((text.match(/\*\*/g) ?? []).length % 2) problems.push(`NEGRITA SIN CERRAR ${e.id}`);
  if (/[A-ZÁÉÍÓÚÑ]{4,}/.test(e.title.replace(/FRAME|ELIMINAR/g, ''))) problems.push(`MAYÚSCULAS EN EL TÍTULO ${e.id}`);
}
for (const e of HELP_ENTRIES) for (const r of e.rel ?? []) if (!ids.has(r)) problems.push(`REL ROTO ${e.id} → ${r}`);

console.log('Entradas:', HELP_ENTRIES.length);
if (problems.length) {
  console.log(problems.join('\n'));
  process.exitCode = 1;
} else {
  console.log('Sin problemas.');
}
