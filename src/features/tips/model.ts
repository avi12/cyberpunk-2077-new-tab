import { MAX_CARDS } from "@/features/companion/bridge";
import { nonEmptyTextSchema, validRecords } from "@/features/companion/model";
import { z } from "@/lib/zod";

/** `description` and `prompt` hold the same sentence in every entry, but the card shows one and sends the other. */
const tipSchema = z.object({
  id: nonEmptyTextSchema,
  title: nonEmptyTextSchema,
  description: nonEmptyTextSchema,
  prompt: nonEmptyTextSchema,
  cta: nonEmptyTextSchema,
  category: nonEmptyTextSchema
});

export type Tip = z.infer<typeof tipSchema>;

/** Edge also rotates on a timer, but its interval reaches neither disk nor any API, so this one is chosen. */
export const TIPS_ROTATE_MS = 45_000;

/**
 * Edge's own deal, traced from its cache: three tips from three different categories, moving on every
 * new tab. The catalogue has no trigger, score or context field, so nothing about the reader decides
 * it. `turn` is kept in `local:` where Edge keeps it in memory.
 */
function dealTips({ catalog, turn }: {
  catalog: Tip[];
  turn: number;
}) {
  const byCategory = new Map<string, Tip[]>();
  for (const tip of catalog) {
    byCategory.set(tip.category, [...byCategory.get(tip.category) ?? [], tip]);
  }

  const categories = [...byCategory.values()];
  if (categories.length === 0) {
    return [];
  }

  const categoryOffset = turn * MAX_CARDS % categories.length;
  const completedRounds = Math.floor(turn * MAX_CARDS / categories.length);

  return [...categories.slice(categoryOffset), ...categories.slice(0, categoryOffset)]
    .slice(0, MAX_CARDS)
    .map(category => category[completedRounds % category.length])
    .filter(tip => tip !== undefined);
}

export function parseTips({ raw, turn }: {
  raw: unknown;
  turn: number;
}) {
  return dealTips({
    catalog: validRecords({
      raw,
      schema: tipSchema
    }),
    turn
  });
}
