import { importSettings, settingsSnapshot } from "./settings-file";
import { slicedBackup } from "@/lib/storage/sliced-backup";

/** What is left of the area's own limit once the keys, the record and the netlinks backup are counted. */
const MAX_SNAPSHOT_LENGTH = 80_000;

const backup = slicedBackup({
  name: "settings",
  maxLength: MAX_SNAPSHOT_LENGTH,
  tooBigMessage: "Too much to fit in your browser account"
});

export async function backupTakenAtMs() {
  return backup.takenAtMs();
}

/** Resolves to when the backup was taken. */
export async function saveBackup() {
  // No indenting: every byte of it counts against the area.
  return backup.keep(JSON.stringify(settingsSnapshot()));
}

export async function restoreBackup() {
  await importSettings(await backup.read());
}

export async function deleteBackup() {
  await backup.drop();
}
