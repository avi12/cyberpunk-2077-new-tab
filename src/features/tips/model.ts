import { MAX_CARDS } from "@/features/companion/bridge";
import { nonEmptyTextSchema, validRecords } from "@/features/companion/model";
import { z } from "@/lib/zod";

/**
 * One tip as Edge cached it, narrowed to the fields this page shows or acts on - `z.object` drops
 * the rest. Microsoft's artwork goes with it, because it belongs to Edge's own look rather than to
 * this one, and so does the composer mode it suggests: the prompt reaches Copilot on the clipboard,
 * and a mode cannot travel that way.
 *
 * Every entry in the catalogue has the same sentence in `description` and `prompt` - a tip is
 * literally the prompt it hands over - but they are two fields, so the card shows the one and copies
 * the other.
 */
const tipSchema = z.object({
  id: nonEmptyTextSchema,
  title: nonEmptyTextSchema,
  description: nonEmptyTextSchema,
  prompt: nonEmptyTextSchema,
  cta: nonEmptyTextSchema,
  category: nonEmptyTextSchema
});

export type Tip = z.infer<typeof tipSchema>;

/**
 * How often the row re-deals while somebody is looking at it. Edge rotates its tip on a timer rather
 * than only when a tab opens - watched happening on a page that was just sitting there - and this is
 * the one number in the mechanism that had to be chosen rather than read: the interval is inside
 * Edge and reaches neither disk nor any API. Long enough to read the card, short enough to notice.
 */
export const TIPS_ROTATE_MS = 45_000;

/**
 * Edge's own deal, and now this one: three tips from three different categories, the next three on
 * every new tab, starting somewhere new each time the browser starts. Traced from the cache it reads
 * - the catalogue is 130 flat entries across 12 categories with no trigger, score or context field
 * anywhere in it, so nothing about a reader can be deciding this. The tip that reads like it knows
 * about your tabs ("Tell me which of the hotels in my tabs is better for families") is one of those
 * 130, written that way for everybody.
 *
 * `turn` is what Edge keeps in memory and this keeps in `local:`, since a page cannot hold a count
 * that has to outlive it. One turn further is one category further round, and one tip deeper into
 * each category every time the categories have all been through.
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

  const offset = turn * MAX_CARDS % categories.length;
  const pass = Math.floor(turn * MAX_CARDS / categories.length);

  return [...categories.slice(offset), ...categories.slice(0, offset)]
    .slice(0, MAX_CARDS)
    .map(category => category[pass % category.length])
    .filter(tip => tip !== undefined);
}

/** The catalogue as the companion read it, narrowed to the three this turn calls for. */
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
