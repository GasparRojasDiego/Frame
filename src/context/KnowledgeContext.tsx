// Estado del módulo "Asignaturas". Provider hermano de CourseContext: NO crea
// una identidad propia, deriva el `uid` del mismo `userProfile` de Aether OS
// (localStorage), de modo que el contenido queda particionado por usuario
// igual que el resto de la app. Las lecturas reactivas se hacen con
// `useLiveQuery` en los componentes (scoped por `uid`); aquí se centralizan
// las mutaciones para que todas sellen el `uid` y normalicen los datos.

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import {
  db,
  migrateKNData,
  tableForMaterial,
  exportKnowledge,
  importKnowledge,
} from '@/lib/knowledge-db';
import type { MaterialType } from '@/types';

interface MaterialPosition {
  type: MaterialType;
  id: number;
  createdAt: number;
  columnIndex: number;
}

interface KnowledgeContextValue {
  uid: string | null;
  ready: boolean;
  // Asignaturas
  addSubject: (name: string) => Promise<void>;
  updateSubject: (id: number, changes: { name?: string; image?: string }) => Promise<void>;
  deleteSubject: (id: number, name: string) => Promise<void>;
  // Temas
  addTopic: (subjectName: string, title: string) => Promise<void>;
  updateTopic: (id: number, title: string) => Promise<void>;
  deleteTopic: (id: number) => Promise<void>;
  // Grupos
  saveGroup: (
    subjectName: string,
    data: { id?: number; name: string; image?: string },
    topicIds: number[]
  ) => Promise<void>;
  // Materiales
  addMaterial: (type: MaterialType, topicId: number, payload: Record<string, any>) => Promise<void>;
  addResourceFile: (topicId: number, file: File, columnIndex: number) => Promise<void>;
  updateMaterial: (type: MaterialType, id: number, payload: Record<string, any>) => Promise<void>;
  deleteMaterial: (type: MaterialType, id: number) => Promise<void>;
  persistPositions: (positions: MaterialPosition[]) => Promise<void>;
  // Respaldo
  exportData: () => Promise<string>;
  importData: (json: string) => Promise<void>;
}

const KnowledgeContext = createContext<KnowledgeContextValue | undefined>(undefined);

function readUid(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('userProfile');
    if (!raw) return null;
    const profile = JSON.parse(raw);
    return typeof profile?.id === 'string' ? profile.id : null;
  } catch {
    return null;
  }
}

