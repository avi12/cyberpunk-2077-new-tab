import type { CompanionRead } from "./bridge";
import { CompanionState, CompanionUnreachable, MAX_CARDS } from "./bridge";
import iconMap from "@/assets/icons/map.svg?raw";
import iconSparkles from "@/assets/icons/sparkles.svg?raw";
import { readJourneys, rememberedJourneys } from "@/features/journeys/bridge";
import type { Journey } from "@/features/journeys/model";
import { readTips, rememberedTips } from "@/features/tips/bridge";
import type { Tip } from "@/features/tips/model";

/**
 * The one row Edge itself shows: journeys and Copilot tips side by side under a single heading,
 * each card saying which of the two it is. They arrive from the same app through two reads with
 * very different clocks - a journey goes stale in an hour, the day's tips hold until midnight - so
 * they are fetched apart and dealt together.
 */

export enum CopilotKind {
  journey = "journey",
  tip = "tip"
}

/** What a card of either kind wears: the label and mark Edge puts above its title. */
export const COPILOT_KINDS = {
  [CopilotKind.journey]: {
    label: "Journeys",
    icon: iconMap
  },
  [CopilotKind.tip]: {
    label: "Tips",
    icon: iconSparkles
  }
} as const;

/*
 * `Copilot.svelte` is the only thing outside this file that names the type, and a snippet parameter
 * is the one place Svelte will not infer it from the component's generic - measured: dropping the
 * annotation there is an implicit `any`. Fallow cannot follow a type-only import into a `.svelte`
 * file, so the export reads as unused when it is not.
 */
// fallow-ignore-next-line unused-type
export type CopilotCard =
  | {
    id: string;
    kind: CopilotKind.journey;
    journey: Journey;
  }
  | {
    id: string;
    kind: CopilotKind.tip;
    tip: Tip;
  };

/** A journey id and a tip id are Microsoft's, from two different catalogues, so the kind keeps them apart. */
function journeyCard(journey: Journey): CopilotCard {
  return {
    id: `${CopilotKind.journey}:${journey.id}`,
    kind: CopilotKind.journey,
    journey
  };
}

function tipCard(tip: Tip): CopilotCard {
  return {
    id: `${CopilotKind.tip}:${tip.id}`,
    kind: CopilotKind.tip,
    tip
  };
}

/** Whatever a family had, as cards, never more than the row can seat. */
function toCards<TItem>({ cards, toCard }: {
  cards: TItem[];
  toCard: (item: TItem) => CopilotCard;
}) {
  return cards.slice(0, MAX_CARDS).map(toCard);
}

/** What a family actually has to show. A read that never happened has nothing, like one that found nothing. */
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

/**
 * Which state a settled read stands for. A read that happened says so itself; one that threw says
 * it in the error it threw - and anything that threw for a reason this does not know is a read
 * that did not happen either, which is what `companionOffline` has always meant.
 */
function stateOf(read: PromiseSettledResult<CompanionRead<unknown>>) {
  if (read.status === "fulfilled") {
    return read.value.state;
  }

  if (read.reason instanceof CompanionUnreachable) {
    return read.reason.state;
  }

  return CompanionState.companionOffline;
}

/**
 * Journeys first, and tips in whatever seats they leave - Edge's own row, watched with one live
 * journey beside two tips. It used to be one family or the other, from a profile that happened to
 * have three journeys at once; a row with fewer is topped up rather than left to end early.
 *
 * A family that could not be read has nothing to show, the same as one that had nothing - what
 * happened is the panel's to say, above the row, and it does.
 */
function deal({ journeys, tips }: {
  journeys: CopilotCard[];
  tips: CopilotCard[];
}) {
  return [...journeys, ...tips].slice(0, MAX_CARDS);
}

/**
 * Least to most worth saying. Both reads ask the same worker behind the same permission, so they
 * only ever disagree when one of them still has a fresh snapshot and the other does not.
 */
const STATE_ORDER = [
  /*
   * Quieter than being connected, and deliberately: either family having something to show is the
   * answer to how the browser is set, so this only ever speaks when both of them found nothing.
   * Loud enough to sit above a full row, it would tell a reader watching their own journeys to go
   * and switch journeys on.
   */
  CompanionState.edgeHasNothing,
  CompanionState.connected,
  CompanionState.companionOffline,
  CompanionState.companionNotRunning,
  CompanionState.linking,
  CompanionState.permissionNeeded,
  CompanionState.setupNeeded,
  CompanionState.loading
];

function louder({ first, second }: {
  first: CompanionState;
  second: CompanionState;
}) {
  return STATE_ORDER.indexOf(first) > STATE_ORDER.indexOf(second) ? first : second;
}

/**
 * Both families as one row, however few of either the machine turned out to have.
 *
 * Cards on the page used to silence whatever the reads had said, on the grounds that a full row
 * answers every question. It does not, and the two caches are why: tips hold for a day and journeys
 * for an hour, so anything that cuts the app off shows up first as the journeys quietly going away
 * and the row filling back up with tips. Called "connected", that is a row missing half of itself
 * with nothing on the page saying so - which is exactly how a launcher renamed out from under the
 * registration went unnoticed. A read that did not work is worth saying however many cards the other
 * one still had.
 */
export async function readCopilot() {
  /*
   * Settled rather than all: one family failing must not take the other's cards down with it, which
   * is the whole reason the row can show a stand-in beside real cards at all.
   */
  const [journeys, tips] = await Promise.allSettled([readJourneys(), readTips()]);

  return {
    state: louder({
      first: stateOf(journeys),
      second: stateOf(tips)
    }),
    cards: deal({
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
 * The row as the app last left it, off storage alone. This is what the section opens on, so that a
 * reader who has seen these cards before sees them again as the page paints rather than a row of
 * placeholders while the app is asked.
 *
 * Dealt by the same rule as a live answer, and it has to be: a stored row dealt one way and a live
 * row dealt another would disagree on every page, and the section reads disagreement as news.
 */
export async function rememberedCopilot() {
  const [journeys, tips] = await Promise.all([rememberedJourneys(), rememberedTips()]);

  return deal({
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
