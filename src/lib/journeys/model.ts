import { z } from "@/lib/zod";

/** Edge shows three at a time; a snapshot usually holds a few more, ranked. */
export const MAX_JOURNEYS = 3;

/**
 * Copilot's web app throws away every query parameter it is handed - `q`, `prompt`, `text`, a hash,
 * on every path - and lands on its own front page, so a prompt cannot travel in the link. It goes on
 * the clipboard instead, and the person pastes it into the box that is waiting for them.
 */
export const COPILOT_URL = "https://copilot.microsoft.com/";

/**
 * Edge writes fractional seconds at whatever precision it happens to have ("...:29.2Z"), which no
 * fixed ISO pattern matches, so the parser is the check.
 */
const timestampSchema = z.string().refine(value => !Number.isNaN(Date.parse(value)));

const journeySourceSchema = z.object({
  title: z.string().min(1),
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
  id: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  contextReason: z.string().min(1),
  buttonText: z.string().min(1),
  copilotPrompts: z.tuple([z.string().min(1)], z.string()),
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
 * The bridge's answer is untrusted input, so every card is validated on its own: a malformed or
 * expired one is skipped rather than failing the whole snapshot. Edge ranks its own cards and this
 * keeps that order, taking the highest scoring three.
 */
export function parseJourneys({ raw, nowMs }: {
  raw: unknown;
  nowMs: number;
}): Journey[] {
  const entries = z.array(z.unknown()).safeParse(raw);
  if (!entries.success) {
    return [];
  }

  const cards: Journey[] = [];
  for (const entry of entries.data) {
    const card = journeySchema.safeParse(entry);
    if (card.success && isLive({
      card: card.data,
      nowMs
    })) {
      cards.push(card.data);
    }
  }

  return cards.sort((first, second) => second.rankScore - first.rankScore).slice(0, MAX_JOURNEYS);
}

/** The card's own prompt: the first is the one Edge itself sends when its card is clicked. */
export function copilotPrompt(card: Journey): string {
  return card.copilotPrompts[0];
}
