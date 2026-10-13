import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { isTauri } from '@tauri-apps/api/core';
import GoogleEmbed from './GoogleEmbed';
import { tr } from '@/lib/i18n';

// Logotipo oficial de Gmail (la "M" multicolor) — lo usa el sidebar.
function GmailLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="52 42 88 66" className={className} aria-hidden>
      <path fill="#4285f4" d="M58 108h14V74L52 59v43c0 3.32 2.69 6 6 6" />
      <path fill="#34a853" d="M120 108h14c3.32 0 6-2.69 6-6V59l-20 15" />
      <path fill="#fbbc04" d="M120 48v26l20-15v-8c0-7.42-8.47-11.65-14.4-7.2" />
      <path fill="#ea4335" d="M72 74V48l24 18 24-18v26L96 92" />
      <path fill="#c5221f" d="M52 51v8l20 15V48l-5.6-4.2c-5.94-4.45-14.4-.22-14.4 7.2" />
    </svg>
  );
}

/** Icono del sidebar para la interfaz Gmail. */
export function GmailNavIcon({ className }: { className?: string }) {
  return <GmailLogo className={className} />;
}

// ============================================================
// Gmail REAL incrustado (interfaz original de Google, integrada como un
// recuadro fijo del layout, vía GoogleEmbed) — vive en la interfaz "Gmail".
//
// 1.6.7: sin la vinculación por API (contador de no leídos). Pedía el permiso
// `gmail.modify`, restringido: con él, Google exige una auditoría de seguridad
// para publicar el acceso con Google. La bandeja de Google sigue aquí entera.
// ============================================================
export default function GmailPanel({
  heightClass = 'h-[620px]',
  className,
}: {
  heightClass?: string;
  className?: string;
}) {
  // En el navegador (desarrollo) no existe el webview nativo.
  if (!isTauri()) {
    return (
      <Card className="flex items-center gap-3 p-4">
        <GmailLogo className="h-6 w-8 shrink-0" />
        <p className="text-xs text-muted-foreground">
          {tr('El recuadro de Gmail integrado está disponible en la app de escritorio Frame.')}
        </p>
      </Card>
    );
  }

  return (
    <Card className={cn('overflow-hidden', className)}>
      {/* El webview nativo de Gmail se superpone exactamente sobre este recuadro. */}
      <GoogleEmbed kind="gmail" heightClass={heightClass} />
    </Card>
  );
}
