/**
 * Journeys has no switch until the Copilot new tab page above it is on, so one address serves both.
 *
 * Chromium refuses to navigate page content to an `edge://` page ("Not allowed to load local
 * resource"), so the press is handled with `tabs.create`. The `href` stays so the address can be read
 * and copied; a middle-click bypasses the handler and is refused.
 *
 * The names are Edge's exact labels beside each switch.
 */
export const COPILOT_SETTINGS_URL = "edge://settings/ai";

export const COPILOT_SETTINGS_SECTION = "Copilot and AI";

export const COPILOT_MODE_SETTING = "Copilot new tab page";

export const JOURNEYS_SETTING = "Journeys";

export async function openCopilotSettings() {
  await browser.tabs.create({ url: COPILOT_SETTINGS_URL });
}
