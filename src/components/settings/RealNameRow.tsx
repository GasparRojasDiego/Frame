import { useState } from 'react';
import { Check, Pencil, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { tidyName, updatePersonNames } from '@/lib/supabase/auth';
import type { UserProfile } from '@/types';
import { errorText, tr } from '@/lib/i18n';

// Nombres y apellidos de la cuenta (Ajustes → perfil). Las cuentas anteriores a
// la 1.4.8 no los tienen: aquí se añaden o se corrigen. El invitado no los lleva.
export default function RealNameRow({ userProfile }: { userProfile: UserProfile | null }) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [firstNames, setFirstNames] = useState('');
  const [lastNames, setLastNames] = useState('');
  const [saving, setSaving] = useState(false);

  if (!userProfile || userProfile.isGuest) return null;
  const current = `${userProfile.firstNames ?? ''} ${userProfile.lastNames ?? ''}`.trim();

  const start = () => {
    setFirstNames(userProfile.firstNames ?? '');
    setLastNames(userProfile.lastNames ?? '');
    setEditing(true);
  };

  const save = async () => {
    const first = tidyName(firstNames);
    const last = tidyName(lastNames);
    if (first.length < 2 || last.length < 2) {
      toast({ variant: 'destructive', title: tr('Revisa tus datos'), description: tr('Escribe tus nombres y tus apellidos.') });
      return;
    }
    setSaving(true);
    try {
      if (isSupabaseConfigured) {
        const { error } = await updatePersonNames({ firstNames: first, lastNames: last });
        if (error) throw new Error(error);
      }
      const stored = JSON.parse(localStorage.getItem('userProfile') ?? '{}') as Partial<UserProfile>;
      localStorage.setItem('userProfile', JSON.stringify({ ...stored, firstNames: first, lastNames: last }));
      window.dispatchEvent(new CustomEvent('profileUpdated'));
      setEditing(false);
      toast({ title: tr('Nombre guardado') });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: tr('No se pudo guardar'),
        description: errorText(error),
      });
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className="flex flex-wrap items-center gap-1.5 pt-1">
        <Input value={lastNames} onChange={(e) => setLastNames(e.target.value)} placeholder={tr('Apellidos')} maxLength={40} className="h-7 w-36 text-xs" autoFocus />
        <Input value={firstNames} onChange={(e) => setFirstNames(e.target.value)} placeholder={tr('Nombres')} maxLength={40} className="h-7 w-36 text-xs" />
        <Button size="icon" variant="ghost" className="h-7 w-7 text-green-500" onClick={() => void save()} disabled={saving} title={tr('Guardar')}>
          <Check className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" onClick={() => setEditing(false)} disabled={saving} title={tr('Descartar')}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={start}
      className="group/name flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-primary"
      title={tr('Cambiar tus nombres y apellidos')}
    >
      {current || tr('Añade tus nombres y apellidos')}
      <Pencil className="h-3 w-3 opacity-0 transition-opacity group-hover/name:opacity-100" />
    </button>
  );
}
