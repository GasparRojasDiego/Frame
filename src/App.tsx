import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from '@/app/(main)/layout';
import DashboardPage from '@/app/(main)/page';

// Mapa de rutas de Frame: mismas URLs que Aether OS, resueltas en cliente.
//
// Inicio va en el paquete de arranque; cada otra interfaz es un trozo aparte
// que se lee al abrirla. Para que abrirla siga siendo instantáneo, todos se
// precargan en cuanto el equipo queda libre tras el arranque.
const pages = {
  tareas: () => import('@/app/(main)/tareas/page'),
  habitos: () => import('@/app/(main)/habitos/page'),
  temporizador: () => import('@/app/(main)/temporizador/page'),
  calendario: () => import('@/app/(main)/calendario/page'),
  gmail: () => import('@/app/(main)/gmail/page'),
  youtube: () => import('@/app/(main)/youtube/page'),
  classroom: () => import('@/app/(main)/classroom/page'),
  music: () => import('@/app/(main)/music/page'),
  playlists: () => import('@/app/(main)/playlists/page'),
  cursos: () => import('@/app/(main)/cursos/page'),
  knowledge: () => import('@/app/(main)/knowledge/page'),
  knowledgeLayout: () => import('@/app/(main)/knowledge/layout'),
  settings: () => import('@/app/(main)/settings/page'),
  ayuda: () => import('@/app/(main)/ayuda/page'),
  uso: () => import('@/app/(main)/uso/page'),
};

const TareasPage = lazy(pages.tareas);
const HabitosPage = lazy(pages.habitos);
const TemporizadorPage = lazy(pages.temporizador);
const CalendarioPage = lazy(pages.calendario);
const GmailPage = lazy(pages.gmail);
const YoutubePage = lazy(pages.youtube);
const ClassroomPage = lazy(pages.classroom);
const MusicPage = lazy(pages.music);
const PlaylistsPage = lazy(pages.playlists);
const CursosPage = lazy(pages.cursos);
const KnowledgePage = lazy(pages.knowledge);
const KnowledgeLayout = lazy(pages.knowledgeLayout);
const SettingsPage = lazy(pages.settings);
const AyudaPage = lazy(pages.ayuda);
const UsagePage = lazy(pages.uso);

function usePrefetchPages() {
  useEffect(() => {
    const load = () => Object.values(pages).forEach((page) => void page().catch(() => undefined));
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(load, { timeout: 4000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(load, 1500);
    return () => window.clearTimeout(id);
  }, []);
}

export default function App() {
  usePrefetchPages();
  return (
    <MainLayout>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/tareas" element={<TareasPage />} />
          <Route path="/habitos" element={<HabitosPage />} />
          <Route path="/temporizador" element={<TemporizadorPage />} />
          <Route path="/calendario" element={<CalendarioPage />} />
          <Route path="/gmail" element={<GmailPage />} />
          <Route path="/youtube" element={<YoutubePage />} />
          <Route path="/classroom" element={<ClassroomPage />} />
          <Route path="/music" element={<MusicPage />} />
          <Route path="/playlists" element={<PlaylistsPage />} />
          <Route path="/cursos" element={<CursosPage />} />
          <Route
            path="/knowledge"
            element={
              <KnowledgeLayout>
                <KnowledgePage />
              </KnowledgeLayout>
            }
          />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/ayuda" element={<AyudaPage />} />
          {/* Panel de uso: solo existe para el responsable de Frame; para el
              resto la propia página redirige a Inicio. */}
          <Route path="/uso" element={<UsagePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </MainLayout>
  );
}
