import React, { useState, useEffect, useRef, useMemo } from 'react';
import Image from '@/lib/image';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useCourse } from '@/context/CourseContext';
import type { StudyGoals, UserProfile } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  User,
  Pencil,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Monitor,
  CalendarDays,
  Copy,
} from 'lucide-react';
import { accountCode } from '@/lib/account-code';
import RealNameRow from '@/components/settings/RealNameRow';
import { getThemePreference, setThemePreference, type ThemePreference } from '@/lib/theme';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { saveImage } from '@/lib/music-db';
import { useStoredImage } from '@/hooks/use-stored-image';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import AvatarCropper from '@/components/auth/AvatarCropper';
import AccountMenu from '@/components/settings/AccountCard';
import ProfileStats from '@/components/settings/ProfileStats';
import { APP_VERSION, BUILD_DATE } from '@/lib/version';
import LegalDocument from '@/components/settings/LegalDocument';
import { INFO_VERSION, infoDocument } from '@/lib/legal/info';
import { TERMS_VERSION, termsDocument } from '@/lib/legal/terms';
import { SUPPORT_VERSION, supportDocument } from '@/lib/legal/support';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { updateUsername } from '@/lib/supabase/auth';
import StreakStatusCard from '@/components/settings/StreakStatusCard';


