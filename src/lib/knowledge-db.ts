// Capa de datos del módulo "Asignaturas" (portada de Aether KN).
// Se mantiene IndexedDB vía Dexie (regla de fusión #2: si KN usa IndexedDB,
// conservarlo). Los archivos de recurso son Blobs y no pueden vivir en el
// snapshot JSONB de localStorage, por lo que este store queda — igual que la
// música — fuera de la sincronización por snapshot (ver storage-snapshot.ts).
//
// Compatibilidad: se conserva el nombre de base de datos, las tablas y la
// cadena de versiones de KN; solo se añade la versión 13 que indexa `uid`
// en las entidades de primer nivel para particionar por usuario.

import Dexie, { type Table } from 'dexie';
import type {
  Subject,
  Topic,
  TopicGroup,
  ResourceItem,
  FormulaItem,
  ConceptItem,
  KeyDataItem,
  MeaningItem,
  QuizItem,
  ProcedureItem,
} from '@/types';

export class KnowledgeDatabase extends Dexie {
  // Nombres de tabla heredados de KN (no se renombran por compatibilidad).
  studyItems!: Table<Topic>;
  categories!: Table<Subject>;
  topicGroups!: Table<TopicGroup>;
  resources!: Table<ResourceItem>;
  formulas!: Table<FormulaItem>;
  concepts!: Table<ConceptItem>;
  keyData!: Table<KeyDataItem>;
  meanings!: Table<MeaningItem>;
  quizzes!: Table<QuizItem>;
  procedures!: Table<ProcedureItem>;

  constructor() {
    super('AetherDatabase_KN_V2');

    // --- Cadena de versiones heredada de KN (intacta) ---
    this.version(8).stores({
      studyItems: '++id, title, category, mastered, createdAt, nextReview, reviewLevel, groupId',
      categories: '++id, &name',
      topicGroups: '++id, subjectName, name',
      resources: '++id, topicId, name',
      formulas: '++id, topicId, name',
      concepts: '++id, topicId, title',
      keyData: '++id, topicId, title',
      meanings: '++id, topicId, word',
      quizzes: '++id, topicId, question',
      procedures: '++id, topicId, title',
    });
    this.version(11).stores({
      studyItems: '++id, title, category, mastered, createdAt, nextReview, reviewLevel, groupId, columnIndex',
      resources: '++id, topicId, name, columnIndex, nextReview, lastReviewLevel',
      formulas: '++id, topicId, name, columnIndex, nextReview, lastReviewLevel',
      concepts: '++id, topicId, title, columnIndex, nextReview, lastReviewLevel',
      keyData: '++id, topicId, title, columnIndex, nextReview, lastReviewLevel',
      meanings: '++id, topicId, word, columnIndex, nextReview, lastReviewLevel',
      quizzes: '++id, topicId, question, columnIndex, nextReview, lastReviewLevel',
      procedures: '++id, topicId, title, columnIndex, nextReview, lastReviewLevel',
    });
    this.version(12).stores({
      studyItems: '++id, title, category, mastered, createdAt, nextReview, reviewLevel, groupId, columnIndex',
    });

    // --- Aether OS: partición por usuario. Se indexa `uid` en las
    // entidades de primer nivel. La asignación `&name` -> `[uid+name]`
    // permite nombres de asignatura repetidos entre usuarios distintos. ---
    this.version(13).stores({
      studyItems: '++id, uid, title, category, mastered, createdAt, nextReview, reviewLevel, groupId, columnIndex',
      categories: '++id, uid, name, [uid+name]',
      topicGroups: '++id, uid, subjectName, name',
    });
  }
}

export const db = new KnowledgeDatabase();

// Tablas hijas de un tema (no llevan uid: se alcanzan solo vía un Topic con uid).
const CHILD_TABLES = ['resources', 'formulas', 'concepts', 'keyData', 'meanings', 'quizzes', 'procedures'] as const;

// Mapea un MaterialType a su tabla Dexie.
export function tableForMaterial(type: string): (typeof CHILD_TABLES)[number] {
  switch (type) {
    case 'formula': return 'formulas';
    case 'concept': return 'concepts';
    case 'key-data': return 'keyData';
    case 'meaning': return 'meanings';
    case 'quiz': return 'quizzes';
    case 'procedure': return 'procedures';
    default: return 'resources';
  }
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(base64: string): Blob {
  const parts = base64.split(';base64,');
  const contentType = parts[0].split(':')[1];
  const raw = window.atob(parts[1]);
  const uInt8Array = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) uInt8Array[i] = raw.charCodeAt(i);
  return new Blob([uInt8Array], { type: contentType });
}

