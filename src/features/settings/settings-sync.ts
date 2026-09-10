import { importSettings, settingsSnapshot } from "./settings-file";
import { slicedBackup } from "@/lib/storage/sliced-backup";

/**
 * The same snapshot the export writes to a file, kept in the browser's own sync area instead, so a
 * reinstall or a second machine gets the page back with nothing to carry between them.
 *
 * How it is cut up and written is `slicedBackup`'s problem, and the netlinks keep a backup of their
 * own through the same machinery. What is left here is only what a settings backup is: the whole
 * snapshot in, and an import back out.
 */

/** What is left of the area's own limit once the keys, the record and the netlinks backup are counted. */
const MAX_SNAPSHOT_LENGTH = 80_000;

const backup = slicedBackup({
  name: "settings",
  maxLength: MAX_SNAPSHOT_LENGTH,
  tooBig: "Too much to fit in your browser account"
});

export async function backupTakenAtMs() {
  return backup.takenAtMs();
}

/** Answers with the moment it was taken, which is the line the panel shows afterwards. */
export async function keepBackup() {
  // No indenting: every byte of it counts against the area.
  return backup.keep(JSON.stringify(settingsSnapshot()));
}

export async function restoreBackup() {
  await importSettings(await backup.read());
}

export async function dropBackup() {
  await backup.drop();
}
