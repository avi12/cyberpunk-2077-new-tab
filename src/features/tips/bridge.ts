import type { Tip } from "./model";
import { parseTips } from "./model";
import { readCompanion, rememberedCompanion } from "@/features/companion/bridge";
import { CompanionRequest } from "@/lib/messaging";
import { tipsSnapshotItem, tipsTurnItem } from "@/lib/storage/items";

/**
 * The turn only advances when there were tips to show, so an unreachable app does not skip the reader
 * through the catalogue. Read through the app rather than Edge's public tip endpoint, because only the
 * app sees the catalogue cached for the reader's own profile.
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

/** Does not spend the turn: the live read follows at once, and a moved deal would redraw the row for nothing. */
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
