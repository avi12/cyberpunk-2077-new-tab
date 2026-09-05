/**
 * Everything the reader brings in themselves lives in IndexedDB rather than extension storage: a
 * background runs to tens of megabytes, and `storage.local` is neither meant for nor sized for
 * binary data. The setting that points at one holds a sentinel - `cached:image` - instead of a URL.
 *
 * One record per slot, and a slot's id is the record's key, so it is the persisted contract. The
 * background keeps the id the original extension used, so an existing user's upload survives the
 * rebuild.
 */

const DB_NAME = "terminal-startpage";
const DB_VERSION = 1;
const STORE_NAME = "media";

export enum MediaSlot {
  background = "background-media"
}

export const CACHED_PREFIX = "cached:";

type MediaRecord = {
  id: MediaSlot;
  blob: Blob;
  type: string;
  /** What the file was called when it came in, which is the only way to name it back at the reader. */
  name?: string;
  timestamp: number;
};

let openDb: IDBDatabase | null = null;

async function getDb() {
  if (openDb) {
    return openDb;
  }

  return new Promise<IDBDatabase>((resolve, reject) => {
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

async function runRequest<TResult>({ mode, run }: {
  mode: IDBTransactionMode;
  run: (store: IDBObjectStore) => IDBRequest<TResult>;
}) {
  const database = await getDb();

  return new Promise<TResult>((resolve, reject) => {
    const request = run(database.transaction([STORE_NAME], mode).objectStore(STORE_NAME));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveMedia({ slot, blob, type, name }: {
  slot: MediaSlot;
  blob: Blob;
  type: string;
  name?: string;
}) {
  const record: MediaRecord = {
    id: slot,
    blob,
    type,
    name,
    timestamp: Date.now()
  };
  await runRequest({
    mode: "readwrite",
    run: store => store.put(record)
  });
}

export async function loadMedia(slot: MediaSlot) {
  const record: MediaRecord | undefined = await runRequest({
    mode: "readonly",
    run: store => store.get(slot)
  });
  if (!record?.blob) {
    return null;
  }

  // An older record can carry a typeless blob; the type it was saved under is the one to hand back.
  if (!record.blob.type && record.type) {
    return {
      ...record,
      blob: new Blob([record.blob], { type: record.type })
    };
  }

  return record;
}

export async function clearMedia(slot: MediaSlot) {
  await runRequest({
    mode: "readwrite",
    run: store => store.delete(slot)
  });
}
