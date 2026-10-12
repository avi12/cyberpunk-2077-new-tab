import { hasAccess, requestAccess } from "@/lib/permissions";

/*
 * Only sites where a link alone does not send the prompt (the box is filled but unsent, or not filled
 * at all) - a script finishes the job there, which needs a host permission.
 */

export enum ComposeSiteId {
  claude = "claude",
  copilot = "copilot"
}

/**
 * Pasting is for an editor that drops an insertion's line breaks (Copilot's, measured). It is not
 * the default because some sites turn a large paste into an attachment.
 */
export enum ComposerInsert {
  typed = "typed",
  pasted = "pasted"
}

type ComposeSite = {
  /** Also the origin a tab is recognised by */
  url: string;
  /** Without one, the prompt can only go by link and the script only presses send */
  composerSelector?: string;
  composerInsert?: ComposerInsert;
  /** Copilot ignores its prompt parameter (measured). Never defaulted, so no row hides that */
  isPromptCarriedByUrl: boolean;
  submitSelector: string;
};

/** prosemirror-view's own class, which survives Claude's redesigns. Taken from the library, not a live page */
const CLAUDE_COMPOSER_SELECTOR = "div.ProseMirror[contenteditable=\"true\"]";

/** Microsoft's own id, which survives redesigns and translations */
const COPILOT_COMPOSER_SELECTOR = "#m365-chat-editor-target-element[contenteditable=\"true\"]";

/** No test id and a localized `aria-label`, so the one unhashed class is the anchor */
const COPILOT_SUBMIT_SELECTOR = "button.fai-SendButton";

export const COMPOSE_SITES: Record<ComposeSiteId, ComposeSite> = {
  [ComposeSiteId.claude]: {
    url: "https://claude.ai/new",
    composerSelector: CLAUDE_COMPOSER_SELECTOR,
    isPromptCarriedByUrl: true,
    submitSelector: "[data-testid=\"chat-input-send\"]"
  },
  // `/chat` directly: the root redirects there, and the tab could report finished before the bounce
  [ComposeSiteId.copilot]: {
    url: "https://copilot.com/chat",
    composerSelector: COPILOT_COMPOSER_SELECTOR,
    composerInsert: ComposerInsert.pasted,
    isPromptCarriedByUrl: false,
    submitSelector: COPILOT_SUBMIT_SELECTOR
  }
};

function composeOrigin(siteId: ComposeSiteId) {
  return `${new URL(COMPOSE_SITES[siteId].url).origin}/*`;
}

export function isComposerFillable(siteId: ComposeSiteId) {
  return COMPOSE_SITES[siteId].composerSelector !== undefined;
}

export function composeSiteUrl(siteId: ComposeSiteId) {
  return COMPOSE_SITES[siteId].url;
}

export function isPromptCarriedToSite(siteId: ComposeSiteId) {
  return COMPOSE_SITES[siteId].isPromptCarriedByUrl;
}

export function composeAccessRequest(siteId: ComposeSiteId) {
  return { origins: [composeOrigin(siteId)] };
}

export async function requestComposeAccess(siteId: ComposeSiteId) {
  return requestAccess(composeAccessRequest(siteId));
}

export async function hasComposeAccess(siteId: ComposeSiteId) {
  return hasAccess(composeAccessRequest(siteId));
}

/** By origin, so a redirect within the site still counts */
export function isAtComposeSite({ url, siteId }: {
  url: string;
  siteId: ComposeSiteId;
}) {
  try {
    return new URL(url).origin === new URL(COMPOSE_SITES[siteId].url).origin;
  } catch {
    return false;
  }
}
