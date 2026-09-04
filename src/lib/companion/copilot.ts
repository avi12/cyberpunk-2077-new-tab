import type { CompanionRead } from "./bridge";
import { CompanionState, MAX_CARDS } from "./bridge";
import iconMap from "@/assets/icons/map.svg?raw";
import iconSparkles from "@/assets/icons/sparkles.svg?raw";
import { readJourneys } from "@/lib/journeys/bridge";
import type { Journey } from "@/lib/journeys/model";
import { readTips } from "@/lib/tips/bridge";
import type { Tip } from "@/lib/tips/model";

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

/** Where a card sends the reader, and - as a pattern - the site it may be allowed to type into. */
export const COPILOT_URL = "https://copilot.microsoft.com/";

/*
 * `wxt.config.ts` spells this pattern again in `optional_host_permissions`, and has to: a manifest is
 * built by Node before any of this is bundled, and this module reaches icons through Vite. The same
 * split the companion's own permission lives with.
 */
const COPILOT_ORIGIN = `${COPILOT_URL}*`;

/**
 * Being allowed to type the prompt in is asked for on its own, and only once the app has actually
 * answered: nobody should be asked to hand over a site for a feature that turned out not to work on
 * their machine. Refusing costs only the typing - the card still opens Copilot with the prompt
 * copied, which is what it has always done.
 */
export async function requestCopilotAccess(): Promise<boolean> {
  return browser.permissions.request({ origins: [COPILOT_ORIGIN] });
}

export async function hasCopilotAccess(): Promise<boolean> {
  return browser.permissions.contains({ origins: [COPILOT_ORIGIN] });
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
 * Journeys lead, because they are about what you were actually doing, and a tip keeps the last seat
 * whenever there is one to seat. A used profile has journeys to spare, so handing every seat to
 * them in turn would mean a tip is never seen at all.
 */
function deal({ journeys, tips }: {
  journeys: Journey[];
  tips: Tip[];
}): CopilotCard[] {
  const tipSeats = Math.max(MAX_CARDS - journeys.length, tips.length > 0 ? 1 : 0);

  return [
    ...journeys.slice(0, MAX_CARDS - tipSeats).map(journeyCard),
    ...tips.slice(0, tipSeats).map(tipCard)
  ];
}

/**
 * Least to most worth saying. Both reads ask the same worker behind the same permission, so they
 * only ever disagree when one of them still has a fresh snapshot and the other does not - and cards
 * on the page are the answer to every question the other states would raise.
 */
const STATE_ORDER = [
  CompanionState.connected,
  CompanionState.companionOffline,
  CompanionState.linking,
  CompanionState.permissionNeeded,
  CompanionState.loading
];

function louder(first: CompanionState, second: CompanionState): CompanionState {
  return STATE_ORDER.indexOf(first) > STATE_ORDER.indexOf(second) ? first : second;
}

/** Both families as one row, however few of either the machine turned out to have. */
export async function readCopilot(): Promise<CompanionRead<CopilotCard>> {
  const [journeys, tips] = await Promise.all([readJourneys(), readTips()]);
  const cards = deal({
    journeys: journeys.cards,
    tips: tips.cards
  });

  return {
    state: cards.length > 0 ? CompanionState.connected : louder(journeys.state, tips.state),
    cards
  };
}
