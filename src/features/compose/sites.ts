import { hasAccess, requestAccess } from "@/lib/permissions";

/**
 * The sites a prompt cannot simply be linked to, and what it takes to finish the job there.
 *
 * Most destinations answer a prompt carried in the URL the moment they open, and those are not here:
 * a link is the whole feature. A site is only listed when arriving is not the same as asking - the
 * box is filled but unsent, or there is no way to fill it by link at all - and finishing means a
 * script pressing the button the reader would have pressed.
 *
 * That script needs the site, which is a permission, which is a question. So the table is the single
 * place that says which destinations raise one.
 */

export enum ComposeSiteId {
  copilot = "copilot",
  claude = "claude"
}

type ComposeSite = {
  /** Where the reader lands with nothing carried, and the origin a tab is recognised by. */
  url: string;
  /**
   * The box to fill, for a site whose prompt is better typed than linked. Naming one is what lets a
   * prompt of any length reach the site at all, since the script carries it in rather than the URL;
   * a site that leaves it out can only be handed a prompt by link, and its script only presses send.
   */
  composerSelector?: string;
  submitSelector: string;
};

/**
 * Claude's box is a ProseMirror document, so the anchor is the class prosemirror-view puts on its
 * own editable node - the one part of that box the product's own redesigns do not name. Settled from
 * the library rather than from a live page, so an empty box at the far end starts here.
 */
const CLAUDE_COMPOSER_SELECTOR = "div.ProseMirror[contenteditable=\"true\"]";

export const COMPOSE_SITES: Record<ComposeSiteId, ComposeSite> = {
  [ComposeSiteId.copilot]: {
    url: "https://copilot.microsoft.com/",
    composerSelector: "[data-testid=\"composer-input\"]",
    submitSelector: "[data-testid=\"submit-button\"]"
  },
  [ComposeSiteId.claude]: {
    url: "https://claude.ai/new",
    composerSelector: CLAUDE_COMPOSER_SELECTOR,
    submitSelector: "[data-testid=\"chat-input-send\"]"
  }
};

function composeOrigin(siteId: ComposeSiteId) {
  return `${new URL(COMPOSE_SITES[siteId].url).origin}/*`;
}

/**
 * Whether a prompt can arrive at a site by script rather than in its URL, which is the whole
 * question of how long a prompt may be. Asked of the table so nobody reads a selector as a hint.
 */
export function isComposerFillable(siteId: ComposeSiteId) {
  return COMPOSE_SITES[siteId].composerSelector !== undefined;
}

/**
 * Asked for on its own and only when it is about to be used, so nobody hands over a site for a
 * destination they never pick. Refusing costs only the sending: the prompt still gets there.
 */
export async function requestComposeAccess(siteId: ComposeSiteId) {
  return requestAccess({ origins: [composeOrigin(siteId)] });
}

export async function hasComposeAccess(siteId: ComposeSiteId) {
  return hasAccess({ origins: [composeOrigin(siteId)] });
}

/** Whether a tab has arrived at a site, by origin, so a redirect within it still counts as there. */
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
