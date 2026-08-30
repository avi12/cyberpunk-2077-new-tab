/**
 * Custom background image/video blobs live in IndexedDB, not extension storage: they are tens of
 * megabytes and `storage.local` is neither meant for nor sized for binary data. The `background`
 * setting then holds the sentinel `cached:image` / `cached:video` instead of a URL.
 *
 * The database name, version and single record id match the original extension, so an existing
 * user's uploaded background survives the rebuild.
 */

const DB_NAME = "terminal-startpage";
const DB_VERSION = 1;
const STORE_NAME = "media";

const MEDIA_ID = "background-media";

export const CACHED_PREFIX = "cached:";

type MediaRecord = {
  id: string;
  blob: Blob;
  type: string;
  timestamp: number;
};

let openDb: IDBDatabase | null = null;

async function getDb(): Promise<IDBDatabase> {
  if (openDb) {
    return openDb;
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      openDb = request.result;
      resolve(request.result);
    };
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
  });
}

async function runRequest<TResult>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<TResult>
): Promise<TResult> {
  const database = await getDb();

  return new Promise((resolve, reject) => {
    const request = run(database.transaction([STORE_NAME], mode).objectStore(STORE_NAME));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveBackgroundMedia(blob: Blob, type: string): Promise<void> {
  const record: MediaRecord = {
    id: MEDIA_ID,
    blob,
    type,
    timestamp: Date.now()
  };
  await runRequest("readwrite", store => store.put(record));
}

export async function loadBackgroundMedia(): Promise<Blob | null> {
  const record: MediaRecord | undefined = await runRequest("readonly", store => store.get(MEDIA_ID));
  if (!record?.blob) {
    return null;
  }

  if (!record.blob.type && record.type) {
    return new Blob([record.blob], { type: record.type });
  }

  return record.blob;
}

export async function clearBackgroundMedia(): Promise<void> {
  await runRequest("readwrite", store => store.delete(MEDIA_ID));
}
