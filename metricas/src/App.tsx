import { lazy, Suspense, useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { KeyRound, LoaderCircle, LogOut, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Toaster } from '@/components/ui/toaster';
import { isConfigured, supabase } from '@m/lib/supabase';
import { clearPanelCache } from '@m/lib/cache';

const Panel = lazy(() => import('@m/Panel'));

// ============================================================
// Métricas de Frame (1.7.0): la puerta.
//
// Pedido de Diego (13-oct-2026): el Panel de uso fuera de la app, en un lugar
// que solo él use y que siga siendo seguro aunque el enlace se difunda. Así:
//
//   1. Google: la misma cuenta de responsable que usa en Frame.
//   2. Siempre, el código de 6 dígitos de una app de autenticación (TOTP).
//      La primera vez se muestra el código QR para darlo de alta.
//   3. El servidor no responde sin los dos pasos (`is_frame_owner()` exige
//      `aal2`, migración 0013) ni a ninguna otra cuenta.
//
// La sesión vive solo en esta pestaña y se cierra sola tras 30 minutos sin
// actividad. Cerrar sesión aquí no toca las sesiones de Frame en sus equipos.
// ============================================================

type Phase =
  | { kind: 'loading' }
  | { kind: 'signed-out'; notice?: string }
  | { kind: 'enroll'; factorId: string; qr: string; secret: string }
  | { kind: 'verify'; factorId: string }
  | { kind: 'ready' };

const IDLE_MS = 30 * 60 * 1000;
const FACTOR_NAME = 'Métricas de Frame';

const message = (error: unknown) => String((error as { message?: unknown } | null)?.message ?? error ?? '');

/** Dónde está la sesión: sin ella, Google; con ella, el segundo paso (darlo de alta o pedirlo). */
async function decide(): Promise<Phase> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!sessionData.session) return { kind: 'signed-out' };

  const { data: level, error: levelError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (levelError) throw levelError;
  if (level.currentLevel === 'aal2') return { kind: 'ready' };

  const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
  if (listError) throw listError;
  const verified = factors.totp[0];
  if (verified) return { kind: 'verify', factorId: verified.id };

  // Un alta a medias (se cerró la pestaña antes de escribir el código) no se reutiliza.
  for (const factor of factors.all) {
    if (factor.factor_type === 'totp' && factor.status !== 'verified') await supabase.auth.mfa.unenroll({ factorId: factor.id });
  }
  const { data: enrolled, error: enrollError } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: FACTOR_NAME,
    issuer: 'Frame',
  });
  if (enrollError) throw enrollError;
  return { kind: 'enroll', factorId: enrolled.id, qr: enrolled.totp.qr_code, secret: enrolled.totp.secret };
}

