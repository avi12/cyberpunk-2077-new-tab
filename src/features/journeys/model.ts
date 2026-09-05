import { MAX_CARDS } from "@/lib/companion/bridge";
import { nonEmptyTextSchema, validRecords } from "@/lib/companion/model";
import { z } from "@/lib/zod";

/**
 * Edge writes fractional seconds at whatever precision it happens to have ("...:29.2Z"), which no
 * fixed ISO pattern matches, so the parser is the check.
 */
const timestampSchema = z.string().refine(value => !Number.isNaN(Date.parse(value)));

const journeySourceSchema = z.object({
  title: nonEmptyTextSchema,
  url: z.url()
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
  rankScore: z.number().default(0),
  validStartTime: timestampSchema,
  validEndTime: timestampSchema
});

export type Journey = z.infer<typeof journeySchema>;

function isLive({ card, nowMs }: {
  card: Journey;
  nowMs: number;
}) {
  return Date.parse(card.validStartTime) <= nowMs && nowMs < Date.parse(card.validEndTime);
}

/**
 * A card that has expired is dropped along with the malformed ones. Edge ranks its own cards and
 * this keeps that order, taking the highest scoring three - a snapshot usually holds a few more.
 */
export function parseJourneys({ raw, nowMs }: {
  raw: unknown;
  nowMs: number;
}): Journey[] {
  return validRecords({
    raw,
    schema: journeySchema
  })
    .filter(card => isLive({
      card,
      nowMs
    }))
    .sort((first, second) => second.rankScore - first.rankScore)
    .slice(0, MAX_CARDS);
}

/** The card's own prompt: the first is the one Edge itself sends when its card is clicked. */
export function copilotPrompt(card: Journey): string {
  return card.copilotPrompts[0];
}
