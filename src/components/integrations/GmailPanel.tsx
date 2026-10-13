import { useEffect, useState } from 'react';
import { LoaderCircle, Link2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  isGoogleConfigured,
  hasScopes,
  connectIntegration,
  integrationAccount,
} from '@/lib/google/auth';
import { listGmailMessages, cacheGet, type GmailMessage } from '@/lib/google/api';
import { isTauri } from '@tauri-apps/api/core';
import GoogleEmbed from './GoogleEmbed';
import { errorText, tr } from '@/lib/i18n';

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

// Ícono del sidebar para la interfaz Gmail: logo + contador de no leídos
// (alimentado por la caché que actualiza el sondeo de GmailPanel).
export function GmailNavIcon({ className }: { className?: string }) {
  const [unreadCount, setUnreadCount] = useState(() =>
    hasScopes('gmail')
      ? (cacheGet<GmailMessage[]>('gmail_inbox')?.value ?? []).filter((m) => m.unread).length
      : 0
  );

  useEffect(() => {
    const update = () => {
      if (!hasScopes('gmail')) return setUnreadCount(0);
      const inbox = cacheGet<GmailMessage[]>('gmail_inbox')?.value ?? [];
      setUnreadCount(inbox.filter((m) => m.unread).length);
    };
    window.addEventListener('gmailInboxUpdated', update);
    return () => window.removeEventListener('gmailInboxUpdated', update);
  }, []);

  return (
    <span className="relative inline-flex shrink-0">
      <GmailLogo className={className} />
      {unreadCount > 0 && (
        <span className="absolute -right-2 -top-2 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-primary px-0.5 text-[9px] font-bold text-primary-foreground">
          {unreadCount}
        </span>
      )}
    </span>
  );
}

// ============================================================
// Gmail REAL incrustado (interfaz original de Google, integrada como un
// recuadro fijo del layout, vía GoogleEmbed) — vive en la interfaz "Gmail".
// Además, la cuenta puede VINCULARSE por API (con selector de cuentas de
// Google, p. ej. la institucional): eso alimenta el contador de no leídos
// del sidebar y la caché offline.
// ============================================================
export default function GmailPanel({
  heightClass = 'h-[620px]',
  className,
}: {
  heightClass?: string;
  className?: string;
}) {
  const { toast } = useToast();
  const [connected, setConnected] = useState(() => hasScopes('gmail'));
  const [account, setAccount] = useState(() => integrationAccount('gmail'));
  const [isConnecting, setIsConnecting] = useState(false);

  // Sondeo silencioso vía Gmail API (si está vinculada): mantiene al día el
  // contador de no leídos del sidebar y la caché offline.
  useEffect(() => {
    if (!isTauri() || !connected) return;
    const poll = async () => {
      if (!navigator.onLine) return;
      try {
        await listGmailMessages(25);
        window.dispatchEvent(new Event('gmailInboxUpdated'));
      } catch {
        /* el badge es secundario: nunca molesta con errores */
      }
    };
    void poll();
    const interval = setInterval(poll, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [connected]);

  // Vinculación por API con selector de cuentas de Google (igual que
  // Classroom): el usuario elige, p. ej., su cuenta institucional.
  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const identity = await connectIntegration('gmail', { selectAccount: true });
      setConnected(true);
      setAccount(identity);
      toast({ title: tr('Gmail vinculado'), description: identity.email });
    } catch (e: any) {
      toast({ variant: 'destructive', title: tr('Gmail'), description: errorText(e) });
    } finally {
      setIsConnecting(false);
    }
  };

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

      {/* Vinculación de cuenta (badge del sidebar + caché offline) */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 px-4 py-2">
        <p className="text-[11px] text-muted-foreground">
          {connected && account
            ? tr('Cuenta vinculada: {email}', { email: account.email })
            : tr('Vincula una cuenta para el contador de no leídos y las notificaciones.')}
        </p>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-[11px] text-muted-foreground hover:text-foreground"
          onClick={() => void handleConnect()}
          disabled={isConnecting || !isGoogleConfigured}
        >
          {isConnecting ? (
            <LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Link2 className="mr-1.5 h-3.5 w-3.5" />
          )}
          {connected ? tr('Cambiar de cuenta') : tr('Vincular cuenta')}
        </Button>
      </div>
    </Card>
  );
}
