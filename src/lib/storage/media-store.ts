import { z } from "@/lib/zod";

/**
 * Uploads live in IndexedDB: a background runs to tens of megabytes, which `storage.local` is not
 * sized for. The setting pointing at one holds a `cached:` sentinel instead of a URL.
 *
 * A slot's id is its record key, so it is a persisted contract - `background-media` is the original
 * extension's id, which keeps existing uploads alive.
 */

const DB_NAME = "terminal-startpage";
const DB_VERSION = 1;
const STORE_NAME = "media";

export enum MediaSlot {
  background = "background-media"
}

export const CACHED_MEDIA_PREFIX = "cached:";

/** Only the blob and the slot are required: the store is the original extension's, and older records lack the rest. */
const mediaRecordSchema = z.object({
  id: z.enum(MediaSlot),
  blob: z.instanceof(Blob),
  type: z.string().optional(),
  name: z.string().optional(),
  timestamp: z.number().optional()
});

type MediaRecord = z.infer<typeof mediaRecordSchema>;

let openedDatabase: IDBDatabase | null = null;

async function getDatabase() {
  if (openedDatabase) {
    return openedDatabase;
  }

  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      openedDatabase = request.result;
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
  const database = await getDatabase();

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
    timestamp: Temporal.Now.instant().epochMilliseconds
  };
  await runRequest({
    mode: "readwrite",
    run: store => store.put(record)
  });
}

export async function loadMedia(slot: MediaSlot) {
  const parsed = mediaRecordSchema.safeParse(
    await runRequest<unknown>({
      mode: "readonly",
      run: store => store.get(slot)
    })
  );
  if (!parsed.success) {
    return null;
  }

  const record = parsed.data;
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