export function KnowledgeProvider({ children }: { children: React.ReactNode }) {
  const [uid, setUid] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // Resuelve el uid desde el perfil de Aether OS y lo mantiene sincronizado.
  useEffect(() => {
    const sync = () => setUid(readUid());
    sync();
    window.addEventListener('profileUpdated', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('profileUpdated', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  // Migración única al resolver el uid.
  useEffect(() => {
    if (!uid) {
      setReady(false);
      return;
    }
    let active = true;
    setReady(false);
    migrateKNData(uid).finally(() => {
      if (active) setReady(true);
    });
    return () => {
      active = false;
    };
  }, [uid]);

  const addSubject = useCallback(async (name: string) => {
    if (!uid || !name.trim()) return;
    await db.categories.add({ uid, name: name.trim() });
  }, [uid]);

  // Actualiza la asignatura. Si cambia el nombre, propaga el rename a temas
  // (Topic.category) y grupos (TopicGroup.subjectName) para no dejar huérfanos
  // (KN no lo hacía: renombrar dejaba temas apuntando al nombre viejo).
  const updateSubject = useCallback(async (id: number, changes: { name?: string; image?: string }) => {
    if (!uid) return;
    const current = await db.categories.get(id);
    const newName = changes.name?.trim();
    await db.categories.update(id, {
      ...(newName ? { name: newName } : {}),
      ...(changes.image !== undefined ? { image: changes.image } : {}),
    });
    if (current && newName && newName !== current.name) {
      const topics = await db.studyItems.where('uid').equals(uid).filter((t) => t.category === current.name).toArray();
      await Promise.all(topics.map((t) => db.studyItems.update(t.id!, { category: newName })));
      const groups = await db.topicGroups.where('uid').equals(uid).filter((g) => g.subjectName === current.name).toArray();
      await Promise.all(groups.map((g) => db.topicGroups.update(g.id!, { subjectName: newName })));
    }
  }, [uid]);

  const deleteSubject = useCallback(async (id: number, name: string) => {
    if (!uid) return;
    // Cascada: temas de la asignatura + sus materiales + grupos.
    const topics = await db.studyItems.where('uid').equals(uid).filter((t) => t.category === name).toArray();
    const topicIds = topics.map((t) => t.id!).filter((x) => x != null);
    await Promise.all(
      (['resources', 'formulas', 'concepts', 'keyData', 'meanings', 'quizzes', 'procedures'] as const).map(
        async (table) => {
          const rows = await db.table(table).where('topicId').anyOf(topicIds).toArray();
          await Promise.all(rows.map((r: any) => db.table(table).delete(r.id)));
        }
      )
    );
    await db.studyItems.bulkDelete(topicIds);
    const groups = await db.topicGroups.where('uid').equals(uid).filter((g) => g.subjectName === name).toArray();
    await db.topicGroups.bulkDelete(groups.map((g) => g.id!).filter((x) => x != null));
    await db.categories.delete(id);
  }, [uid]);

  const addTopic = useCallback(async (subjectName: string, title: string) => {
    if (!uid || !title.trim() || !subjectName) return;
    await db.studyItems.add({
      uid,
      title: title.trim(),
      content: '',
      category: subjectName,
      mastered: false,
      createdAt: Date.now(),
      reviewLevel: 0,
      nextReview: Date.now(),
    });
  }, [uid]);

  const updateTopic = useCallback(async (id: number, title: string) => {
    if (!title.trim()) return;
    await db.studyItems.update(id, { title: title.trim() });
  }, []);

  const deleteTopic = useCallback(async (id: number) => {
    // Cascada de materiales del tema (KN dejaba huérfanos; aquí se limpian).
    await Promise.all(
      (['resources', 'formulas', 'concepts', 'keyData', 'meanings', 'quizzes', 'procedures'] as const).map(
        async (table) => {
          const rows = await db.table(table).where('topicId').equals(id).toArray();
          await Promise.all(rows.map((r: any) => db.table(table).delete(r.id)));
        }
      )
    );
    await db.studyItems.delete(id);
  }, []);

  const saveGroup = useCallback(async (
    subjectName: string,
    data: { id?: number; name: string; image?: string },
    topicIds: number[]
  ) => {
    if (!uid || !data.name.trim()) return;
    const wanted = new Set(topicIds);

    if (data.id) {
      await db.topicGroups.update(data.id, { name: data.name.trim(), image: data.image });
      const existing = await db.studyItems.where({ groupId: data.id }).toArray();
      const existingIds = new Set(existing.map((t) => t.id!));
      const toRemove = [...existingIds].filter((id) => !wanted.has(id));
      const toAdd = [...wanted].filter((id) => !existingIds.has(id));
      await Promise.all([
        ...toRemove.map((id) => db.studyItems.update(id, { groupId: undefined as any })),
        ...toAdd.map((id) => db.studyItems.update(id, { groupId: data.id })),
      ]);
    } else {
      const groupId = await db.topicGroups.add({
        uid,
        name: data.name.trim(),
        image: data.image,
        subjectName,
        createdAt: Date.now(),
      });
      await Promise.all([...wanted].map((id) => db.studyItems.update(id, { groupId: groupId as number })));
    }
  }, [uid]);

  const addMaterial = useCallback(async (type: MaterialType, topicId: number, payload: Record<string, any>) => {
    await db.table(tableForMaterial(type)).add({ ...payload, topicId, createdAt: Date.now() });
  }, []);

  const addResourceFile = useCallback(async (topicId: number, file: File, columnIndex: number) => {
    await db.resources.add({
      topicId,
      name: file.name,
      type: file.type,
      data: file,
      createdAt: Date.now(),
      columnIndex,
    });
  }, []);

  const updateMaterial = useCallback(async (type: MaterialType, id: number, payload: Record<string, any>) => {
    await db.table(tableForMaterial(type)).update(id, payload);
  }, []);

  const deleteMaterial = useCallback(async (type: MaterialType, id: number) => {
    await db.table(tableForMaterial(type)).delete(id);
  }, []);

  const persistPositions = useCallback(async (positions: MaterialPosition[]) => {
    await Promise.all(
      positions.map((p) =>
        db.table(tableForMaterial(p.type)).update(p.id, { createdAt: p.createdAt, columnIndex: p.columnIndex })
      )
    );
  }, []);

  const exportData = useCallback(async () => {
    if (!uid) return '{}';
    return exportKnowledge(uid);
  }, [uid]);

  const importData = useCallback(async (json: string) => {
    if (!uid) return;
    await importKnowledge(uid, json);
  }, [uid]);

  const value = useMemo<KnowledgeContextValue>(() => ({
    uid,
    ready,
    addSubject,
    updateSubject,
    deleteSubject,
    addTopic,
    updateTopic,
    deleteTopic,
    saveGroup,
    addMaterial,
    addResourceFile,
    updateMaterial,
    deleteMaterial,
    persistPositions,
    exportData,
    importData,
  }), [uid, ready, addSubject, updateSubject, deleteSubject, addTopic, updateTopic, deleteTopic, saveGroup, addMaterial, addResourceFile, updateMaterial, deleteMaterial, persistPositions, exportData, importData]);

  return <KnowledgeContext.Provider value={value}>{children}</KnowledgeContext.Provider>;
}

export function useKnowledge() {
  const ctx = useContext(KnowledgeContext);
  if (ctx === undefined) {
    throw new Error('useKnowledge must be used within a KnowledgeProvider');
  }
  return ctx;
}
