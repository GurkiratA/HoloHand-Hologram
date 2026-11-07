import { openDB, type IDBPDatabase } from 'idb';
import type { RecognitionResult } from '@/types';

export interface HistoryItem {
  id: string;
  time: number;
  name: string;
  category: string;
  thumbnail: string | null;
  recognition: RecognitionResult;
  /** How the model was resolved, e.g. "catalog:f1-car" or "archetype:car". */
  modelRef: string | null;
}

export interface UploadItem {
  id: string;
  time: number;
  name: string;
  size: number;
  data: ArrayBuffer;
}

interface Schema {
  history: { key: string; value: HistoryItem };
  uploads: { key: string; value: UploadItem };
  modelCache: { key: string; value: { url: string; time: number; data: ArrayBuffer } };
}

let dbp: Promise<IDBPDatabase<Schema>> | null = null;
function db() {
  if (!dbp) {
    dbp = openDB<Schema>('holohand', 1, {
      upgrade(d) {
        d.createObjectStore('history', { keyPath: 'id' });
        d.createObjectStore('uploads', { keyPath: 'id' });
        d.createObjectStore('modelCache', { keyPath: 'url' });
      },
    });
  }
  return dbp;
}

/** All storage calls swallow errors: IndexedDB can be unavailable (private mode, blocked storage). */
async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    console.warn('[storage]', e);
    return fallback;
  }
}

export const storage = {
  addHistory: (item: HistoryItem) => safe(async () => void (await db()).put('history', item), undefined),
  listHistory: () => safe(async () => (await (await db()).getAll('history')).sort((a, b) => b.time - a.time).slice(0, 60), [] as HistoryItem[]),
  clearHistory: () => safe(async () => void (await db()).clear('history'), undefined),

  addUpload: (item: UploadItem) => safe(async () => void (await db()).put('uploads', item), undefined),
  listUploads: () => safe(async () => (await (await db()).getAll('uploads')).sort((a, b) => b.time - a.time), [] as UploadItem[]),
  getUpload: (id: string) => safe(async () => (await db()).get('uploads', id), undefined),
  deleteUpload: (id: string) => safe(async () => void (await db()).delete('uploads', id), undefined),

  /** Cache-first fetch for GLB files. */
  async fetchModel(url: string): Promise<ArrayBuffer> {
    const cached = await safe(async () => (await db()).get('modelCache', url), undefined);
    if (cached) return cached.data;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Model download failed (${res.status})`);
    const type = res.headers.get('content-type') ?? '';
    if (type.includes('text/html')) throw new Error('Model file not found');
    const data = await res.arrayBuffer();
    await safe(async () => void (await db()).put('modelCache', { url, time: Date.now(), data }), undefined);
    return data;
  },
};
