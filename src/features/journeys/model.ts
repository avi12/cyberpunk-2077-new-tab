import { formatTimestamp } from "@/features/clock/time";
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

/** How far along Edge thinks the reader is, which it tracks in two words rather than one. */
const journeyStateSchema = z.object({
  phase: nonEmptyTextSchema.optional(),
  activityStatus: nonEmptyTextSchema.optional()
});

/**
 * One card as Edge stored it, narrowed to the fields this page shows or sends - `z.object` drops the
 * rest, which is the card's own appearance: the imagery, the two pastel accent colours, the tier and
 * rank that decide where it sits in Edge's own row.
 *
 * Everything else is kept even where nothing draws it, because a press sends it. Edge's row is drawn
 * by the browser itself and its Copilot is handed the whole journey when a card is pressed; every
 * destination this extension can reach is outside the browser, so what is not in the prompt is not
 * anywhere. `summary`, the topics, the category, the phase and the time are that context - see
 * `journeySubject`.
 *
 * All of them are optional but `contextReason`, because they are one browser's shape of a record
 * rather than a contract, and a missing one should cost its own line and not the card.
 *
 * A Copilot prompt is what a card is *for* here, so a tuple with one required entry both types the
 * first prompt as present and filters out the navigation and backfill cards that carry none.
 */
const journeySchema = z.object({
  id: nonEmptyTextSchema,
  title: nonEmptyTextSchema,
  enhancedTitle: nonEmptyTextSchema.optional(),
  summary: nonEmptyTextSchema.optional(),
  contextReason: nonEmptyTextSchema,
  contentTopics: z.array(nonEmptyTextSchema).optional(),
  category: nonEmptyTextSchema.optional(),
  journeyState: journeyStateSchema.optional(),
  activityTime: timestampSchema.optional(),
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

/**
 * The line Edge's own card carries, which is `enhancedTitle` and not `title`.
 *
 * Every record holds both, and the two say different things: "TMOG Performance Tool" against "PC
 * slowing down? Here's how to dig deeper. Shall we get TMOG installed to start testing?". Edge shows
 * the second and shows it in bold, so that is the journey - the short one is a name it files the
 * record under, and `summary` is a third wording it never puts on a card at all.
 *
 * The short title is the fallback rather than the choice, so a record that ever arrives without the
 * enhanced one still has something to say for itself.
 */
export function journeyHeadline(card: Journey) {
  return card.enhancedTitle ?? card.title;
}

/** Where the reader is with it, as Edge tracks it: what they are doing, and how far along. */
function stageOf(card: Journey) {
  return [card.journeyState?.phase, card.journeyState?.activityStatus]
    .filter(part => part !== undefined)
    .join(", ");
}

/** When the browsing behind the card happened, in the reader's own zone and wording. */
function lastActiveOf(card: Journey) {
  const activeAt = card.activityTime === undefined ? null : instantOf(card.activityTime);
  if (!activeAt) {
    return "";
  }

  return formatTimestamp(activeAt.epochMilliseconds);
}

/**
 * Everything Edge holds about a journey that is about the reader rather than about the card, as the
 * lines a destination is handed it in - and the pages it was built from.
 *
 * This is the whole of what a press can carry. Inside Edge the same press reaches a Copilot that was
 * given the journey itself; from here it reaches a stranger who has the question and nothing else,
 * so every field that says something about what the reader was doing goes with it. A field Edge did
 * not write costs its own line and nothing more.
 *
 * What Edge has that this cannot: the words on those pages. Edge keeps them in the same database,
 * encrypted to the browser, and prising them out is neither something this app will do nor something
 * that would survive an update - so the addresses go instead, and a destination that can open one
 * reads it for itself.
 */
export function journeySubject(card: Journey) {
  const facts = [
    {
      label: "Journey",
      value: journeyHeadline(card)
    },
    {
      label: "Why it came up",
      value: card.contextReason
    },
    {
      label: "In short",
      value: card.summary ?? ""
    },
    {
      label: "Topics",
      value: card.contentTopics?.join(", ") ?? ""
    },
    {
      label: "Area",
      value: card.category ?? ""
    },
    {
      label: "Stage",
      value: stageOf(card)
    },
    {
      label: "Last active",
      value: lastActiveOf(card)
    }
  ];

  return {
    facts: facts.filter(fact => fact.value.length > 0).map(fact => `${fact.label}: ${fact.value}`),
    pages: card.sourceInfos
  };
}