export default function App() {
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      setPhase(await decide());
    } catch (reason) {
      setError(message(reason));
      setPhase({ kind: 'signed-out' });
    }
  }, []);

  // Solo esta pestaña: las sesiones de Frame en los equipos de Diego siguen abiertas.
  const signOut = useCallback(async (notice?: string) => {
    clearPanelCache();
    await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
    setPhase({ kind: 'signed-out', notice });
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // 30 minutos sin tocar nada (o con el equipo dormido) cierran la sesión.
  const lastActivity = useRef(Date.now());
  const signedIn = phase.kind !== 'loading' && phase.kind !== 'signed-out';
  useEffect(() => {
    if (!signedIn) return;
    lastActivity.current = Date.now();
    const touch = () => {
      lastActivity.current = Date.now();
    };
    const check = () => {
      if (Date.now() - lastActivity.current > IDLE_MS) void signOut('La sesión se cerró tras 30 minutos sin actividad.');
    };
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
    events.forEach((name) => window.addEventListener(name, touch, { passive: true }));
    document.addEventListener('visibilitychange', check);
    const timer = window.setInterval(check, 60_000);
    return () => {
      events.forEach((name) => window.removeEventListener(name, touch));
      document.removeEventListener('visibilitychange', check);
      window.clearInterval(timer);
    };
  }, [signedIn, signOut]);

  const signIn = async () => {
    setError(null);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}${window.location.pathname}`, queryParams: { prompt: 'select_account' } },
    });
    if (oauthError) setError(message(oauthError));
  };

  if (phase.kind === 'ready') {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border/60 bg-background/90 px-4 py-2.5 backdrop-blur md:px-8">
          <div className="flex items-center gap-2 text-sm">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span className="font-headline font-bold">Frame</span>
            <span className="text-muted-foreground">· Métricas</span>
          </div>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => void signOut()}>
            <LogOut className="h-3.5 w-3.5" /> Cerrar sesión
          </Button>
        </header>
        <Suspense
          fallback={
            <div className="flex h-60 items-center justify-center">
              <LoaderCircle className="h-8 w-8 animate-spin text-primary" />
            </div>
          }
        >
          <Panel />
        </Suspense>
        <Toaster />
      </div>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm rounded-xl border border-border/70 bg-card p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h1 className="font-headline text-lg font-bold">Métricas de Frame</h1>
        </div>

        {!isConfigured && <p className="text-sm text-destructive">Falta la configuración de Supabase en esta compilación.</p>}

        {phase.kind === 'loading' && (
          <div className="flex h-24 items-center justify-center">
            <LoaderCircle className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}

        {phase.kind === 'signed-out' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Acceso restringido. Entra con la cuenta del responsable de Frame; después se pide el código de tu app de autenticación.</p>
            {phase.notice && <p className="rounded-md border border-border/60 bg-secondary/40 p-2.5 text-xs text-muted-foreground">{phase.notice}</p>}
            <Button className="w-full" onClick={() => void signIn()} disabled={!isConfigured}>
              Entrar con Google
            </Button>
          </div>
        )}

        {phase.kind === 'enroll' && <Enroll phase={phase} onDone={refresh} onCancel={() => void signOut()} />}
        {phase.kind === 'verify' && <Verify factorId={phase.factorId} onDone={refresh} onCancel={() => void signOut()} />}

        {error && <p className="mt-4 break-words text-xs text-destructive">{error}</p>}
      </div>
    </main>
  );
}

function CodeForm({ factorId, onDone, onCancel, label }: { factorId: string; onDone: () => Promise<void>; onCancel: () => void; label: string }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError('Escribe los 6 dígitos.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    setBusy(false);
    if (verifyError) {
      setCode('');
      setError(/invalid|expired/i.test(verifyError.message) ? 'Código incorrecto o vencido. Escribe el que se ve ahora.' : verifyError.message);
      return;
    }
    await onDone();
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block text-xs font-medium text-muted-foreground" htmlFor="codigo">
        {label}
      </label>
      <Input
        id="codigo"
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        maxLength={6}
        value={code}
        onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
        className="h-11 text-center font-mono text-lg tracking-[0.4em]"
        placeholder="000000"
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel} disabled={busy}>
          Salir
        </Button>
        <Button type="submit" className="flex-1 gap-1.5" disabled={busy}>
          {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} Verificar
        </Button>
      </div>
    </form>
  );
}

function Verify({ factorId, onDone, onCancel }: { factorId: string; onDone: () => Promise<void>; onCancel: () => void }) {
  return <CodeForm factorId={factorId} onDone={onDone} onCancel={onCancel} label="Código de 6 dígitos de tu app de autenticación" />;
}

function Enroll({ phase, onDone, onCancel }: { phase: Extract<Phase, { kind: 'enroll' }>; onDone: () => Promise<void>; onCancel: () => void }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Primera vez: escanea este código con una app de autenticación (Google Authenticator, Microsoft Authenticator, Authy…). Desde ahora te pedirá el código que muestre.
      </p>
      <div className="flex justify-center rounded-lg bg-white p-3">
        <img src={phase.qr} alt="Código QR para la app de autenticación" className="h-44 w-44" />
      </div>
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer">¿No puedes escanearlo? Escribe esta clave</summary>
        <code className="mt-2 block select-all break-all rounded-md bg-secondary/50 p-2 font-mono text-[11px] text-foreground">{phase.secret}</code>
      </details>
      <CodeForm factorId={phase.factorId} onDone={onDone} onCancel={onCancel} label="Código de 6 dígitos que muestra la app" />
    </div>
  );
}
