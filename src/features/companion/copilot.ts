import type { CompanionRead } from "./bridge";
import { CompanionState, CompanionUnreachable, MAX_CARDS } from "./bridge";
import iconMap from "@/assets/icons/map.svg?raw";
import iconSparkles from "@/assets/icons/sparkles.svg?raw";
import { readJourneys } from "@/features/journeys/bridge";
import type { Journey } from "@/features/journeys/model";
import { readTips } from "@/features/tips/bridge";
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

/**
 * Whose row it is. Not a mixture of the two, and never one family padding out the other.
 *
 * Edge deals its own row this way: journeys have it whenever there are any, measured at three of
 * three with no tip appearing, and a profile with only one journey is shown one card and a row that
 * simply ends there rather than one topped up to three with tips. Tips have the row when there are
 * no journeys to have it.
 *
 * A family that could not be read has nothing to show, the same as one that had nothing - what
 * happened is the panel's to say, above the row, and it does.
 */
/** What a family actually has to show. A read that never happened has nothing, like one that found nothing. */
function cardsOf<TItem>({ read, toCard }: {
  read: PromiseSettledResult<CompanionRead<TItem>>;
  toCard: (item: TItem) => CopilotCard;
}) {
  if (read.status === "rejected") {
    return [];
  }

  return read.value.cards.slice(0, MAX_CARDS).map(toCard);
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

function deal({ journeys, tips }: {
  journeys: PromiseSettledResult<CompanionRead<Journey>>;
  tips: PromiseSettledResult<CompanionRead<Tip>>;
}) {
  const dealt = cardsOf({
    read: journeys,
    toCard: journeyCard
  });
  if (dealt.length > 0) {
    return dealt;
  }

  return cardsOf({
    read: tips,
    toCard: tipCard
  });
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
      journeys,
      tips
    })
  };
}
