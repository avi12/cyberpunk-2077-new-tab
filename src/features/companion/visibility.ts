import { IS_EDGE } from "./platform";
import type { DisplayPreferences } from "@/lib/storage/schema";

/** A stored `true` can sync into a non-Edge browser, where the section can never show. */
export function isCopilotShowing(preferences: DisplayPreferences) {
  return IS_EDGE && preferences.showCopilot;
}
