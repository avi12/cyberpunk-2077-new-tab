import type { Journey } from "./model";
import { parseJourneys } from "./model";
import { readCompanion, rememberedCompanion } from "@/features/companion/bridge";
import { CompanionRequest } from "@/lib/messaging";
import { journeysSnapshotItem } from "@/lib/storage/items";

/**
 * Edge regenerates journeys every four hours at most, and reading them means snapshot-copying a
 * database that runs to tens of megabytes - a quarter of a second, which is long enough to see. The
 * row does not wait on it: it opens on what the app said last and is corrected here.
 */
export async function readJourneys() {
  return readCompanion<Journey>({
    request: CompanionRequest.journeys,
    snapshot: journeysSnapshotItem,
    parse: parseJourneys
  });
}

/** Last time's answer, judged at now - a journey that expired while it sat there does not come back. */
export async function rememberedJourneys() {
  return rememberedCompanion<Journey>({
    snapshot: journeysSnapshotItem,
    parse: parseJourneys
  });
}
