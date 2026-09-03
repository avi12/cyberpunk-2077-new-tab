import type { Journey } from "./model";
import { parseJourneys } from "./model";
import { readCompanion } from "@/lib/companion/bridge";
import { CompanionRequest } from "@/lib/messaging";
import { journeysSnapshotItem } from "@/lib/storage/items";

/**
 * Edge regenerates journeys every four hours at most, and reading them means snapshot-copying a
 * database that runs to tens of megabytes - a quarter of a second, far too much to repeat for every
 * new tab. One read an hour, cached, is what lets the cards be on the page as it opens rather than
 * arriving after it.
 */
const REFRESH_MS = 3_600_000;

/** Cards Edge itself generated, whether they come from this hour's read or the cached one. */
export async function readJourneys() {
  return readCompanion<Journey>({
    request: CompanionRequest.journeys,
    snapshot: journeysSnapshotItem,
    refreshMs: REFRESH_MS,
    parse: parseJourneys
  });
}
