import { MAX_CARDS } from "@/lib/companion/bridge";
import { nonEmptyTextSchema, validRecords } from "@/lib/companion/model";
import { z } from "@/lib/zod";

const MS_PER_MINUTE = 60_000;
export const MS_PER_DAY = 86_400_000;

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

/** The local day, so a set of tips holds until midnight here rather than until midnight in UTC. */
function localDay(nowMs: number) {
  return Math.floor((nowMs - new Date(nowMs).getTimezoneOffset() * MS_PER_MINUTE) / MS_PER_DAY);
}

/**
 * Edge deals three tips from three different categories, moves on to the next three on every call,
 * and reshuffles when the browser restarts - so which tips you get depends on how many new tabs you
 * happened to open. The same deal, dealt once a day instead: three categories from the day's place
 * in the catalogue, and one tip further into each category every time the categories have all been
 * through.
 */
function dealTips({ catalog, nowMs }: {
  catalog: Tip[];
  nowMs: number;
}): Tip[] {
  const byCategory = new Map<string, Tip[]>();
  for (const tip of catalog) {
    byCategory.set(tip.category, [...byCategory.get(tip.category) ?? [], tip]);
  }

  const categories = [...byCategory.values()];
  if (categories.length === 0) {
    return [];
  }

  const day = localDay(nowMs);
  const offset = day * MAX_CARDS % categories.length;
  const pass = Math.floor(day * MAX_CARDS / categories.length);

  return [...categories.slice(offset), ...categories.slice(0, offset)]
    .slice(0, MAX_CARDS)
    .map(category => category[pass % category.length])
    .filter(tip => tip !== undefined);
}

/** The catalogue as the companion read it, narrowed to the three the day calls for. */
export function parseTips({ raw, nowMs }: {
  raw: unknown;
  nowMs: number;
}): Tip[] {
  return dealTips({
    catalog: validRecords({
      raw,
      schema: tipSchema
    }),
    nowMs
  });
}
