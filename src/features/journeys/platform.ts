import { IS_MAC, IS_WINDOWS } from "@/features/companion/platform";

/** Microsoft only generates journeys on Windows and Mac. */
export const JOURNEYS_SUPPORT_URL =
  "https://support.microsoft.com/en-us/microsoft-copilot/copilot-journeys#:~:text=Microsoft%20Edge%20on%20Windows%20and%20Mac%2C%20signed%20in%20with%20a%20personal%20Microsoft%20account";

export enum JourneysAvailability {
  READABLE = "readable",
  /** Journeys exist on Mac, but the companion does not yet. */
  COMING_SOON = "comingSoon",
  UNAVAILABLE = "unavailable"
}

function detectAvailability() {
  if (IS_WINDOWS) {
    return JourneysAvailability.READABLE;
  }

  if (IS_MAC) {
    return JourneysAvailability.COMING_SOON;
  }

  return JourneysAvailability.UNAVAILABLE;
}

export const JOURNEYS_AVAILABILITY = detectAvailability();
