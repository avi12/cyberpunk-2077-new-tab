import { readCompanion, rememberedCompanion } from "@/features/companion/bridge";
import { CompanionRequest } from "@/lib/messaging";
import { journeysSnapshotItem } from "@/lib/storage/items";

import type { Journey } from "./model";
import { parseJourneys } from "./model";

export async function readJourneys() {
  return readCompanion<Journey>({
    request: CompanionRequest.JOURNEYS,
    snapshot: journeysSnapshotItem,
    parse: parseJourneys
  });
}

export async function rememberedJourneys() {
  return rememberedCompanion<Journey>({
    snapshot: journeysSnapshotItem,
    parse: parseJourneys
  });
}
