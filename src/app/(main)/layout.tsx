import React, { useEffect, useState, ReactNode, useCallback, useRef } from 'react';
import Header from '@/components/layout/header';
import Sidebar from '@/components/layout/sidebar';
import { CourseProvider, useCourse } from '@/context/CourseContext';
import OverdueTasksAlert from '@/components/tasks/OverdueTasksAlert';
import AuthForm from '@/components/auth/AuthForm';
import type { UserProfile, InterruptedSession } from '@/types';
import CompleteProfileForm from '@/components/auth/CompleteProfileForm';
import PageLoader from '@/components/layout/PageLoader';
import HelpButton from '@/components/help/HelpButton';
import { Toaster } from '@/components/ui/toaster';
import MusicPlayer from '@/components/music/MusicPlayer';
import { SidebarContent } from '@/components/layout/SidebarContent';
import { Button } from '@/components/ui/button';
import { ChevronRight, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import InterruptedSessionManager from '@/components/auth/InterruptedSessionManager';
import { clearRecoverableSession, readRecoverableSession } from '@/lib/session-recovery';
import { flushEvents, hookTelemetryFlushOnOnline, pruneTelemetryStamps, trackDaily, trackEvent } from '@/lib/telemetry';
import { usePathname } from '@/lib/navigation';
import { APP_VERSION } from '@/lib/version';
import MiniTimerCard from '@/components/temporizador/MiniTimerCard';
import AppCloseGuard from '@/components/layout/AppCloseGuard';
import { findGuestToAdopt, rememberAdoptionAnswer } from '@/lib/guest-migration';
import {
  clearGuestLinkPending,
  GUEST_NAME,
  mergeGuestIntoAccount,
  readPendingGuestLink,
  setGuestLinkState,
  usernameFromGoogle,
  type PendingGuestLink,
} from '@/lib/guest-link';
import GuestLinkOverlay from '@/components/auth/GuestLinkOverlay';
import { validateUsername } from '@/components/auth/AuthShell';

import StudyVideoHost from '@/components/temporizador/StudyVideoHost';
import ConstellationBackdrop from '@/components/layout/ConstellationBackdrop';
import InterfaceErrorBoundary from '@/components/layout/InterfaceErrorBoundary';
import NotionImportDialog from '@/components/extensions/NotionImportDialog';
import UpdateDialog from '@/components/layout/UpdateDialog';
import TourHost from '@/components/help/TourHost';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { getActiveSession, onAuthChange, tidyName, updatePersonNames, updateUsername } from '@/lib/supabase/auth';
import { pushToCloud, pullFromCloud } from '@/lib/supabase/sync';
import { startLiveSync } from '@/lib/supabase/live-sync';
import { startImageSync } from '@/lib/image-sync';
import { clearSessionLost, markSessionLost } from '@/lib/connection-status';
import ConnectionNotice from '@/components/layout/ConnectionNotice';
import { consumeIntentionalSignOut } from '@/lib/supabase/auth';
import { startUpdaterLoop, setUpdateBusyGuard } from '@/lib/updater';
import { onStorageQuotaError } from '@/lib/safe-storage';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { getImage } from '@/lib/music-db';
import { useToast } from '@/hooks/use-toast';
import type { Session } from '@supabase/supabase-js';



function AppLayout({ children, userProfile }: { children: ReactNode; userProfile: UserProfile | null }) {
    const { currentSong, isPlaying, isTimerActive, hasInteracted, isPlayerVisible, setPlayerVisible, isSidebarCollapsed } = useCourse();
    const { toast } = useToast();
    const silentAudioRef = useRef<HTMLAudioElement>(null);
    const wakeLockSentinelRef = useRef<any>(null); // Use 'any' as WakeLockSentinel might not be in default TS libs
    const [isMobileNavOpen, setMobileNavOpen] = useState(false);

    useEffect(() => {
        const shouldStayAwake = isPlaying || isTimerActive;

        // --- Silent Audio for Background Wake Lock ---
        // This is a robust fallback for when the tab is not in the foreground.
        const audio = silentAudioRef.current;
        if (audio) {
            // Only attempt to play after the user has interacted with the document
            if (shouldStayAwake && hasInteracted) {
                const playPromise = audio.play();
                if (playPromise !== undefined) {
                    playPromise.catch(error => {
                        // Autoplay was prevented. This is a standard browser behavior.
                    });
                }
            } else {
                audio.pause();
            }
        }

        // --- Screen Wake Lock API for Foreground Wake Lock ---
        // This is the primary method when the tab is active.
        const manageWakeLock = async () => {
            if ('wakeLock' in navigator) {
                if (shouldStayAwake && !wakeLockSentinelRef.current) {
                    try {
                        const wakeLock = await navigator.wakeLock.request('screen');
                        wakeLock.onrelease = () => {
                            // The lock was released by the system (e.g., tab visibility change).
                            wakeLockSentinelRef.current = null;
                        };
                        wakeLockSentinelRef.current = wakeLock;
                    } catch (err) {
                        // The request can fail if the document is not visible, etc. This is not a critical error.
                    }
                } else if (!shouldStayAwake && wakeLockSentinelRef.current) {
                    // Use a variable to avoid race conditions with the ref
                    const lock = wakeLockSentinelRef.current;
                    await lock.release();
                    wakeLockSentinelRef.current = null;
                }
            }
        };

        manageWakeLock();
        
        // Cleanup function to release the lock if the component unmounts while active.
        return () => {
            if (wakeLockSentinelRef.current) {
                wakeLockSentinelRef.current.release();
                wakeLockSentinelRef.current = null;
            }
        };

    }, [isPlaying, isTimerActive, hasInteracted]);

    // Quedarse sin espacio es la vía más silenciosa de perder datos: el
    // guardado falla, la app sigue como si nada y el trabajo del día se
    // esfuma al recargar. Aquí se avisa en cuanto ocurre.
    useEffect(() => {
        onStorageQuotaError((key) => {
            toast({
                variant: 'destructive',
                title: 'No hay espacio para guardar',
                description:
                    `Frame no pudo guardar «${key}». Libera espacio en el equipo o borra grabaciones y música que ya no uses; hasta entonces tus cambios podrían no conservarse.`,
            });
        });
        return () => onStorageQuotaError(null);
    }, [toast]);

    // Nada de reiniciar para actualizar mientras el usuario está estudiando o
    // escuchando música: el actualizador lo consulta antes de instalar (y el
    // recuadro de actualización no deja confirmar mientras dure).
    useEffect(() => {
        setUpdateBusyGuard(() => isTimerActive || isPlaying);
        return () => setUpdateBusyGuard(null);
    }, [isTimerActive, isPlaying]);

    // Lo que guardaban funciones que ya no existen (réplica de Spotify, letras
    // en línea, la posición recordada de Música): fuera, una vez.
    useEffect(() => {
        for (const key of ['spotifyReplicaJob', 'lyricsOfflineAnswer', 'musicLibraryPlace']) {
            try {
                localStorage.removeItem(key);
            } catch {
                /* sin almacenamiento: nada que limpiar */
            }
        }
    }, []);

    // Vistazo al horario desde el borde izquierdo de la pantalla. El vigilante
    // del cursor vive en Rust y nace apagado: encenderlo sin imagen guardada
    // abriría una ventana vacía cada vez que el ratón roza el borde.
    useEffect(() => {
        if (!isTauri()) return;
        let alive = true;
        const sync = async () => {
            const image = await getImage('scheduleImage').catch(() => null);
            if (!alive) return;
            void invoke('schedule_peek_enable', { enabled: Boolean(image) }).catch(() => undefined);
        };
        void sync();
        window.addEventListener('scheduleImageUpdated', sync);
        return () => {
            alive = false;
            window.removeEventListener('scheduleImageUpdated', sync);
            void invoke('schedule_peek_enable', { enabled: false }).catch(() => undefined);
        };
    }, []);


    return (
        // Sin `bg-background`: el color de fondo lo pone <body> y así el
        // lienzo de la constelación (que va a -z-10) queda a la vista.
        <div className="relative flex h-screen text-foreground">
            <ConstellationBackdrop />
            <Sidebar userProfile={userProfile} />

            {/* Mobile sidebar and trigger - CORRECCIÓN MAGISTRAL DE CAPAS */}
            <div className="md:hidden">
                {/* Hover trigger area (Z-30) */}
                <div className="group fixed left-0 top-1/2 -translate-y-1/2 z-30 h-48 w-12">
                    <Button
                        variant="secondary"
                        className={cn(
                            "absolute left-0 top-1/2 -translate-y-1/2 z-10 h-24 w-8 rounded-l-none p-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100",
                            isMobileNavOpen && "!opacity-0 pointer-events-none"
                        )}
                        onClick={() => setMobileNavOpen(true)}
                    >
                        <ChevronRight className="h-5 w-5" />
                    </Button>
                </div>
                
                {/* Overlay (AHORA Z-40: QUEDA DEBAJO DEL SIDEBAR) */}
                {isMobileNavOpen && (
                    <div 
                        className="fixed inset-0 bg-black/60 z-40 animate-in fade-in-0" 
                        onClick={() => setMobileNavOpen(false)}
                    />
                )}

                {/* Mobile Sidebar content (AHORA Z-50: QUEDA ENCIMA DE TODO) */}
                <div className={cn(
                    "fixed top-0 left-0 h-full w-[250px] z-50 transition-transform duration-300 ease-in-out shadow-2xl",
                    isMobileNavOpen ? "translate-x-0" : "-translate-x-full"
                )}>
                    <SidebarContent userProfile={userProfile} onLinkClick={() => setMobileNavOpen(false)} showCloseButton={true} hostDialogs={false} />
                </div>
            </div>

            {/* `min-w-0`: sin él este item flexible conserva su `min-width:
                auto` y cualquier contenido ancho (una tabla, un calendario)
                estira toda la app en lugar de desplazarse dentro de su caja. */}
            <div className="flex min-w-0 flex-1 flex-col">
                <Header userProfile={userProfile} />
                {/* Invitado: la «G» del pie del menú vincula su cuenta (GuestLinkBadge).
                    Cuenta: «Sin conexión» sube a la campana (ConnectionNotice). */}
                {userProfile && !userProfile.isGuest && <ConnectionNotice uid={userProfile.id} />}
                <div className="flex-1 flex flex-col min-h-0">
                    {/* `relative` envuelve SOLO el área con scroll: el botón de
                        la ayuda queda en su esquina, siempre por encima del
                        reproductor de música. */}
                    <div className="relative flex min-h-0 flex-1 flex-col">
                    <div className="flex-1 overflow-y-auto">
                        {/* h-full: las interfaces incrustadas (Calendario,
                            Gmail, YouTube, Drive) se centran verticalmente en
                            el espacio real, con o sin barra de reproducción. */}
                        {/* La frontera va DENTRO de <main>: si una interfaz
                            revienta, el sidebar y la cabecera siguen en pie y
                            el usuario tiene por dónde salir. */}
                        <main className="h-full">
                            <InterfaceErrorBoundary>
                                {children}
                            </InterfaceErrorBoundary>
                        </main>
                    </div>
                    <HelpButton />
                    </div>
                    {currentSong && <MusicPlayer />}
                </div>
            </div>
            
            {/* Show Music Player Button */}
            {currentSong && !isPlayerVisible && (
                <div className={cn(
                    "group fixed bottom-0 z-30 h-12",
                    "left-0 right-0",
                    isSidebarCollapsed ? "md:left-[68px]" : "md:left-[250px]"
                )}>
                    <Button
                        variant="secondary"
                        className="absolute bottom-0 left-1/2 -translate-x-1/2 z-10 h-8 w-24 rounded-b-none p-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                        onClick={() => setPlayerVisible(true)}
                    >
                        <ChevronUp className="h-5 w-5" />
                    </Button>
                </div>
            )}


            {/* Mini temporizador flotante: visible en cualquier interfaz */}
            <MiniTimerCard />

            {/* Despedida: sólo interrumpe el cierre si hay sesión en curso */}
            <AppCloseGuard />
            {/* Reproductor de vídeos de estudio: vive aquí para no desmontarse
                al cambiar de interfaz (Enfoque solo le reserva el hueco). */}
            <StudyVideoHost />

            {/*
                This silent audio element provides a robust way to prevent system sleep
                when the app is in the background but has an active process.
            */}
            <audio
                ref={silentAudioRef}
                src="data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA="
                loop
            />
        </div>
    );
}

function MainApp({ children, userProfile }: { children: ReactNode; userProfile: UserProfile | null }) {
  const [interruptedSession, setInterruptedSession] = useState<InterruptedSession | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  useEffect(() => {
    if (userProfile) {
      // Una sola comprobación al arrancar. Mira TODAS las huellas que pudo
      // dejar una sesión perdida, no solo la del cierre limpio.
      setInterruptedSession(readRecoverableSession(userProfile.id));
    }
    setIsCheckingSession(false);
    // Por id, no por objeto: es una comprobación de ARRANQUE. Editar el nombre o
    // el avatar crea un perfil nuevo con el mismo id y reabría el rescate sobre
    // la sesión viva, leyendo su propio latido como si fuera una sesión perdida.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile?.id]);

  // Uso: una apertura al día por estudiante y una marca por pantalla al día.
  // Es lo que permite saber cuántos usan Frame CADA día y qué abren; nunca
  // viaja contenido. Ver src/lib/telemetry.ts.
  const pathname = usePathname();
  useEffect(() => {
    if (!userProfile) return;
    pruneTelemetryStamps();
    hookTelemetryFlushOnOnline();
    trackDaily('app_open', 'app', { version: APP_VERSION, guest: userProfile.isGuest === true });
    void flushEvents();
  }, [userProfile]);

  useEffect(() => {
    if (!userProfile) return;
    const screen = pathname.replace(/\/index\.html$/, '').replace(/\/$/, '') || '/';
    trackDaily('screen_view', screen, { screen });
  }, [pathname, userProfile]);

  // Sincronización en la nube (solo usuarios autenticados): respaldo periódico + al cerrar.
  //
  // Depende del ID y no del objeto de perfil: cambiar el nombre o el avatar
  // crea un objeto nuevo, y con él este efecto se desmontaba y volvía a montar
  // lanzando una sincronización completa de propina.
  const syncUid = userProfile && !userProfile.isGuest ? userProfile.id : null;
  useEffect(() => {
    if (!syncUid || !isSupabaseConfigured) return;
    const uid = syncUid;

    // En vivo: sube al cambiar algo, avisa a los otros dispositivos por
    // Realtime y baja en cuanto ellos avisan (lib/supabase/live-sync.ts).
    const stopLiveSync = startLiveSync(uid);
    // Y las imágenes de la cuenta (foto de perfil, horario, portadas):
    // lib/image-sync.ts.
    const stopImageSync = startImageSync(uid);
    const handleUnload = () => { void pushToCloud(uid); };
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      stopLiveSync();
      stopImageSync();
      window.removeEventListener('beforeunload', handleUnload);
      void pushToCloud(uid);
    };
  }, [syncUid]);

  const handleSessionHandled = () => {
    if (userProfile) clearRecoverableSession(userProfile.id);
    setInterruptedSession(null);
  };

  if (isCheckingSession) {
    return <PageLoader />;
  }

  return (
    <CourseProvider userProfile={userProfile}>
      <AppLayout userProfile={userProfile}>{children}</AppLayout>
      <Toaster />
      {/* Alerta diaria de tareas vencidas (reprogramar/culminar/eliminar) */}
      <OverdueTasksAlert />
      {/* Importador de Notion: lo abre su botón en Ajustes (y el atajo /notion de la Ayuda). */}
      <NotionImportDialog />
      {/* Recuadro de actualización: lo abren el testigo junto al perfil y la campana. */}
      <UpdateDialog />
      {/* Recorrido «Descubrir» de la ayuda: vive aquí para sobrevivir a los cambios de interfaz. */}
      <TourHost />
      {interruptedSession && (
        <InterruptedSessionManager
          session={interruptedSession}
          onDone={handleSessionHandled}
        />
      )}
    </CourseProvider>
  );
}

function AppController({ children }: { children: React.ReactNode }) {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authStatus, setAuthStatus] = useState<'loading' | 'unauthenticated' | 'needs-completion' | 'authenticated'>('loading');

  // Actualizaciones: solo se MIRA si hay versión nueva (testigo del sidebar y
  // campana). Instalar lo decide el usuario en el recuadro de actualización.
  useEffect(() => startUpdaterLoop(), []);

  useEffect(() => {
    /** Usuario ya hidratado en este arranque: evita repetir el trabajo. */
    let hydratedUid: string | null = null;
    /** Traslado de invitado en marcha (evita hacerlo dos veces a la vez). */
    let guestLinkInFlight = false;

    const loadProfile = () => {
      try {
        let storedProfileRaw = localStorage.getItem('userProfile');
        if (storedProfileRaw) {
          try {
            JSON.parse(storedProfileRaw);
          } catch {
            // Quedó truncado (cierre a medias): vale la última copia buena.
            const backup = localStorage.getItem('userProfile__bak');
            if (backup) storedProfileRaw = backup;
          }
        }
        if (storedProfileRaw) {
          let profile: UserProfile = JSON.parse(storedProfileRaw);

          // --- ID Validation and Regeneration ---
          // Dos formas válidas de id: los 12 dígitos de un perfil local y el UUID
          // de una cuenta de Supabase. Antes solo se aceptaba la primera, y esta
          // función se ejecuta también al guardar el nombre o el avatar en
          // Ajustes: a quien entraba con Google se le REGENERABA el id, la app
          // pasaba a leer claves vacías (todo "desaparecía" hasta reiniciar) y
          // la nube dejaba de sincronizar por no coincidir el id con la sesión.
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(profile.id ?? '');
          const isValidId = !!profile.id && (/^\d{12}$/.test(profile.id) || isUuid);
          if (!isValidId) {
              const timestampPart = String(Date.now()).slice(-8);
              const randomPart = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
              profile.id = timestampPart + randomPart;
              localStorage.setItem('userProfile', JSON.stringify(profile));
          }
          // --- End ID Validation ---
          
          // --- CreatedAt Back-fill ---
          if (!profile.createdAt) {
              profile.createdAt = new Date().toISOString();
              localStorage.setItem('userProfile', JSON.stringify(profile));
          }
          // --- End CreatedAt Back-fill ---

          if (profile.username) {
            try {
              localStorage.setItem('userProfile__bak', JSON.stringify(profile));
            } catch {
              /* sin espacio para la copia: el perfil principal sigue valiendo */
            }
            // Camino sin red de una cuenta: sin esto, el SIGNED_IN que supabase-js
            // repite al recuperar el foco disparaba una rehidratación completa.
            if (!profile.isGuest) hydratedUid = profile.id;
            setUserProfile(profile);
            setAuthStatus('authenticated');
          } else {
            setAuthStatus('needs-completion');
          }
        } else {
          setAuthStatus('unauthenticated');
        }
      } catch (e) {
        console.error("Failed to parse user profile from localStorage", e);
        // El perfil es la llave de todos los datos (`courses_<id>`, `tasks_<id>`…):
        // borrarlo a ciegas los dejaba huérfanos. El valor ilegible se aparta
        // por si hay que rescatar el id a mano, y se vuelve al acceso.
        try {
          const broken = localStorage.getItem('userProfile');
          if (broken) localStorage.setItem('userProfile__corrupt', broken);
          localStorage.removeItem('userProfile');
        } catch {
          /* almacenamiento vetado: nada más que hacer */
        }
        setAuthStatus('unauthenticated');
      }
    };
    
    const hydrateFromSession = async (session: Session, fresh = false) => {
      const user = session.user;
      hydratedUid = user.id;
      // Sesión viva de nuevo: fuera el aviso de «vuelve a entrar».
      clearSessionLost();
      const username = (user.user_metadata?.username as string) || '';
      const firstNames = String(user.user_metadata?.first_names ?? '').trim();
      const lastNames = String(user.user_metadata?.last_names ?? '').trim();
      const profile: UserProfile = {
        id: user.id,
        username,
        isGuest: false,
        email: user.email ?? undefined,
        createdAt: user.created_at || new Date().toISOString(),
        ...(firstNames ? { firstNames } : {}),
        ...(lastNames ? { lastNames } : {}),
      };

      // Nube -> local antes de montar la app. Con tope: en una red lenta
      // (la del colegio) la espera no puede ser indefinida. Si se agota, se
      // entra con lo que hay en el equipo y el siguiente ciclo de
      // sincronización fusiona la nube (fusión a tres bandas: no pisa nada).
      try {
        await Promise.race([pullFromCloud(user.id), new Promise((resolve) => setTimeout(resolve, 12_000))]);
      } catch (e) {
        console.error('pullFromCloud failed', e);
      }

      // --- Invitado que vincula su cuenta de Google (ver guest-link.ts) ---
      // La marca se deja justo antes de abrir la sesión: si Frame se cerró a
      // mitad, este arranque termina el trabajo. La fusión solo AÑADE, así
      // que repetirla nunca duplica ni borra nada.
      //
      // Al restaurar la sesión en el arranque (!fresh) la marca es siempre de
      // esta cuenta. En un inicio de sesión NUEVO solo vale si es reciente: una
      // marca vieja (Frame se cerró entre la marca y la sesión) podría ser de
      // otra persona que usó este equipo; entonces se pregunta, como a
      // cualquier invitado del equipo.
      let pending = readPendingGuestLink();
      if (pending && fresh && !(Date.now() - Date.parse(pending.startedAt) < 30 * 60_000)) {
        clearGuestLinkPending();
        pending = null;
      }
      let linkedGuest: PendingGuestLink | null = null;
      if (pending && !guestLinkInFlight) {
        guestLinkInFlight = true;
        setGuestLinkState({ phase: 'merging' });
        try {
          const result = await mergeGuestIntoAccount(
            { id: pending.guestId, username: pending.username, createdAt: pending.createdAt },
            user.id,
            pending.picture
          );
          clearGuestLinkPending();
          linkedGuest = pending;
          setGuestLinkState({ phase: 'uploading', result });
          try {
            await Promise.race([pushToCloud(user.id), new Promise((resolve) => setTimeout(resolve, 15_000))]);
          } catch {
            /* el ciclo automático lo subirá en un minuto */
          }
          setGuestLinkState({ phase: 'done', result });
        } catch (e: any) {
          console.error('No se pudo vincular el invitado', e);
          setGuestLinkState({ phase: 'error', message: e?.message ? String(e.message) : undefined });
        } finally {
          guestLinkInFlight = false;
        }
      } else if (fresh) {
        // Se entró con Google desde la pantalla de acceso y en este equipo
        // queda un perfil de invitado con datos: se ofrece sumarlo.
        const guest = findGuestToAdopt(user.id);
        if (guest) {
          const bring = window.confirm(
            `En este equipo usaste Frame como invitado${guest.username ? ` («${guest.username}»)` : ''} y hay asignaturas, tareas o sesiones guardadas.\n\n¿Quieres sumarlas a tu cuenta?\n\nAceptar: se suman a tu cuenta (sin borrar nada de lo que ya tenía) y se respaldan en la nube.\nCancelar: tu cuenta sigue como está (los datos de invitado no se borran).`
          );
          rememberAdoptionAnswer(user.id);
          if (bring) {
            setGuestLinkState({ phase: 'merging' });
            try {
              const result = await mergeGuestIntoAccount(guest, user.id);
              setGuestLinkState({ phase: 'uploading', result });
              try {
                await Promise.race([pushToCloud(user.id), new Promise((resolve) => setTimeout(resolve, 15_000))]);
              } catch {
                /* el ciclo automático lo subirá */
              }
              setGuestLinkState({ phase: 'done', result });
            } catch (e: any) {
              setGuestLinkState({ phase: 'error', message: e?.message ? String(e.message) : undefined });
            }
          }
        }
      }

      // Cuenta NUEVA que viene de un invitado: el perfil se completa solo con
      // el nombre que dio Google, sin otra pantalla. Si algo falla, «Completa
      // tu perfil» aparece con el nombre de usuario ya escrito.
      let finalUsername = username;
      let finalFirst = firstNames;
      let finalLast = lastNames;
      if (!finalUsername && linkedGuest) {
        const auto = {
          username:
            linkedGuest.username && linkedGuest.username !== GUEST_NAME
              ? linkedGuest.username.slice(0, 12)
              : usernameFromGoogle(linkedGuest.firstNames, 'Estudiante'),
          firstNames: tidyName(linkedGuest.firstNames ?? ''),
          lastNames: tidyName(linkedGuest.lastNames ?? ''),
        };
        finalFirst = finalFirst || auto.firstNames;
        finalLast = finalLast || auto.lastNames;
        if (!validateUsername(auto.username)) {
          try {
            const saved = await updateUsername(auto.username);
            if (!saved.error) {
              finalUsername = auto.username;
              // Los nombres de Google son un extra: si fallan, no frenan nada.
              if (auto.firstNames || auto.lastNames) await updatePersonNames(auto).catch(() => undefined);
            }
          } catch {
            /* se completará a mano */
          }
        }
      }
      const finalProfile: UserProfile = {
        ...profile,
        username: finalUsername,
        ...(finalFirst ? { firstNames: finalFirst } : {}),
        ...(finalLast ? { lastNames: finalLast } : {}),
      };

      localStorage.setItem('userProfile', JSON.stringify(finalProfile));
      // Solo los inicios de sesión de verdad, no cada arranque con sesión viva.
      if (fresh) trackEvent('account_signed_in', { provider: String(user.app_metadata?.provider ?? 'email') });
      if (linkedGuest) {
        const since = Date.parse(linkedGuest.createdAt);
        trackEvent('guest_linked', {
          days_as_guest: Number.isNaN(since) ? -1 : Math.floor((Date.now() - since) / 86_400_000),
          auto_profile: Boolean(finalUsername),
        });
      }
      setUserProfile(finalProfile);
      setAuthStatus(finalUsername ? 'authenticated' : 'needs-completion');
    };

    const init = async () => {
      if (isSupabaseConfigured) {
        try {
          const session = await getActiveSession();
          if (session?.user) {
            await hydrateFromSession(session);
            return;
          }
        } catch (e) {
          console.error('Supabase session check failed', e);
        }
      }
      loadProfile(); // Fallback: perfil local / invitado
    };

    init();

    // Listen for custom event to reload profile
    window.addEventListener('profileUpdated', loadProfile);

    const unsubscribe = isSupabaseConfigured
      ? onAuthChange((event, session) => {
          if (event === 'SIGNED_IN' && session?.user) {
            // supabase-js repite SIGNED_IN cada vez que la ventana recupera el
            // foco. Rehidratar ahí suponía, en CADA alt-tab: una sincronización
            // completa con la nube, recargar todo el estado desde disco, releer
            // todas las canciones de IndexedDB y reiniciar la cola de música.
            // Solo se hidrata cuando de verdad entra un usuario distinto.
            if (session.user.id === hydratedUid) return;
            void hydrateFromSession(session, true);
          } else if (event === 'SIGNED_OUT') {
            // ¿Lo pidió el usuario? Si no (la nube cerró la sesión por su
            // cuenta: token revocado, cambio de contraseña…), NO se le echa:
            // sus datos siguen en el equipo y una franja le ofrece volver a
            // entrar cuando quiera para seguir sincronizando.
            if (!consumeIntentionalSignOut()) {
              const current = hydratedUid;
              if (current) markSessionLost(current);
              return;
            }
            hydratedUid = null;
            localStorage.removeItem('userProfile');
            setUserProfile(null);
            setAuthStatus('unauthenticated');
          }
        })
      : () => {};

    return () => {
      window.removeEventListener('profileUpdated', loadProfile);
      unsubscribe();
    };
  }, []);

  const handleAuthSuccess = useCallback(() => {
    // This is called after a guest profile is created and stored in localStorage.
    // The next step is to complete the profile.
    setAuthStatus('needs-completion');
  }, []);

  const handleProfileComplete = useCallback((completedProfile: UserProfile) => {
    // The form has already saved the full profile to localStorage.
    // Now we update the state to render the main app.
    setUserProfile(completedProfile);
    setAuthStatus('authenticated');
  }, []);


  if (authStatus === 'loading') {
    return <PageLoader />;
  }
  
  if (authStatus === 'authenticated' && userProfile) {
    return (
      <>
        <MainApp key={userProfile.id} userProfile={userProfile}>{children}</MainApp>
        <GuestLinkOverlay />
      </>
    );
  }

  if (authStatus === 'needs-completion') {
    // El <Toaster /> de MainApp no existe todavía en estas dos pantallas: sin
    // el suyo propio, todos los avisos del acceso (contraseña incorrecta,
    // «confirma tu correo», errores de Google) se perdían sin verse.
    return (
      <>
        <CompleteProfileForm onProfileComplete={handleProfileComplete} />
        <Toaster />
        <GuestLinkOverlay />
      </>
    );
  }

  // Default to unauthenticated
  return (
    <>
      <AuthForm onAuthSuccess={handleAuthSuccess} />
      <Toaster />
      <GuestLinkOverlay />
    </>
  );
}


export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return <AppController>{children}</AppController>;
}
