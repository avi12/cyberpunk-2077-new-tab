import type { Tip } from "./model";
import { parseTips } from "./model";
import { readCompanion, rememberedCompanion } from "@/features/companion/bridge";
import { CompanionRequest } from "@/lib/messaging";
import { tipsSnapshotItem, tipsTurnItem } from "@/lib/storage/items";

/**
 * This turn's three tips, and the turn moves on. It only moves when there were tips to show: a read
 * that found nothing has not spent a turn, and burning them on a source that is not answering would
 * jump the reader forward through the catalogue for nothing.
 *
 * The catalogue itself is the same for everyone and Microsoft changes it rarely - entries are
 * inserted and replaced, never reordered - so what this mostly finds is what the row is already
 * showing. Which three of it are on show is the separate question, answered on every read, and
 * answered from the same stored catalogue either way.
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

/**
 * The same three off the stored catalogue, without spending the turn. The app is being asked the
 * same question in the same breath, and a deal that had moved on by the time it answered would tear
 * the row on every single page for nothing - the row is meant to move when the catalogue does, not
 * when it is read twice.
 */
export async function rememberedTips() {
  const turn = await tipsTurnItem.getValue();

  return rememberedCompanion<Tip>({
    snapshot: tipsSnapshotItem,
    parse: ({ raw }) => parseTips({
      raw,
      turn
    })
  });
}
