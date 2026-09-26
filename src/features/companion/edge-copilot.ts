/**
 * The two Edge switches this whole row stands on, and the page that holds them.
 *
 * Both sit under Copilot and AI, and in that order: Journeys has no switch of its own to flip until
 * the Copilot new tab page above it is on, which is why one address serves both and the wording asks
 * for them in turn.
 *
 * Linked and opened, both. Chromium refuses to navigate page content to a browser page - measured,
 * a real click on an `<a href="edge://...">` logs "Not allowed to load local resource" and opens
 * nothing - so the press is handled and `tabs.create` is what actually opens it. The address still
 * belongs on the `href`: it is one a reader can read off the status bar, copy, and type themselves,
 * which no button can offer. The one thing it cannot survive is a middle-click, which goes around
 * the handler and is refused.
 *
 * The names are what Edge prints beside each switch, so they are worth spelling here rather than in
 * the sentences that read them: a reader is being sent to look for those exact words.
 */
export const COPILOT_SETTINGS_URL = "edge://settings/ai";

export const COPILOT_SETTINGS_SECTION = "Copilot and AI";

export const COPILOT_MODE_SETTING = "Copilot new tab page";

export const JOURNEYS_SETTING = "Journeys";

export async function openCopilotSettings() {
  await browser.tabs.create({ url: COPILOT_SETTINGS_URL });
}
