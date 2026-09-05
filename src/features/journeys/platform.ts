import { IS_MAC, IS_WINDOWS } from "@/lib/companion/platform";

/**
 * Journeys exist on fewer machines than the companion that reads them: Microsoft only generates
 * them on Windows and Mac, so on Linux there is nothing on disk for the app to find even once it
 * runs there. Which of those three worlds a browser is in decides what the section says.
 */

/** Microsoft naming the two platforms it generates journeys on. */
export const JOURNEYS_SUPPORT_URL = "https://support.microsoft.com/en-us/microsoft-copilot/copilot-journeys#:~:text=Microsoft%20Edge%20on%20Windows%20and%20Mac%2C%20signed%20in%20with%20a%20personal%20Microsoft%20account";

export enum JourneysAvailability {
  /** Edge on Windows: journeys exist and the companion can read them. */
  readable = "readable",
  /** Edge on Mac: journeys exist, the companion that reads them does not yet. */
  comingSoon = "comingSoon",
  /** Edge anywhere else: Edge itself never makes a journey here. */
  unavailable = "unavailable"
}

function detectAvailability(): JourneysAvailability {
  if (IS_WINDOWS) {
    return JourneysAvailability.readable;
  }

  if (IS_MAC) {
    return JourneysAvailability.comingSoon;
  }

  return JourneysAvailability.unavailable;
}

export const JOURNEYS_AVAILABILITY = detectAvailability();