// Exporta SOLO los datos del usuario actual (asignaturas/temas/grupos del uid
// + los materiales de esos temas). Los Blobs se serializan a base64.
export async function exportKnowledge(uid: string): Promise<string> {
  const subjects = await db.categories.where('uid').equals(uid).toArray();
  const topics = await db.studyItems.where('uid').equals(uid).toArray();
  const groups = await db.topicGroups.where('uid').equals(uid).toArray();
  const topicIds = new Set(topics.map((t) => t.id));

  const data: Record<string, any[]> = {
    categories: subjects,
    studyItems: topics,
    topicGroups: groups,
  };

  for (const tableName of CHILD_TABLES) {
    const rows = (await db.table(tableName).toArray()).filter((r: any) => topicIds.has(r.topicId));
    for (const row of rows as any[]) {
      if (row.data instanceof Blob) {
        row.data = await blobToBase64(row.data);
        row._isBlob = true;
      }
    }
    data[tableName] = rows;
  }

  return JSON.stringify(data);
}

// Importa un respaldo. Reemplaza únicamente los datos del usuario actual y
// re-sella el `uid` en las entidades de primer nivel para que el contenido
// importado pertenezca a quien lo importa (KN exporta sin uid).
export async function importKnowledge(uid: string, jsonString: string): Promise<void> {
  const data = JSON.parse(jsonString);
  // Antes de borrar NADA: ¿esto es de verdad un respaldo de Conocimiento? Elegir por
  // error otro .json válido vaciaba todo el banco y anunciaba «importación exitosa».
  const looksRight =
    data !== null &&
    typeof data === 'object' &&
    Array.isArray((data as any).categories) &&
    Array.isArray((data as any).studyItems) &&
    ((data as any).categories.length > 0 || (data as any).studyItems.length > 0);
  if (!looksRight) {
    throw new Error('El archivo no es un respaldo de Conocimiento de Frame. No se ha cambiado nada.');
  }
  const tables = [db.categories, db.studyItems, db.topicGroups, ...CHILD_TABLES.map((t) => db.table(t))];

  await db.transaction('rw', tables, async () => {
    // Limpia los datos previos del usuario.
    const oldTopics = await db.studyItems.where('uid').equals(uid).toArray();
    const oldTopicIds = new Set(oldTopics.map((t) => t.id));
    for (const tableName of CHILD_TABLES) {
      const toDelete = (await db.table(tableName).toArray()).filter((r: any) => oldTopicIds.has(r.topicId));
      await Promise.all(toDelete.map((r: any) => db.table(tableName).delete(r.id)));
    }
    await db.categories.where('uid').equals(uid).delete();
    await db.studyItems.where('uid').equals(uid).delete();
    await db.topicGroups.where('uid').equals(uid).delete();

    // Restaura. Los ids autoincrementales se regeneran y se remapean topicId.
    const topicIdMap = new Map<number, number>();

    for (const row of (data.categories || []) as any[]) {
      const { id, ...rest } = row;
      await db.categories.add({ ...rest, uid });
    }
    // Los grupos van PRIMERO: sus ids se regeneran, y cada tema guarda el id
    // de su grupo. Insertar antes los temas los dejaba apuntando a un id que
    // ya no existe —o, peor, al de OTRO grupo que heredó ese número—.
    const groupIdMap = new Map<number, number>();
    for (const row of (data.topicGroups || []) as any[]) {
      const { id, ...rest } = row;
      const newId = await db.topicGroups.add({ ...rest, uid });
      if (id != null) groupIdMap.set(id, newId as number);
    }
    for (const row of (data.studyItems || []) as any[]) {
      const { id, ...rest } = row;
      if (rest.groupId != null) rest.groupId = groupIdMap.get(rest.groupId) ?? null;
      const newId = await db.studyItems.add({ ...rest, uid });
      if (id != null) topicIdMap.set(id, newId as number);
    }
    for (const tableName of CHILD_TABLES) {
      for (const row of (data[tableName] || []) as any[]) {
        const { id, ...rest } = row;
        if (rest._isBlob && typeof rest.data === 'string') {
          rest.data = base64ToBlob(rest.data);
          delete rest._isBlob;
        }
        const mappedTopicId = topicIdMap.get(rest.topicId) ?? rest.topicId;
        await db.table(tableName).add({ ...rest, topicId: mappedTopicId });
      }
    }
  });
}

// Migración única por usuario: reclama filas heredadas/importadas sin `uid`
// (p. ej. un export de KN) y las asigna al usuario actual. Idempotente.
export async function migrateKNData(uid: string): Promise<void> {
  if (typeof window === 'undefined' || !uid) return;
  const flag = `kn_migrated_${uid}`;
  if (localStorage.getItem(flag)) return;

  try {
    await db.transaction('rw', db.categories, db.studyItems, db.topicGroups, async () => {
      const claim = async (table: Table<any>) => {
        const rows = await table.toArray();
        await Promise.all(rows.filter((r) => !r.uid).map((r) => table.update(r.id, { uid })));
      };
      await claim(db.categories);
      await claim(db.studyItems);
      await claim(db.topicGroups);
    });
    localStorage.setItem(flag, '1');
  } catch (e) {
    console.error('migrateKNData failed', e);
  }
}
