import { fetchTipCatalogue } from "./catalogue";
import type { Tip } from "./model";
import { parseTips } from "./model";
import { CompanionState, freshSnapshot, readCompanion } from "@/features/companion/bridge";
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
 * Where the catalogue comes from, in the order worth trying.
 *
 * Edge's own endpoint first, because that is where Edge got it and it needs neither the app nor the
 * browser. The companion is asked only when that is not allowed or not answering, which keeps every
 * reader who already has the app exactly where they were.
 */
async function readCatalogue(turn: number) {
  const cached = await freshSnapshot({
    snapshot: tipsSnapshotItem,
    refreshMs: REFRESH_MS,
    nowMs: Temporal.Now.instant().epochMilliseconds
  });
  if (cached) {
    return {
      state: CompanionState.connected,
      cards: parseTips({
        raw: cached,
        turn
      })
    };
  }

  const fetched = await fetchTipCatalogue();
  if (fetched) {
    await tipsSnapshotItem.setValue({
      fetchedAtMs: Temporal.Now.instant().epochMilliseconds,
      raw: fetched
    });

    return {
      state: CompanionState.connected,
      cards: parseTips({
        raw: fetched,
        turn
      })
    };
  }

  return readCompanion<Tip>({
    request: CompanionRequest.tips,
    snapshot: tipsSnapshotItem,
    refreshMs: REFRESH_MS,
    parse: ({ raw }) => parseTips({
      raw,
      turn
    })
  });
}

/**
 * This turn's three tips, and the turn moves on. It only moves when there were tips to show: a read
 * that found nothing has not spent a turn, and burning them on a source that is not answering would
 * jump the reader forward through the catalogue for nothing.
 */
export async function readTips() {
  const turn = await tipsTurnItem.getValue();
  const read = await readCatalogue(turn);
  if (read.cards.length > 0) {
    await tipsTurnItem.setValue(turn + 1);
  }

  return read;
}
