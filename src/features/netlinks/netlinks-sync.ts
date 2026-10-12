import { ImportMode, importNetlinks, netlinksSnapshot } from "./netlinks-file";
import { slicedBackup } from "@/lib/storage/sliced-backup";

// Kept apart from the settings backup so restoring links never restores an old wallpaper too. The
// sync area is shared: this is what is left after the settings backup's 80,000 characters and the
// keys - still around a hundred cards at about 150 characters each
const MAX_SNAPSHOT_LENGTH = 16_000;

const backup = slicedBackup({
  name: "netlinks",
  maxLength: MAX_SNAPSHOT_LENGTH,
  tooBigMessage: "Too many netlinks to fit in your browser account"
});

export async function netlinksBackupTakenAtMs() {
  return backup.takenAtMs();
}

export async function keepNetlinksBackup() {
  // No indenting: every byte counts against the sync quota
  return backup.keep(JSON.stringify(netlinksSnapshot()));
}

// Replaces rather than merges, or links deleted since the backup would come back
export async function restoreNetlinksBackup() {
  await importNetlinks({
    json: await backup.read(),
    mode: ImportMode.replace
  });
}

export async function dropNetlinksBackup() {
  await backup.drop();
}
