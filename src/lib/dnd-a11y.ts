import type { Announcements, ScreenReaderInstructions } from '@dnd-kit/core';
import { tr } from '@/lib/i18n';

// Lo que @dnd-kit lee en voz alta a quien usa lector de pantalla al arrastrar
// (tareas, asignaturas, playlists). Trae sus frases en inglés fijo: aquí van
// en el idioma de Frame (1.6.7).
export const dndAccessibility = (): { announcements: Announcements; screenReaderInstructions: ScreenReaderInstructions } => ({
  screenReaderInstructions: {
    draggable: tr('Para mover un elemento, pulsa la barra espaciadora o Intro, muévelo con las flechas y vuelve a pulsar la barra espaciadora o Intro para soltarlo. Escape cancela.'),
  },
  announcements: {
    onDragStart: () => tr('Elemento tomado.'),
    onDragOver: ({ over }) => (over ? tr('Sobre una nueva posición.') : tr('Fuera de la lista.')),
    onDragEnd: ({ over }) => (over ? tr('Elemento soltado.') : tr('Elemento soltado fuera de la lista.')),
    onDragCancel: () => tr('Movimiento cancelado.'),
  },
});
