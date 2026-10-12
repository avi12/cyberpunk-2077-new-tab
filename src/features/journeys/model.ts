import { formatTimestamp } from "@/features/clock/time";
import { MAX_CARDS } from "@/features/companion/bridge";
import { nonEmptyTextSchema, validRecords } from "@/features/companion/model";
import { openableUrlSchema } from "@/lib/url";
import { z } from "@/lib/zod";

/**
 * Edge writes fractional seconds at varying precision ("...:29.2Z"), so the parser is the check.
 * `Temporal.Instant` rejects a stamp with no zone rather than reading it as local time like
 * `Date.parse` would.
 */
function instantOf(value: string) {
  try {
    return Temporal.Instant.from(value);
  } catch {
    return null;
  }
}

const timestampSchema = z.string().refine(value => instantOf(value) !== null);

/** The address goes into an `href`, so the scheme is pinned: `z.url()` accepts `javascript:` too. */
const journeySourceSchema = z.object({
  title: nonEmptyTextSchema,
  url: openableUrlSchema
});

const journeyStateSchema = z.object({
  phase: nonEmptyTextSchema.optional(),
  activityStatus: nonEmptyTextSchema.optional()
});

/**
 * Fields nothing draws are still kept, because a press sends them as context - see `journeySubject`.
 * They are optional since the shape is Edge's, not a contract, so a missing one costs a line rather
 * than the card. The prompts tuple filters out the navigation and backfill cards that carry none.
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
 * Kept in stored order, not sorted by `rankScore`: measured with three live journeys scoring 60.94,
 * 65.33 and 60.57, Edge showed them in exactly that order.
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

/** The first is the one Edge itself sends when its card is clicked. */
export function copilotPrompt(card: Journey) {
  return card.copilotPrompts[0];
}

/** Edge's card shows `enhancedTitle`; `title` is only the short name it files the record under. */
export function journeyHeadline(card: Journey) {
  return card.enhancedTitle ?? card.title;
}

function stageOf(card: Journey) {
  return [card.journeyState?.phase, card.journeyState?.activityStatus]
    .filter(part => part !== undefined)
    .join(", ");
}

function lastActiveOf(card: Journey) {
  const activeAt = card.activityTime === undefined ? null : instantOf(card.activityTime);
  if (!activeAt) {
    return "";
  }

  return formatTimestamp(activeAt.epochMilliseconds);
}

/**
 * Inside Edge, Copilot is handed the journey itself; from here a destination gets only the prompt, so
 * every field about the reader goes with it. Page text stays out: Edge keeps it encrypted to the
 * browser, so the addresses go instead.
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
