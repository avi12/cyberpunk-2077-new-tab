import type { CompanionRead } from "./bridge";
import { CompanionState, CompanionUnreachable, MAX_CARDS } from "./bridge";
import iconClock from "@/assets/icons/clock.svg?raw";
import iconLightbulb from "@/assets/icons/lightbulb.svg?raw";
import { readJourneys, rememberedJourneys } from "@/features/journeys/bridge";
import type { Journey } from "@/features/journeys/model";
import { readTips, rememberedTips } from "@/features/tips/bridge";
import type { Tip } from "@/features/tips/model";

/**
 * Journeys and tips share one row, as in Edge, but are read apart: a journey goes stale in an hour,
 * while the day's tips hold until midnight.
 */

export enum CopilotKind {
  JOURNEY = "journey",
  TIP = "tip"
}

export const COPILOT_KINDS = {
  [CopilotKind.JOURNEY]: {
    label: "Journeys",
    icon: iconClock
  },
  [CopilotKind.TIP]: {
    label: "Tips",
    icon: iconLightbulb
  }
} as const;

/*
 * `Copilot.svelte` needs this for a snippet parameter, which Svelte will not infer from the
 * component's generic. Fallow cannot follow a type-only import into a `.svelte` file.
 */
// fallow-ignore-next-line unused-type
export type CopilotCard =
  | {
    id: string;
    kind: CopilotKind.JOURNEY;
    journey: Journey;
  }
  | {
    id: string;
    kind: CopilotKind.TIP;
    tip: Tip;
  };

/** The ids come from two different Microsoft catalogues, so the kind keeps them apart. */
function journeyCard(journey: Journey) {
  return {
    id: `${CopilotKind.JOURNEY}:${journey.id}`,
    kind: CopilotKind.JOURNEY as const,
    journey
  };
}

function tipCard(tip: Tip) {
  return {
    id: `${CopilotKind.TIP}:${tip.id}`,
    kind: CopilotKind.TIP as const,
    tip
  };
}

function toCards<TItem>({ cards, toCard }: {
  cards: TItem[];
  toCard: (item: TItem) => CopilotCard;
}) {
  return cards.slice(0, MAX_CARDS).map(toCard);
}

function cardsOf<TItem>({ read, toCard }: {
  read: PromiseSettledResult<CompanionRead<TItem>>;
  toCard: (item: TItem) => CopilotCard;
}) {
  if (read.status === "rejected") {
    return [];
  }

  return toCards({
    cards: read.value.cards,
    toCard
  });
}

function stateOf(read: PromiseSettledResult<CompanionRead<unknown>>) {
  if (read.status === "fulfilled") {
    return read.value.state;
  }

  if (read.reason instanceof CompanionUnreachable) {
    return read.reason.state;
  }

  return CompanionState.COMPANION_OFFLINE;
}

/** Journeys first and tips in the seats they leave, as Edge's own row does. */
function dealRow({ journeys, tips }: {
  journeys: CopilotCard[];
  tips: CopilotCard[];
}) {
  return [...journeys, ...tips].slice(0, MAX_CARDS);
}

/** Least to most worth saying, for when the two reads disagree. */
const STATE_ORDER = [
  // Quieter than connected, so it only shows when both families found nothing - otherwise a row of
  // journeys would sit under a request to switch journeys on.
  CompanionState.EDGE_HAS_NOTHING,
  CompanionState.CONNECTED,
  CompanionState.COMPANION_OFFLINE,
  CompanionState.COMPANION_NOT_RUNNING,
  CompanionState.LINKING,
  CompanionState.PERMISSION_NEEDED,
  CompanionState.SETUP_NEEDED,
  CompanionState.LOADING
];

function louderState({ first, second }: {
  first: CompanionState;
  second: CompanionState;
}) {
  return STATE_ORDER.indexOf(first) > STATE_ORDER.indexOf(second) ? first : second;
}

/**
 * A failed read is reported even under a full row: tips are cached for a day, so a cut-off app first
 * shows only as journeys quietly turning into tips.
 */
export async function readCopilot() {
  const [journeys, tips] = await Promise.allSettled([readJourneys(), readTips()]);

  return {
    state: louderState({
      first: stateOf(journeys),
      second: stateOf(tips)
    }),
    cards: dealRow({
      journeys: cardsOf({
        read: journeys,
        toCard: journeyCard
      }),
      tips: cardsOf({
        read: tips,
        toCard: tipCard
      })
    })
  };
}

/**
 * Dealt by the same rule as a live read, since the section treats any difference between the two as
 * news.
 */
export async function rememberedCopilot() {
  const [journeys, tips] = await Promise.all([rememberedJourneys(), rememberedTips()]);

  return dealRow({
    journeys: toCards({
      cards: journeys,
      toCard: journeyCard
    }),
    tips: toCards({
      cards: tips,
      toCard: tipCard
    })
  });
}
