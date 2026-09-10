import { ImportMode, importNetlinks, netlinksSnapshot } from "./netlinks-file";
import { slicedBackup } from "@/lib/storage/sliced-backup";

/**
 * The grid alone, kept in the browser's own sync area, beside the settings backup rather than
 * instead of it.
 *
 * Two backups in one small area, so this one takes the smaller share: the settings snapshot is
 * allowed 80,000 characters of it and this is allowed the rest. That is still far more netlinks than
 * a grid is ever asked to hold - a card costs around 150 characters - and keeping them apart is the
 * point. Restoring your links should not also restore the wallpaper you have since changed.
 */

/** What is left of the area once the settings backup, the keys and the records are counted. */
const MAX_SNAPSHOT_LENGTH = 16_000;

const backup = slicedBackup({
  name: "netlinks",
  maxLength: MAX_SNAPSHOT_LENGTH,
  tooBig: "Too many netlinks to fit in your browser account"
});

export async function netlinksBackupTakenAtMs() {
  return backup.takenAtMs();
}

export async function keepNetlinksBackup() {
  // No indenting: every byte of it counts against the area.
  return backup.keep(JSON.stringify(netlinksSnapshot()));
}

/**
 * A restore replaces rather than merges. It is your own grid coming back, and a merge would leave
 * behind whatever you deleted between taking the backup and needing it.
 */
export async function restoreNetlinksBackup() {
  await importNetlinks({
    json: await backup.read(),
    mode: ImportMode.replace
  });
}

export async function dropNetlinksBackup() {
  await backup.drop();
}
