import { useEffect, useState } from 'react';
import { CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoaderCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import type { UserProfile } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { tidyName, updatePersonNames, updateUsername } from '@/lib/supabase/auth';
import { pushToCloud } from '@/lib/supabase/sync';
import AuthShell, { validateUsername } from '@/components/auth/AuthShell';
import { SUGGESTED_NAMES_KEY } from '@/components/auth/AuthForm';
import { tr } from '@/lib/i18n';

interface CompleteProfileFormProps {
  onProfileComplete: (profile: UserProfile) => void;
}

function readStoredProfile(): Partial<UserProfile> | null {
  try {
    const raw = localStorage.getItem('userProfile');
    return raw ? (JSON.parse(raw) as Partial<UserProfile>) : null;
  } catch {
    return null;
  }
}

export default function CompleteProfileForm({ onProfileComplete }: CompleteProfileFormProps) {
  const [username, setUsername] = useState('');
  const [firstNames, setFirstNames] = useState('');
  const [lastNames, setLastNames] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Quien entra sin cuenta solo elige cómo llamarse: no se le piden datos reales.
  const [isGuest] = useState(() => readStoredProfile()?.isGuest !== false);

  const { toast } = useToast();

  // Lo que ya se sabe se propone escrito: los nombres que dio Google y lo que
  // hubiera en el perfil a medio completar.
  useEffect(() => {
    const stored = readStoredProfile();
    let suggested: { firstNames?: string; lastNames?: string } = {};
    try {
      suggested = JSON.parse(sessionStorage.getItem(SUGGESTED_NAMES_KEY) ?? '{}');
    } catch {
      suggested = {};
    }
    const first = stored?.firstNames ?? suggested.firstNames ?? '';
    setFirstNames(first);
    setLastNames(stored?.lastNames ?? suggested.lastNames ?? '');
    // El nombre de usuario se propone escrito (el de pila de Google): un clic y dentro.
    if (stored?.username) setUsername(stored.username);
    else if (first.trim()) setUsername(first.trim().split(/\s+/)[0].slice(0, 12));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // Solo se pide el nombre de usuario. Nombres y apellidos, si Google los
    // dio, se guardan sin preguntar; si no, se ponen en Ajustes.
    const problem = validateUsername(username);
    if (problem) {
      setError(problem);
      setIsLoading(false);
      return;
    }

    const partialProfile = readStoredProfile();
    if (!partialProfile?.id) {
      setError(tr('La sesión no es válida. Inicia sesión de nuevo.'));
      setIsLoading(false);
      return;
    }

    try {
      const isAuthenticated = isSupabaseConfigured && partialProfile.isGuest === false;

      const fullProfile: UserProfile = {
        ...partialProfile,
        id: partialProfile.id,
        username: username.trim(),
        isGuest: partialProfile.isGuest ?? true,
        createdAt: partialProfile.createdAt ?? new Date().toISOString(),
        ...(!isGuest && tidyName(firstNames) ? { firstNames: tidyName(firstNames) } : {}),
        ...(!isGuest && tidyName(lastNames) ? { lastNames: tidyName(lastNames) } : {}),
      };

      // Con cuenta: el nombre de usuario y los datos personales viven también
      // en Supabase, y se sube el primer respaldo.
      if (isAuthenticated) {
        const { error: syncError } = await updateUsername(fullProfile.username);
        if (syncError) throw new Error(syncError);
        if (tidyName(firstNames) || tidyName(lastNames)) {
          // Un extra: si falla, el perfil sigue adelante.
          await updatePersonNames({ firstNames, lastNames }).catch(() => undefined);
        }
        await pushToCloud(fullProfile.id);
      }

      localStorage.setItem('userProfile', JSON.stringify(fullProfile));
      try {
        sessionStorage.removeItem(SUGGESTED_NAMES_KEY);
      } catch {
        /* sin importancia */
      }
      onProfileComplete(fullProfile);

      toast({
        title: tr('Perfil listo'),
        description: tr('Te damos la bienvenida a Frame, {username}.', { username: fullProfile.username }),
      });
    } catch (err: any) {
      console.error(err);
      const message = err?.message || tr('No se pudo guardar tu perfil. Inténtalo de nuevo.');
      setError(message);
      toast({ variant: 'destructive', title: tr('No se pudo guardar tu perfil'), description: message });
    } finally {
      setIsLoading(false);
    }
  };

  const ready = username.trim().length > 0;

  return (
    <AuthShell
      title={tr('Completa tu perfil')}
      description={
        isGuest
          ? tr('Elige cómo quieres que te llame Frame.')
          : tr('Es la primera vez que entras con esta cuenta: elige cómo te llamará Frame.')
      }
    >
      <form onSubmit={handleSubmit} noValidate>
        <CardContent className="space-y-3.5 pt-5">
          {error && (
            <Alert variant="destructive">
              <AlertTitle>{tr('Revisa tus datos')}</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="username">{tr('Nombre de usuario')}</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={12}
              placeholder={tr('Así te saludará Frame (máx. 12)')}
              autoComplete="nickname"
              required
              disabled={isLoading}
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" disabled={isLoading || !ready}>
            {isLoading ? <LoaderCircle className="h-4 w-4 animate-spin mr-2" /> : null}
            {tr('Guardar y continuar')}
          </Button>
        </CardFooter>
      </form>
    </AuthShell>
  );
}
