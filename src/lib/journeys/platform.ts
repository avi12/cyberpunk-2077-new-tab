/**
 * Copilot Journeys are Edge's own: it generates them on the device and files them under the browser
 * profile, and Microsoft only does that on Windows and Mac. Reading them needs the companion app,
 * which ships through the Microsoft Store and so is Windows-only for now.
 *
 * Which of those three worlds a browser is in decides everything the section says, so it is worked
 * out once, here.
 */
const EDGE_PATTERN = /\bEdg\//;

const WINDOWS_PATTERN = /Windows NT/;

const MAC_PATTERN = /Macintosh/;

/** Microsoft naming the two platforms it generates journeys on. */
export const JOURNEYS_SUPPORT_URL = "https://support.microsoft.com/en-us/microsoft-copilot/copilot-journeys#:~:text=Microsoft%20Edge%20on%20Windows%20and%20Mac%2C%20signed%20in%20with%20a%20personal%20Microsoft%20account";

export enum JourneysAvailability {
  /** Edge on Windows: journeys exist and the companion can read them. */
  readable = "readable",
  /** Edge on Mac: journeys exist, the companion that reads them does not yet. */
  comingSoon = "comingSoon",
  /** Edge anywhere else: Edge itself never makes a journey here. */
  unavailable = "unavailable",
  /** Not Edge at all, where there is no such thing as a journey to explain. */
  absent = "absent"
}

function detectAvailability(): JourneysAvailability {
  const agent = navigator.userAgent;
  if (!EDGE_PATTERN.test(agent)) {
    return JourneysAvailability.absent;
  }

  if (WINDOWS_PATTERN.test(agent)) {
    return JourneysAvailability.readable;
  }

  if (MAC_PATTERN.test(agent)) {
    return JourneysAvailability.comingSoon;
  }

  return JourneysAvailability.unavailable;
}

export const JOURNEYS_AVAILABILITY = detectAvailability();

/** Whether the section - and so the Terminal Display switch that hides it - has anything to say. */
export const HAS_JOURNEYS = JOURNEYS_AVAILABILITY !== JourneysAvailability.absent;
