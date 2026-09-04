import { hasCopilotAccess } from "./copilot";
import { copilotTypingRefusedItem } from "@/lib/storage/items";

/**
 * Whether a card can type its prompt into Copilot, which decides what its action does. Two things
 * have to be true: the reader allowed the site, and the browser did not refuse the script outright.
 *
 * The refusal is discovered rather than predicted. Edge blocks every extension from scripting
 * `copilot.microsoft.com` today, but a browser that stops blocking it needs no code change here -
 * the first click that succeeds is simply never recorded as a refusal.
 */
class CopilotAccess {
  /**
   * Undefined until the browser has been asked. Offering the site on the strength of a `false` that
   * only means "not looked yet" would flash the offer past everyone who had already allowed it, once
   * per tab, so the offer waits for an actual answer.
   */
  isGranted = $state<boolean | undefined>(undefined);

  isRefused = $state(false);

  /** The one answer a card acts on; asking its two halves separately is how they drift apart. */
  get canType() {
    return this.isGranted === true && !this.isRefused;
  }

  async refresh() {
    const [isGranted, isRefused] = await Promise.all([hasCopilotAccess(), copilotTypingRefusedItem.getValue()]);
    this.isGranted = isGranted;
    this.isRefused = isRefused;
  }

  async recordRefusal() {
    this.isRefused = true;
    await copilotTypingRefusedItem.setValue(true);
  }
}

export const copilotAccess = new CopilotAccess();
