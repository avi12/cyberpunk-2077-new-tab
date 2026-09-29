import { NATIVE_MESSAGING, rememberCompanion } from "./bridge";
import { readCompanionRecords } from "./native";
import { CompanionRequest } from "@/lib/messaging";
import { type CompanionSnapshot, journeysSnapshotItem, type StorageItem, tipsSnapshotItem } from "@/lib/storage/items";

/**
 * Keeping the stored row current while nobody is looking at it.
 *
 * The snapshot exists so a new tab never opens on a placeholder - it is what the row is drawn from
 * before anything has been asked. That only works if it is right, and the page is the wrong place to
 * make it right: whatever it learns, it learns while the reader is already looking at the old row.
 *
 * So the worker asks the app on its own, and a tab opened afterwards is drawn from an answer that is
 * already current. The page still asks in its own breath and still corrects the row where it has to
 * - what changes is how often it has to.
 */

export const COMPANION_REFRESH_ALARM = "companionRefresh";

/**
 * Edge's own interval, read out of its own configuration rather than guessed at: the
 * `journeysTriggerIntervalInMinutes` in `EdgeJourneys/config.json` is 240, and the snapshots it has
 * written on this machine sit 242.5 minutes apart for as long as the browser is up. Asking more
 * often than the browser writes is asking to be told the same thing again, and every ask can cost
 * the app a snapshot-copy of a database that runs to tens of megabytes.
 */
const COMPANION_REFRESH_MINUTES = 240;

const SNAPSHOTS: Record<CompanionRequest, StorageItem<CompanionSnapshot | null>> = {
  [CompanionRequest.journeys]: journeysSnapshotItem,
  [CompanionRequest.tips]: tipsSnapshotItem
};

/**
 * Both families, asked for and kept.
 *
 * Nothing about the companion's *state* is written here, and that is the point of the split: whether
 * the app can be reached is only true at the moment a reader is told it, so the page asks that for
 * itself and this only ever leaves behind words to open on. A read that reaches nothing comes back
 * with no records and changes nothing at all.
 */
export async function refreshCompanionSnapshots() {
  const isCompanionAllowed = await browser.permissions.contains({ permissions: [NATIVE_MESSAGING] });
  if (!isCompanionAllowed) {
    return;
  }

  await Promise.all(
    Object.values(CompanionRequest).map(async request => {
      const { records } = await readCompanionRecords(request);
      await rememberCompanion({
        snapshot: SNAPSHOTS[request],
        raw: records
      });
    })
  );
}

/**
 * Created only where there is none, rather than created again: a worker woken for something else
 * would otherwise put the clock back to the start every time and the alarm would never come round.
 */
export async function ensureCompanionRefreshAlarm() {
  const standing = await browser.alarms.get(COMPANION_REFRESH_ALARM);
  if (standing) {
    return;
  }

  await browser.alarms.create(COMPANION_REFRESH_ALARM, { periodInMinutes: COMPANION_REFRESH_MINUTES });
}
