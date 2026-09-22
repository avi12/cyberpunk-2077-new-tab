import type { Tip } from "./model";
import { parseTips } from "./model";
import { readCompanion } from "@/features/companion/bridge";
import { CompanionRequest } from "@/lib/messaging";
import { tipsSnapshotItem, tipsTurnItem } from "@/lib/storage/items";

/**
 * The catalogue is the same for everyone and Microsoft changes it rarely - entries are inserted and
 * replaced, never reordered - so it is worth asking the app for about once a day. Which three of it
 * are on show is a separate question, answered on every read, and answered from the same cached
 * catalogue either way.
 */
const REFRESH_MS = Temporal.Duration.from({ days: 1 }).total("milliseconds");

/**
 * This turn's three tips, and the turn moves on. It only moves when there were tips to show: a read
 * that found nothing has not spent a turn, and burning them on a source that is not answering would
 * jump the reader forward through the catalogue for nothing.
 *
 * The app is the only source, as it is for journeys. Edge's tip endpoint is a plain public GET and
 * was read directly for a while, which was fresher and needed no app - but it answers the same
 * catalogue to everybody, and what belongs on the row is the catalogue Edge cached for the profile
 * the reader is actually in. Only the app can see which profile that is.
 */
export async function readTips() {
  const turn = await tipsTurnItem.getValue();
  const read = await readCompanion<Tip>({
    request: CompanionRequest.tips,
    snapshot: tipsSnapshotItem,
    refreshMs: REFRESH_MS,
    parse: ({ raw }) => parseTips({
      raw,
      turn
    })
  });
  if (read.cards.length > 0) {
    await tipsTurnItem.setValue(turn + 1);
  }

  return read;
}
