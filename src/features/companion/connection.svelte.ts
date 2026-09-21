import { CompanionState, NATIVE_MESSAGING } from "./bridge";
import { AnalyticsEvent } from "@/lib/analytics/definitions";
import { reportQuietly } from "@/lib/analytics/report";

/**
 * Whether the companion can be reached at all, which is one fact about the machine rather than one
 * per card family: journeys and Copilot tips come through the same app, so the setup story is told
 * once, and the retry that ends it runs once.
 */
class Companion {
  /**
   * What the last completed read found. Every section writes it, and they all find the same thing -
   * inside the view transition that redraws the page, so the panel and the rows move together.
   */
  state = $state(CompanionState.loading);

  /** Reported once per page, not once per read: every section writes `state` and they all agree. */
  #isLinkReported = false;

  /** Bumped when there is reason to read again: a permission just granted, or a retry coming round. */
  generation = $state(0);

  refresh() {
    this.generation += 1;
  }

  /**
   * Whether the app was reachable at all, which is the one number that says if the companion is
   * worth the shelf space it takes on the Store.
   */
  reportLink(state: CompanionState) {
    if (this.#isLinkReported || state === CompanionState.loading) {
      return;
    }

    this.#isLinkReported = true;
    reportQuietly(AnalyticsEvent.companionLinked);
  }
}

export const companion = new Companion();

/**
 * The grant is what starts the listening, whoever made it - the panel's own button, or the browser's
 * own extension settings, where nothing on this page sees the press. Reading the permission change
 * rather than the press that usually causes it is what keeps those two from being separate answers
 * to "may the app be asked yet"; `readCompanion` is already decided by the permission alone.
 */
browser.permissions.onAdded.addListener(permissions => {
  const isCompanionAllowed = permissions.permissions?.includes(NATIVE_MESSAGING);
  if (isCompanionAllowed) {
    companion.refresh();
  }
});
