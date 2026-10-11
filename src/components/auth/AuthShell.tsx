import { useRef, useState, type ReactNode } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import ConstellationBackdrop from '@/components/layout/ConstellationBackdrop';
import CursorRing from '@/components/auth/CursorRing';
import FrameLogo from '@/components/layout/FrameLogo';
import { APP_VERSION } from '@/lib/version';
import { cn } from '@/lib/utils';

// ============================================================
// Marco común de las pantallas de acceso (entrar, registrarse y completar
// el perfil): constelación de fondo, el cursor de puntos de la página web
// cuando el ratón sale del recuadro, y la franja de marca del recuadro.
// ============================================================

interface AuthShellProps {
  title: string;
  /** `spaced`: el título va con el interletrado de la marca («FRAME»). */
  spaced?: boolean;
  description?: ReactNode;
  children: ReactNode;
  /** Dentro de un recuadro emergente (vincular la cuenta de un invitado): el
   *  mismo recuadro de acceso, sin la pantalla de fondo ni el cursor. */
  inDialog?: boolean;
}

export default function AuthShell({ title, spaced = false, description, children, inDialog = false }: AuthShellProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  const card = (
    <Card
      ref={cardRef}
      className={cn(
        'relative z-10 w-full max-w-md border-border/60 bg-card/95 shadow-2xl backdrop-blur-sm',
        inDialog && 'border-0 bg-transparent shadow-none backdrop-blur-none'
      )}
    >
      {/* En el recuadro emergente, la X de cerrar ocupa la esquina derecha. */}
      <div
        className={cn(
          'flex items-center justify-between px-5 pt-4 text-[10.5px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/80',
          inDialog && 'pr-12'
        )}
      >
        <span>VT Asvent</span>
        <span>2026 · v{APP_VERSION}</span>
      </div>
      <CardHeader className="items-center pb-4 pt-3 text-center">
        <FrameLogo className="mb-3 h-14 w-14" />
        {/* `pl` compensa el espaciado sobrante tras la última letra. */}
        <CardTitle className={cn('text-2xl font-bold text-foreground', spaced && 'pl-[0.35em] tracking-[0.35em]')}>
          {title}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      {children}
    </Card>
  );

  if (inDialog) return card;

  return (
    // `isolate`: crea un contexto de apilamiento propio, de modo que el lienzo
    // (a -z-10) queda por encima del fondo de esta capa y por debajo del recuadro.
    <div className="relative isolate flex min-h-screen w-full items-center justify-center overflow-x-hidden overflow-y-auto bg-background px-4 py-8">
      <ConstellationBackdrop />
      <CursorRing avoidRef={cardRef} />

      {card}
    </div>
  );
}

/** Campo de contraseña con botón para verla: evita errores al teclearla a ciegas. */
export function PasswordInput({
  id,
  value,
  onChange,
  disabled,
  autoComplete,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  autoComplete: 'current-password' | 'new-password';
  placeholder?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
        disabled={disabled}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className="pr-10"
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        className="absolute right-0 top-0 flex h-full w-10 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        tabIndex={-1}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

/** Único dato que se pide al crear una cuenta: cómo te llamará Frame. */
export function validateUsername(username: string): string | null {
  const user = username.trim();
  if (user.length === 0 || user.length > 12) return 'El nombre de usuario debe tener entre 1 y 12 caracteres.';
  return null;
}
