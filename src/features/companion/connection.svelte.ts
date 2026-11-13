import { CompanionState, NATIVE_MESSAGING } from "./bridge";
import { AnalyticsEvent } from "@/lib/analytics/definitions";
import { reportQuietly } from "@/lib/analytics/report";
import { MessageType, onMessage } from "@/lib/messaging";

/** One per machine rather than per card family, since journeys and tips come through the same app. */
class Companion {
  /** Written inside the view transition that redraws the rows, so the panel moves with them. */
  state = $state(CompanionState.LOADING);

  /**
   * Decides whether the Store link is drawn, rather than `companionAnswered`: a cache outlives the app
   * that filled it, and the panel must not sell an app the row is visibly running on.
   */
  isRowFilled = $state(false);

  #isLinkReported = false;

  generation = $state(0);

  refresh() {
    this.generation += 1;
  }

  reportLink(state: CompanionState) {
    const isReportable = this.#isLinkReported || state === CompanionState.LOADING;
    if (isReportable) {
      return;
    }

    this.#isLinkReported = true;
    reportQuietly({ name: AnalyticsEvent.COMPANION_LINKED });
  }
}

export const companion = new Companion();

onMessage(MessageType.COMPANION_STARTED, () => companion.refresh());

// Listens for the grant rather than the button press, since it may also come from the browser's own
// extension settings.
browser.permissions.onAdded.addListener(permissions => {
  const isCompanionAllowed = permissions.permissions?.includes(NATIVE_MESSAGING);
  if (isCompanionAllowed) {
    companion.refresh();
  }
});
