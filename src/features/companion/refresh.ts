import { NATIVE_MESSAGING, rememberCompanion } from "./bridge";
import { readCompanionRecords } from "./native";
import { CompanionRequest } from "@/lib/messaging";
import { type CompanionSnapshot, journeysSnapshotItem, type StorageItem, tipsSnapshotItem } from "@/lib/storage/items";

/**
 * The worker keeps the snapshot current so a new tab opens on fresh cards rather than correcting old
 * ones in front of the reader. `watch.ts` does most of it; the alarm covers a missed file event or a
 * watch that could not be opened.
 */

export const COMPANION_REFRESH_ALARM = "companionRefresh";

/**
 * Edge's own `journeysTriggerIntervalInMinutes` in `EdgeJourneys/config.json` (measured snapshots sit
 * 242.5 minutes apart). Asking more often only repeats a read that copies tens of megabytes.
 */
const COMPANION_REFRESH_MINUTES = 240;

const SNAPSHOTS: Record<CompanionRequest, StorageItem<CompanionSnapshot | null>> = {
  [CompanionRequest.journeys]: journeysSnapshotItem,
  [CompanionRequest.tips]: tipsSnapshotItem
};

/**
 * Stores records only, never reachability, which is only true when the page asks. The permission is
 * not checked: both callers already hold it.
 */
export async function refreshCompanionSnapshot(request: CompanionRequest) {
  const { records } = await readCompanionRecords(request);
  await rememberCompanion({
    snapshot: SNAPSHOTS[request],
    raw: records
  });
}

export async function refreshCompanionSnapshots() {
  const isCompanionAllowed = await browser.permissions.contains({ permissions: [NATIVE_MESSAGING] });
  if (!isCompanionAllowed) {
    return;
  }

  await Promise.all(Object.values(CompanionRequest).map(refreshCompanionSnapshot));
}

/** Recreating it on every worker wake would reset its clock, so it would never fire. */
export async function ensureCompanionRefreshAlarm() {
  const existingAlarm = await browser.alarms.get(COMPANION_REFRESH_ALARM);
  if (existingAlarm) {
    return;
  }

  await browser.alarms.create(COMPANION_REFRESH_ALARM, { periodInMinutes: COMPANION_REFRESH_MINUTES });
}
