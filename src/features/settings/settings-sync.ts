import { importSettings, settingsSnapshot } from "./settings-file";
import { z } from "@/lib/zod";
import { storage } from "#imports";

/**
 * The same snapshot the export writes to a file, kept in the browser's own sync area instead, so a
 * reinstall or a second machine gets the page back with nothing to carry between them.
 *
 * That area is a small one - roughly 100KB in all, and 8KB for any single value - so the snapshot
 * goes in as numbered slices with one record beside them saying how many there are and when they
 * were taken. It is written only when the reader asks for it: a mirror that followed every change
 * would spend the area, and the browser's hourly write allowance, on typing in the scratch pad.
 */

/** Short enough that a slice stays inside the per-value limit even when JSON escaping doubles it. */
const SLICE_LENGTH = 4000;

/** What is left of the area's own limit once the keys and the record are counted. */
const MAX_SNAPSHOT_LENGTH = 80_000;

const BACKUP_TOO_BIG = "Too much to fit in your browser account";
const NO_BACKUP = "No backup to restore";
const BACKUP_INCOMPLETE = "That backup did not come back whole";

const backupSchema = z.object({
  savedAtMs: z.number(),
  sliceCount: z.number().int().positive()
});

type Backup = z.infer<typeof backupSchema>;

const backupItem = storage.defineItem<Backup | null>("sync:settingsBackup", { fallback: null });

function sliceKey(index: number) {
  return `sync:settingsBackupSlice${index}` as const;
}

function sliceKeys(count: number) {
  return Array.from({ length: count }, (_, index) => sliceKey(index));
}

function slice(json: string) {
  return Array.from(
    { length: Math.ceil(json.length / SLICE_LENGTH) },
    (_, index) => json.slice(index * SLICE_LENGTH, (index + 1) * SLICE_LENGTH)
  );
}

/**
 * The record another machine left, which is another build's idea of what a backup looks like - so it
 * is read the way any other crossing payload is, and an unreadable one counts as no backup at all.
 */
async function readBackup() {
  const parsed = backupSchema.safeParse(await backupItem.getValue());

  return parsed.success ? parsed.data : null;
}

export async function backupTakenAtMs() {
  return (await readBackup())?.savedAtMs ?? null;
}

/** Answers with the moment it was taken, which is the line the panel shows afterwards. */
export async function keepBackup() {
  // No indenting: every byte of it counts against the area.
  const json = JSON.stringify(settingsSnapshot());
  if (json.length > MAX_SNAPSHOT_LENGTH) {
    throw new Error(BACKUP_TOO_BIG);
  }

  const previous = await readBackup();
  const slices = slice(json);
  const savedAtMs = Temporal.Now.instant().epochMilliseconds;

  // The slices land before the record that vouches for them, and the slices a shorter snapshot no
  // longer needs go last, so a write cut short anywhere still reads as one backup or the other.
  await storage.setItems(
    slices.map((value, index) => ({
      key: sliceKey(index),
      value
    }))
  );
  await backupItem.setValue({
    savedAtMs,
    sliceCount: slices.length
  });
  await storage.removeItems(sliceKeys(previous?.sliceCount ?? 0).slice(slices.length));

  return savedAtMs;
}

export async function restoreBackup() {
  const backup = await readBackup();
  if (!backup) {
    throw new Error(NO_BACKUP);
  }

  const stored = await storage.getItems(sliceKeys(backup.sliceCount));
  const parsed = z.array(z.string()).safeParse(stored.map(({ value }) => value));
  if (!parsed.success) {
    throw new Error(BACKUP_INCOMPLETE);
  }

  await importSettings(parsed.data.join(""));
}

export async function dropBackup() {
  const backup = await readBackup();
  await storage.removeItems(sliceKeys(backup?.sliceCount ?? 0));
  await backupItem.removeValue();
}
