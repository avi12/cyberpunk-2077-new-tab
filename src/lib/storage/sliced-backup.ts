import { z } from "@/lib/zod";
import { storage } from "#imports";

/**
 * A JSON snapshot kept in the browser's own sync area, cut into pieces small enough to fit it.
 *
 * That area is a small one - roughly 100KB in all, and 8KB for any single value - so a snapshot goes
 * in as numbered slices with one record beside them saying how many there are and when they were
 * taken. Written only when a reader asks: a mirror that followed every change would spend the area,
 * and the browser's hourly write allowance, on typing in the scratch pad.
 *
 * Shared rather than written twice, because there are two of these now - the whole settings blob and
 * the netlinks on their own - and the part that is fiddly is identical in both: the slicing, the
 * order the writes have to land in, and reading back something another build wrote.
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

/**
 * One backup in the sync area, addressed by name.
 *
 * The name decides the keys, so `settings` keeps the exact keys it has always written and nothing
 * anybody already has in their browser account is orphaned by this being shared.
 */
export function slicedBackup({ name, maxLength, tooBig }: {
  name: string;
  /** How much of the shared area this backup may claim, in characters of JSON. */
  maxLength: number;
  /** What a reader is told when their snapshot will not fit, in words about their page. */
  tooBig: string;
}) {
  const recordItem = storage.defineItem<BackupRecord | null>(`sync:${name}Backup`, { fallback: null });

  function sliceKey(index: number) {
    return `sync:${name}BackupSlice${index}` as const;
  }

  function sliceKeys(count: number) {
    return Array.from({ length: count }, (_, index) => sliceKey(index));
  }

  /**
   * The record another machine left, which is another build's idea of what a backup looks like - so
   * it is read the way any other crossing payload is, and an unreadable one counts as none at all.
   */
  async function readRecord() {
    const parsed = recordSchema.safeParse(await recordItem.getValue());

    return parsed.success ? parsed.data : null;
  }

  return {
    async takenAtMs() {
      return (await readRecord())?.savedAtMs ?? null;
    },
    /** Answers with the moment it was taken, which is the line a panel shows afterwards. */
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
