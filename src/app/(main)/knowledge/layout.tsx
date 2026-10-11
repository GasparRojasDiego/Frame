import React from 'react';
import { KnowledgeProvider } from '@/context/KnowledgeContext';

// Provider del módulo "Asignaturas", montado solo en esta ruta para mantener
// el módulo aislado del resto de Aether OS. Deriva el uid del userProfile.
export default function KnowledgeLayout({ children }: { children: React.ReactNode }) {
  return <KnowledgeProvider>{children}</KnowledgeProvider>;
}
