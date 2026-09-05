import { MAX_CARDS } from "@/features/companion/bridge";
import { nonEmptyTextSchema, validRecords } from "@/features/companion/model";
import { openableUrlSchema } from "@/lib/url";
import { z } from "@/lib/zod";

/**
 * Edge writes fractional seconds at whatever precision it happens to have ("...:29.2Z"), which no
 * fixed ISO pattern matches, so the parser is the check.
 *
 * `Temporal.Instant` is the stricter of the two readers, and strictness is what is wanted on a
 * stamp that arrives from another process: one with no zone on the end of it is turned away here
 * rather than quietly read as the reader's own local time, which would put a card's window out by
 * however far they sit from UTC. Measured against Edge's own shapes, everything it writes reads
 * identically to what `Date.parse` made of it.
 */
function instantOf(value: string) {
  try {
    return Temporal.Instant.from(value);
  } catch {
    return null;
  }
}

const timestampSchema = z.string().refine(value => instantOf(value) !== null);

/**
 * The address goes straight into an `href` on the card, and these records come from a separate
 * process on the reader's machine, so the scheme is pinned rather than merely parsed: `z.url()`
 * takes a `javascript:` one as readily as a page.
 */
const journeySourceSchema = z.object({
  title: nonEmptyTextSchema,
  url: openableUrlSchema
});

/**
 * One card as Edge stored it, narrowed to the fields this page shows or acts on - `z.object` drops
 * the rest, including the imagery and the pastel accent colours, which belong to Edge's own look
 * rather than to this one.
 *
 * A Copilot prompt is what a card is *for* here, so a tuple with one required entry both types the
 * first prompt as present and filters out the navigation and backfill cards that carry none.
 */
const journeySchema = z.object({
  id: nonEmptyTextSchema,
  title: nonEmptyTextSchema,
  summary: nonEmptyTextSchema,
  contextReason: nonEmptyTextSchema,
  buttonText: nonEmptyTextSchema,
  copilotPrompts: z.tuple([nonEmptyTextSchema], z.string()),
  sourceInfos: z.tuple([journeySourceSchema], journeySourceSchema),
  validStartTime: timestampSchema,
  validEndTime: timestampSchema
});

export type Journey = z.infer<typeof journeySchema>;

function isLive({ card, nowMs }: {
  card: Journey;
  nowMs: number;
}) {
  const start = instantOf(card.validStartTime);
  const end = instantOf(card.validEndTime);
  if (!start || !end) {
    return false;
  }

  return start.epochMilliseconds <= nowMs && nowMs < end.epochMilliseconds;
}

/**
 * A card that has expired is dropped along with the malformed ones, and what is left stays in the
 * order the database holds it.
 *
 * Every record carries a `rankScore` and sorting by it looks like the obvious thing to do, which is
 * why this used to. Edge does not: measured against three live journeys scoring 60.94, 65.33 and
 * 60.57, its own new tab showed them in exactly that order - stored order, not sorted. Sorting was
 * the one reason the two rows disagreed about which card came first.
 */
export function parseJourneys({ raw, nowMs }: {
  raw: unknown;
  nowMs: number;
}) {
  return validRecords({
    raw,
    schema: journeySchema
  })
    .filter(card => isLive({
      card,
      nowMs
    }))
    .slice(0, MAX_CARDS);
}

/** The card's own prompt: the first is the one Edge itself sends when its card is clicked. */
export function copilotPrompt(card: Journey) {
  return card.copilotPrompts[0];
}
