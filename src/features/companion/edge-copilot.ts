/**
 * The two Edge switches this whole row stands on, and the page that holds them.
 *
 * Both sit under Copilot and AI, and in that order: Journeys has no switch of its own to flip until
 * the Copilot new tab page above it is on, which is why one address serves both and the wording asks
 * for them in turn.
 *
 * Opened rather than linked. Chromium refuses to navigate page content to a browser page, so an
 * `<a href="edge://...">` here would do nothing at all and say nothing about why - `tabs.create`
 * from the extension is allowed, and was proved so in Edge before any of this was written.
 *
 * The names are what Edge prints beside each switch, so they are worth spelling here rather than in
 * the sentences that read them: a reader is being sent to look for those exact words.
 */
const COPILOT_SETTINGS_URL = "edge://settings/ai";

export const COPILOT_SETTINGS_SECTION = "Copilot and AI";

export const COPILOT_MODE_SETTING = "Copilot new tab page";

export const JOURNEYS_SETTING = "Journeys";

export async function openCopilotSettings() {
  await browser.tabs.create({ url: COPILOT_SETTINGS_URL });
}