const daysOfWeek: { key: keyof StudyGoals; label: string }[] = [
  { key: 'monday', label: 'Lunes' },
  { key: 'tuesday', label: 'Martes' },
  { key: 'wednesday', label: 'Miércoles' },
  { key: 'thursday', label: 'Jueves' },
  { key: 'friday', label: 'Viernes' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' },
];

// Selector de tema de la app: claro (arena) / oscuro / según el dispositivo.
// El cambio es inmediato y persiste entre sesiones (localStorage).
function ThemeSelector() {
  const [pref, setPref] = useState<ThemePreference>(() => getThemePreference());
  const options: { value: ThemePreference; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { value: 'light', label: 'Tema claro', icon: Sun },
    { value: 'dark', label: 'Tema oscuro', icon: Moon },
    { value: 'system', label: 'Tema del dispositivo', icon: Monitor },
  ];
  return (
    <div className="flex flex-col items-center gap-2" data-tour="tema">
      <p className="font-bold text-muted-foreground text-xs">Tema</p>
      <div className="flex items-center gap-3">
        {options.map(({ value, label, icon: Icon }) => (
          <Button
            key={value}
            variant="ghost"
            size="icon"
            title={label}
            className={cn(
              'h-9 w-9 rounded-md border',
              pref === value
                ? 'border-primary/50 bg-primary/10 hover:bg-primary/20'
                : 'border-border bg-transparent hover:bg-secondary'
            )}
            onClick={() => {
              setThemePreference(value);
              setPref(value);
            }}
          >
            <Icon className={cn('h-5 w-5', pref === value ? 'text-primary' : 'text-muted-foreground')} />
          </Button>
        ))}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { 
    studyGoals, 
    updateStudyGoals, 
    userProfile, 
    selectionMode,
    setSelectionMode,
    streakGoal,
    updateStreakGoal,
  } = useCourse();

  const [localGoals, setLocalGoals] = useState<StudyGoals>(studyGoals);
  const { toast } = useToast();

  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [isEditingGoals, setIsEditingGoals] = useState(false);

  // Se relee sola: también cuando la foto llega de otro dispositivo.
  const [profileAvatar, setProfileAvatar] = useStoredImage(userProfile ? `profileAvatar_${userProfile.id}` : null);
  
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editedUsername, setEditedUsername] = useState('');
  
  const [isEditingStreakGoal, setIsEditingStreakGoal] = useState(false);
  const [editedStreakValue, setEditedStreakValue] = useState<string | number>('');

  const [cropperOpen, setCropperOpen] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);



  useEffect(() => {
    setLocalGoals(studyGoals);
  }, [studyGoals]);

  useEffect(() => {
    if (userProfile) setEditedUsername(userProfile.username || '');
  }, [userProfile]);

  const handleGoalChange = (day: keyof StudyGoals, value: string) => {
    const minutes = parseInt(value, 10);
    if (!isNaN(minutes) && minutes >= 0) {
      setLocalGoals(prev => ({ ...prev, [day]: minutes }));
    } else if (value === '') {
      setLocalGoals(prev => ({ ...prev, [day]: 0 }));
    }
  };
  
  const handleSaveGoals = () => {
    updateStudyGoals(localGoals);
    setIsEditingGoals(false);
    toast({
        title: "Metas guardadas",
        description: "Tus metas diarias de estudio se actualizaron.",
    });
  };
  
  const handleCancelEditGoals = () => {
    setLocalGoals(studyGoals); // Revert changes
    setIsEditingGoals(false);
  }
  
  const handleStartEditingProfile = () => {
    if (userProfile) {
      setEditedUsername(userProfile.username || '');
    }
    setIsEditingProfile(true);
  };

  const handleSaveProfile = () => {
    if (!userProfile) return;

    if (editedUsername.trim().length === 0) {
        toast({
            variant: "destructive",
            title: "Error",
            description: "El nombre de usuario no puede estar vacío.",
        });
        return;
    }
    if (editedUsername.trim().length > 12) {
        toast({
            variant: "destructive",
            title: "Error",
            description: "El nombre de usuario no puede tener más de 12 caracteres.",
        });
        return;
    }

    const storedProfileRaw = localStorage.getItem('userProfile');
    const storedProfile = storedProfileRaw ? JSON.parse(storedProfileRaw) : {};
    
    const updatedProfile: UserProfile = {
        ...storedProfile,
        id: userProfile.id,
        username: editedUsername.trim(),
        isGuest: userProfile.isGuest,
        createdAt: userProfile.createdAt, // Preserve existing creation date
    };

    localStorage.setItem('userProfile', JSON.stringify(updatedProfile));
    // Con cuenta, el nombre vive también en Supabase: sin subirlo, el próximo
    // arranque rehidrata el perfil desde la nube y devolvía el nombre antiguo.
    if (!userProfile.isGuest && isSupabaseConfigured) {
      void updateUsername(updatedProfile.username ?? '').catch(() => undefined);
    }

    setIsEditingProfile(false);
    
    toast({
        title: "Perfil guardado",
        description: "Tu información de perfil ha sido actualizada.",
    });
    window.dispatchEvent(new CustomEvent('profileUpdated'));
  };

  const handleCancelEditProfile = () => {
      setIsEditingProfile(false);
      if (userProfile) {
          setEditedUsername(userProfile.username || '');
      }
  };

  const handleAvatarClick = () => {
    avatarInputRef.current?.click();
  };

  const handleAvatarUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && userProfile) {
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result as string;
            setImageToCrop(result);
            setCropperOpen(true);
        };
        reader.readAsDataURL(file);
    }
  };

  const handleStartEditStreakGoal = () => {
    if (selectionMode === 'rendimiento') {
        setEditedStreakValue(streakGoal.grade);
    } else {
        setEditedStreakValue(streakGoal.minutes);
    }
    setIsEditingStreakGoal(true);
  };

  const handleCancelEditStreakGoal = () => {
    setIsEditingStreakGoal(false);
  };

  const gradeOrder: ('B' | 'A' | 'AD')[] = ['B', 'A', 'AD'];

  const handleChangeGrade = (direction: 'prev' | 'next') => {
    const currentIndex = gradeOrder.indexOf(editedStreakValue as 'B' | 'A' | 'AD');
    if (direction === 'next' && currentIndex < gradeOrder.length - 1) {
      setEditedStreakValue(gradeOrder[currentIndex + 1]);
    } else if (direction === 'prev' && currentIndex > 0) {
      setEditedStreakValue(gradeOrder[currentIndex - 1]);
    }
  };

  const handleSaveStreakGoal = () => {
    if (selectionMode === 'rendimiento') {
        updateStreakGoal({
            grade: editedStreakValue as 'B' | 'A' | 'AD'
        });
    } else {
        const minutes = Number(editedStreakValue);
        if (!isNaN(minutes) && minutes > 0) {
            updateStreakGoal({
                minutes: minutes
            });
        }
    }
    setIsEditingStreakGoal(false);
    toast({
        title: "Meta de racha guardada",
        description: "Tu meta ha sido actualizada.",
    });
  };

  // Los tres documentos de la app, con los datos de esta instalación ya
  // interpolados (versión, identificador y fecha de la compilación).
  const LEGAL_DIALOGS = useMemo(() => {
    const appVersion = APP_VERSION;
    const installId = accountCode(userProfile?.id) ?? 'sin identificador';
    const stamp = format(parseISO(BUILD_DATE), "d 'de' MMMM 'de' yyyy", { locale: es });

    return [
      {
        key: 'info',
        label: 'Información del sistema',
        title: 'Información y novedades',
        subtitle: `Frame ${appVersion} · documento versión ${INFO_VERSION}`,
        markdown: infoDocument({ appVersion, installId, releaseDate: stamp }),
      },
      {
        key: 'terms',
        label: 'Términos de servicio',
        title: 'Términos, condiciones y privacidad',
        subtitle: `Versión ${TERMS_VERSION} · Legislación peruana · Ley N.º 29733 y Ley N.º 29571`,
        markdown: termsDocument({ appVersion, effectiveDate: stamp }),
      },
      {
        key: 'support',
        label: 'Reportar un error',
        title: 'Soporte y reporte de errores',
        subtitle: `Versión ${SUPPORT_VERSION} · Incluye el puerto seguro para vulnerabilidades`,
        markdown: supportDocument({ appVersion, installId, effectiveDate: stamp }),
      },
    ];
  }, [userProfile]);


  return (
    <div className="space-y-6 px-6 pb-6 pt-2 md:px-8 md:pb-8 md:pt-4">
         <input
          type="file"
          ref={avatarInputRef}
          onChange={handleAvatarUpload}
          className="hidden"
          accept="image/*"
        />

        {/* ------------------------------------------------------------------
            Cabecera del perfil.

            Antes esto eran tres piezas sueltas flotando en la misma fila: el
            avatar, un "Miembro desde" solo en mitad del vacío y una rueda
            huérfana encima del selector de tema. Ahora es UN panel con tres
            zonas de peso decreciente —identidad, expediente y ajustes— y la
            rueda vive dentro de la zona de ajustes, con su etiqueta, en vez
            de colgar de una esquina.
            ------------------------------------------------------------------ */}
        <div className="rounded-xl border border-border/70 bg-card/40 p-5">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-center">
            {/* --- Identidad --- */}
            <div className="flex shrink-0 items-center gap-5">
              <div
                data-tour="perfil-avatar"
                className={cn(
                  'flex h-28 w-28 items-center justify-center overflow-hidden rounded-full bg-secondary',
                  isEditingProfile && 'cursor-pointer animate-pulse-border-infinite border-2 border-primary'
                )}
                onClick={() => {
                  if (isEditingProfile) handleAvatarClick();
                }}
                onMouseDown={(e) => {
                  if (isEditingProfile) e.preventDefault();
                }}
              >
                {profileAvatar ? (
                  <Image src={profileAvatar} alt="Profile Avatar" width={112} height={112} className="h-full w-full object-cover" />
                ) : (
                  <User className="h-14 w-14 text-primary" />
                )}
              </div>

              <div className="min-w-0 space-y-1">
                <div className="group flex items-center gap-2">
                  {isEditingProfile ? (
                    <Input
                      value={editedUsername}
                      onChange={(e) => setEditedUsername(e.target.value)}
                      onBlur={handleSaveProfile}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                        if (e.key === 'Escape') handleCancelEditProfile();
                      }}
                      placeholder="Username"
                      className="h-9 w-48 font-headline text-xl font-bold"
                      maxLength={12}
                      autoFocus
                    />
                  ) : (
                    <>
                      <h1 className="truncate font-headline text-xl font-bold text-foreground">
                        {userProfile?.username}
                      </h1>
                      <Button
                        onClick={handleStartEditingProfile}
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                        title="Cambiar el nombre" data-tour="perfil-nombre"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>

                <RealNameRow userProfile={userProfile} />
                <p className="text-xs text-muted-foreground">
                  {userProfile?.isGuest ? 'Sesión local · solo en este equipo' : (userProfile?.email ?? 'Cuenta sincronizada')}
                </p>
                {/* Identificador de la cuenta. Toda cuenta tiene uno, también
                    las de correo y Google, que antes salían sin él (ver
                    account-code.ts). Se copia con un toque. */}
                {accountCode(userProfile?.id) && (
                  <button
                    type="button"
                    onClick={() => {
                      const code = accountCode(userProfile?.id);
                      if (!code) return;
                      void navigator.clipboard?.writeText(code).then(
                        () => toast({ title: 'ID copiado', description: code }),
                        () => undefined
                      );
                    }}
                    className="group/id flex items-center gap-1.5 rounded px-1 -mx-1 font-mono text-[11px] tabular-nums text-muted-foreground/80 transition-colors hover:bg-primary/10 hover:text-primary"
                    title="Copiar el ID de tu cuenta" data-tour="perfil-id"
                  >
                    ID {accountCode(userProfile?.id)}
                    <Copy className="h-3 w-3 opacity-0 transition-opacity group-hover/id:opacity-100" />
                  </button>
                )}
              </div>
            </div>

            {/* --- Antigüedad de la cuenta --- */}
            <div className="flex flex-1 items-center">
              <div className="flex flex-col justify-center gap-1 rounded-lg border border-border/60 bg-gradient-to-b from-primary/[0.07] to-transparent px-4 py-3">
                <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5 shrink-0 text-primary" />
                  Miembro desde
                </span>
                <span className="font-headline text-base font-bold text-foreground">
                  {userProfile?.createdAt
                    ? format(parseISO(userProfile.createdAt), "d 'de' MMMM, yyyy", { locale: es })
                    : '—'}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {userProfile?.createdAt
                    ? `${differenceInCalendarDays(new Date(), parseISO(userProfile.createdAt))} días con Frame`
                    : 'sin fecha registrada'}
                </span>
              </div>
            </div>

            {/* --- Ajustes: tema y cuenta, juntos y etiquetados. La rueda abre
                un menú pequeño a su lado (AccountCard), no un recuadro. --- */}
            <div className="flex shrink-0 items-start gap-6 border-t border-border/60 pt-4 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0">
              <ThemeSelector />
              <div className="flex flex-col items-center gap-2">
                <p className="text-xs font-bold text-muted-foreground">Cuenta</p>
                <AccountMenu userProfile={userProfile} />
              </div>
            </div>
          </div>
        </div>
        
        <div className="space-y-2 pt-6">
            <div className="flex justify-center items-center relative mb-6">
                <h2 className="text-xl font-semibold leading-none tracking-tight text-center text-primary">
                    Metas diarias de estudio
                </h2>
                <div className="absolute right-0 flex items-center gap-2">
                    {isEditingGoals ? (
                        <>
                            <Button variant="ghost" size="icon" onClick={handleSaveGoals} className="h-8 w-8 text-green-500 hover:text-green-600">
                                <Check className="h-5 w-5" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={handleCancelEditGoals} className="h-8 w-8 text-red-500 hover:text-red-600">
                                <X className="h-5 w-5" />
                            </Button>
                        </>
                    ) : (
                        <Button variant="ghost" size="icon" onClick={() => setIsEditingGoals(true)} className="h-8 w-8 text-muted-foreground" data-tour="metas-editar" title="Editar las metas">
                            <Pencil className="h-5 w-5" />
                        </Button>
                    )}
                </div>
            </div>
            <div className="grid grid-cols-7 border rounded-lg overflow-hidden bg-card">
              {daysOfWeek.map(({ key, label }, index) => (
                <div key={key} className={cn(
                  "flex flex-col items-center border-b md:border-b-0",
                  index < daysOfWeek.length - 1 && "md:border-r"
                )}>
                    <div className="w-full text-center text-xs font-semibold text-foreground p-2 bg-muted/50 border-b">
                        {label}
                    </div>
                    <div className="p-3 w-full flex items-center justify-center bg-background">
                        <Input
                            id={key}
                            type="number"
                            value={localGoals[key] === 0 ? '' : localGoals[key]}
                            onChange={(e) => handleGoalChange(key, e.target.value)}
                            placeholder="0"
                            className="w-full text-center bg-transparent border-0 h-auto p-1 focus-visible:ring-0 focus-visible:ring-offset-0 text-primary font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            disabled={!isEditingGoals}
                        />
                    </div>
                </div>
              ))}
            </div>
            {selectionMode === 'rendimiento' && (
              <div className="text-center text-muted-foreground text-xs space-x-4 pt-2">
                <span><span className="font-bold text-foreground">AD:</span> 18-20</span>
                <span><span className="font-bold text-foreground">A:</span> 14 - 17.9</span>
                <span><span className="font-bold text-foreground">B:</span> 11 - 13.9</span>
                <span><span className="font-bold text-foreground">C:</span> &lt; 11</span>
              </div>
            )}
        </div>

        <div className="space-y-12">
            {/* Expediente completo: sustituye a las tres cifras sueltas
                (tiempo, tareas y favoritas) que había antes. */}
            <div className="pt-12" data-tour="expediente">
                <ProfileStats userProfile={userProfile} />
            </div>

            {/* Modo de medición + meta de racha a la izquierda; a la derecha,
                si esa meta se está cumpliendo (la racha). El Centro de informes
                que ocupaba este hueco pasó a la barra superior. */}
            <div className="grid grid-cols-1 gap-6 items-stretch lg:grid-cols-2">
                <div className="flex flex-col gap-4 h-full">
                    <Tabs value={selectionMode} onValueChange={(value) => setSelectionMode(value as 'rendimiento' | 'tiempo')} className="w-full">
                        <TabsList className="grid w-full grid-cols-2" data-tour="modo-medicion">
                            <TabsTrigger value="rendimiento" className="border-r">Rendimiento</TabsTrigger>
                            <TabsTrigger value="tiempo">Tiempo</TabsTrigger>
                        </TabsList>
                    </Tabs>
                    <Card className="w-full group/streak flex flex-col flex-grow">
                        <CardHeader className="relative flex flex-row items-center justify-center p-4">
                            <CardTitle className="text-lg font-bold text-primary flex-grow text-center">Meta de racha</CardTitle>
                            <div className="absolute right-4">
                                {isEditingStreakGoal ? (
                                    <div className="flex items-center gap-1">
                                        <Button onClick={handleSaveStreakGoal} size="icon" variant="ghost" className="h-7 w-7 text-green-500 hover:text-green-600"><Check className="h-4 w-4" /></Button>
                                        <Button onClick={handleCancelEditStreakGoal} size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:text-red-600"><X className="h-4 w-4" /></Button>
                                    </div>
                                ) : (
                                    <Button onClick={handleStartEditStreakGoal} data-tour="racha-editar" title="Cambiar la meta de racha" size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground opacity-0 group-hover/streak:opacity-100 transition-opacity"><Pencil className="h-4 w-4" /></Button>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="p-4 pt-0 flex flex-col flex-grow items-center justify-center">
                            {selectionMode === 'rendimiento' ? (
                                <div className="flex items-center justify-center gap-4">
                                    <Button size="icon" variant="ghost" onClick={() => handleChangeGrade('prev')} disabled={!isEditingStreakGoal || editedStreakValue === 'B'} className="h-8 w-8">
                                        <ChevronLeft className="h-6 w-6" />
                                    </Button>
                                    <span className="text-2xl font-bold w-12 text-center">
                                        {isEditingStreakGoal 
                                            ? editedStreakValue 
                                            : streakGoal.grade
                                        }
                                    </span>
                                    <Button size="icon" variant="ghost" onClick={() => handleChangeGrade('next')} disabled={!isEditingStreakGoal || editedStreakValue === 'AD'} className="h-8 w-8">
                                        <ChevronRight className="h-6 w-6" />
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex items-center justify-center gap-2">
                                    {isEditingStreakGoal ? (
                                        <Input
                                            type="number"
                                            value={editedStreakValue}
                                            onChange={(e) => setEditedStreakValue(e.target.value)}
                                            className="w-24 text-2xl font-bold text-center h-auto p-0 bg-transparent border-b border-dashed border-input focus-visible:ring-0 focus-visible:ring-offset-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                            autoFocus
                                        />
                                    ) : (
                                        <span className="text-2xl font-bold">{streakGoal.minutes}</span>
                                    )}
                                    <span className="text-sm text-muted-foreground">min</span>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <div data-tour="racha" className="flex flex-col [&>*]:flex-1"><StreakStatusCard /></div>
            </div>
        </div>

        <p className="pt-12 text-xs text-center text-muted-foreground">
          Frame {APP_VERSION} · Tus datos viven en este equipo · © 2026 VT Asvent
        </p>

        {/* ------------------------------------------------------------------
            Los tres documentos de la app. El texto vive en src/lib/legal/*
            como Markdown y lo pinta <LegalDocument />: así se actualiza un
            documento legal editando una cadena, y los campos que solo el
            titular puede rellenar se ven resaltados en vez de colarse.
            ------------------------------------------------------------------ */}
        <div className="flex flex-wrap items-center justify-center gap-2 text-center text-xs text-muted-foreground">
          {LEGAL_DIALOGS.map(({ key, label, title, subtitle, markdown }, index) => (
            <React.Fragment key={key}>
              {index > 0 && <span className="text-muted-foreground">·</span>}
              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    variant="link"
                    data-tour={`doc-${key}`}
                    className="h-auto p-0 text-xs font-normal text-muted-foreground hover:text-primary"
                  >
                    [{label}]
                  </Button>
                </DialogTrigger>
                <DialogContent className="flex max-h-[88vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
                  <DialogHeader className="shrink-0 border-b px-6 pb-4 pt-6">
                    <DialogTitle className="text-center text-xl font-bold text-primary">
                      {title}
                    </DialogTitle>
                    <p className="text-center text-[11px] text-muted-foreground">{subtitle}</p>
                  </DialogHeader>
                  {/* Scroll nativo, no ScrollArea: son documentos de decenas
                      de páginas y aquí hace falta una barra VISIBLE que diga
                      cuánto queda por leer. */}
                  <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
                    <LegalDocument markdown={markdown} />
                  </div>
                </DialogContent>
              </Dialog>
            </React.Fragment>
          ))}
        </div>


        {cropperOpen && imageToCrop && userProfile && (
            <AvatarCropper
            imageSrc={imageToCrop}
            onClose={() => {
                setCropperOpen(false);
                setImageToCrop(null);
            }}
            onSave={async (croppedImage) => {
                try {
                await saveImage(`profileAvatar_${userProfile.id}`, croppedImage);
                setProfileAvatar(croppedImage);
                window.dispatchEvent(new CustomEvent('profileUpdated'));
                toast({
                    title: "Avatar actualizado",
                    description: "Tu nueva foto de perfil ha sido guardada.",
                });
                } catch (e: any) {
                console.error("Failed to save avatar:", e);
                const isQuotaError = e.name === 'QuotaExceededError';
                toast({
                    variant: "destructive",
                    title: isQuotaError ? "Imagen Demasiado Grande" : "Error al Guardar",
                    description: isQuotaError
                    ? "La imagen es demasiado grande. Por favor, elige un archivo más pequeño."
                    : "Ocurrió un error inesperado al guardar el avatar.",
                });
                } finally {
                setCropperOpen(false);
                setImageToCrop(null);
                }
            }}
            />
        )}

    </div>
  );
}
