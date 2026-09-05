/**
 * Which browser this is and which machine it is on - the two facts that decide what either card
 * family can say, worked out once, here.
 *
 * Copilot Journeys and Copilot tips are both Edge's own: it generates the one on the device and
 * caches the other, and files both under the browser profile. Reading either needs the companion
 * app, which ships through the Microsoft Store and so is Windows-only for now.
 */
const AGENT = navigator.userAgent;

const EDGE_PATTERN = /\bEdg\//;

const WINDOWS_PATTERN = /Windows NT/;

const MAC_PATTERN = /Macintosh/;

/** Outside Edge there is no such thing as a journey or a Copilot tip to explain. */
export const IS_EDGE = EDGE_PATTERN.test(AGENT);

/** The only platform the companion runs on, and so the only one either family can be read on. */
export const IS_WINDOWS = WINDOWS_PATTERN.test(AGENT);

export const IS_MAC = MAC_PATTERN.test(AGENT);
