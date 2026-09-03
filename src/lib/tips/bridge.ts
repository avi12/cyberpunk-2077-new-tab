import type { Tip } from "./model";
import { parseTips } from "./model";
import { readCompanion } from "@/lib/companion/bridge";
import { CompanionRequest } from "@/lib/messaging";
import { tipsSnapshotItem } from "@/lib/storage/items";

/**
 * The catalogue is the same for everyone and Microsoft changes it rarely - entries are inserted and
 * replaced, never reordered. Which three of it are on show is decided by the day rather than by the
 * read, so asking the app more than once a day would only ever be handed the same list back.
 */
const REFRESH_MS = 86_400_000;

/** The day's three tips, chosen out of the catalogue Edge cached. */
export async function readTips() {
  return readCompanion<Tip>({
    request: CompanionRequest.tips,
    snapshot: tipsSnapshotItem,
    refreshMs: REFRESH_MS,
    parse: parseTips
  });
}
