import { definePlainItem } from "./plain-item";
import { z } from "@/lib/zod";
import { storage } from "#imports";

/**
 * The sync area holds roughly 100KB in all and 8KB per value, so a snapshot is stored as numbered
 * slices plus a record of their count. Written only on request: mirroring every change would spend
 * the area and the hourly write allowance on typing in the scratch pad.
 */

/** Short enough that a slice stays inside the per-value limit even when JSON escaping doubles it. */
const SLICE_LENGTH = 4000;

const NO_BACKUP = "No backup to restore";

const BACKUP_INCOMPLETE = "That backup did not come back whole";

const recordSchema = z.object({
  savedAtMs: z.number(),
  sliceCount: z.number().int().positive()
});

type BackupRecord = z.infer<typeof recordSchema>;

/** The name decides the storage keys, so `settings` must keep the exact keys it has always written. */
export function slicedBackup({ name, maxLength, tooBig }: {
  name: string;
  /** In characters of JSON. */
  maxLength: number;
  /** The error message when the snapshot will not fit. */
  tooBig: string;
}) {
  const recordItem = definePlainItem<BackupRecord | null>(`sync:${name}Backup`, { fallback: null });

  function sliceKey(index: number) {
    return `sync:${name}BackupSlice${index}` as const;
  }

  function sliceKeys(count: number) {
    return Array.from({ length: count }, (_, index) => sliceKey(index));
  }

  /** Another build may have written it, so an unreadable record counts as none. */
  async function readRecord() {
    const parsed = recordSchema.safeParse(await recordItem.getValue());

    return parsed.success ? parsed.data : null;
  }

  return {
    async takenAtMs() {
      return (await readRecord())?.savedAtMs ?? null;
    },
    async keep(json: string) {
      if (json.length > maxLength) {
        throw new Error(tooBig);
      }

      const previous = await readRecord();
      const slices = Array.from(
        { length: Math.ceil(json.length / SLICE_LENGTH) },
        (_, index) => json.slice(index * SLICE_LENGTH, (index + 1) * SLICE_LENGTH)
      );
      const savedAtMs = Temporal.Now.instant().epochMilliseconds;

      // The slices land before the record that vouches for them, and the slices a shorter snapshot no
      // longer needs go last, so a write cut short anywhere still reads as one backup or the other.
      await storage.setItems(
        slices.map((value, index) => ({
          key: sliceKey(index),
          value
        }))
      );
      await recordItem.setValue({
        savedAtMs,
        sliceCount: slices.length
      });
      await storage.removeItems(sliceKeys(previous?.sliceCount ?? 0).slice(slices.length));

      return savedAtMs;
    },
    async read() {
      const record = await readRecord();
      if (!record) {
        throw new Error(NO_BACKUP);
      }

      const stored = await storage.getItems(sliceKeys(record.sliceCount));
      const parsed = z.array(z.string()).safeParse(stored.map(({ value }) => value));
      if (!parsed.success) {
        throw new Error(BACKUP_INCOMPLETE);
      }

      return parsed.data.join("");
    },
    async drop() {
      const record = await readRecord();
      await storage.removeItems(sliceKeys(record?.sliceCount ?? 0));
      await recordItem.removeValue();
    }
  };
}
