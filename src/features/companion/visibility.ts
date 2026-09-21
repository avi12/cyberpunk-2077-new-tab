import { IS_EDGE } from "./platform";
import type { DisplayPreferences } from "@/lib/storage/schema";

/**
 * Whether the Copilot section is showing, which is never what is stored on its own.
 *
 * The cards are Microsoft Edge's own, read out of its profile, so another browser can draw the
 * section under no circumstances. A stored `true` still arrives there - settings back up to the
 * browser account and restore into whatever is signed in, so a reader who turned it on in Edge
 * carries it to Chrome - and the switch would then read on beside a page that shows nothing.
 *
 * One answer for the page and the switch alike: computing it twice is how they came to disagree.
 */
export function isCopilotShowing(preferences: DisplayPreferences) {
  return IS_EDGE && preferences.showCopilot;
}
