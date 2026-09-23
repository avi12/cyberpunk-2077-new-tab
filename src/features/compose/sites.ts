import { hasAccess, requestAccess } from "@/lib/permissions";

/**
 * The sites a prompt cannot simply be linked to, and what it takes to finish the job there.
 *
 * Most destinations answer a prompt carried in the URL the moment they open, and those are not here:
 * a link is the whole feature. A site is listed when arriving is not the same as asking, which
 * happens two ways: the box is filled and left unsent, or the link fills nothing at all and the box
 * is the only way in. Finishing means a script writing the prompt where it belongs and pressing the
 * button the reader would have pressed.
 *
 * That script needs the site, which is a permission, which is a question. So the table is the single
 * place that says which destinations raise one.
 */

export enum ComposeSiteId {
  claude = "claude",
  copilot = "copilot"
}

/**
 * How a whole prompt is written into a rich editor, which the two boxes disagree about.
 *
 * An insertion is the default and the gentler of the two. A paste is for an editor that drops the
 * line breaks out of one - Copilot's does, measured, so a prompt quoting a list of pages arrives as
 * a single run-on line - and it is not the default because a paste this size is what some sites turn
 * into an attachment instead of a question.
 */
export enum ComposerInsert {
  typed = "typed",
  pasted = "pasted"
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
  /** Only meaningful beside a `composerSelector`, and only where the insertion is not believed. */
  composerInsert?: ComposerInsert;
  /**
   * Whether the address does anything with a prompt handed to it. Claude's fills its box from one
   * and waits; Copilot's keeps the parameter and reads it to nobody - measured - so a link there is
   * a way in and nothing more. Spelled on every row rather than defaulted, because a link that
   * quietly carries nothing is the kind of thing a default hides.
   */
  isPromptCarriedByUrl: boolean;
  submitSelector: string;
};

/**
 * Claude's box is a ProseMirror document, so the anchor is the class prosemirror-view puts on its
 * own editable node - the one part of that box the product's own redesigns do not name. Settled from
 * the library rather than from a live page, so an empty box at the far end starts here.
 */
const CLAUDE_COMPOSER_SELECTOR = "div.ProseMirror[contenteditable=\"true\"]";

/**
 * Microsoft's own id for the editable node of the M365 chat editor, which is the one part of that
 * box neither a redesign nor a translation renames.
 */
const COPILOT_COMPOSER_SELECTOR = "#m365-chat-editor-target-element[contenteditable=\"true\"]";

/**
 * The send button carries no test id, and its `aria-label` is written in the reader's own language -
 * so the anchor is the one class in that pile of hashed ones that names what the button is.
 */
const COPILOT_SUBMIT_SELECTOR = "button.fai-SendButton";

export const COMPOSE_SITES: Record<ComposeSiteId, ComposeSite> = {
  [ComposeSiteId.claude]: {
    url: "https://claude.ai/new",
    composerSelector: CLAUDE_COMPOSER_SELECTOR,
    isPromptCarriedByUrl: true,
    submitSelector: "[data-testid=\"chat-input-send\"]"
  },
  /*
   * Opened at `/chat` rather than at the root, which redirects there: a tab can report itself
   * finished at the address before the bounce, and the script only ever goes in once.
   */
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

/**
 * Whether a prompt can arrive at a site by script rather than in its URL, which is the whole
 * question of how long a prompt may be. Asked of the table so nobody reads a selector as a hint.
 */
export function isComposerFillable(siteId: ComposeSiteId) {
  return COMPOSE_SITES[siteId].composerSelector !== undefined;
}

/** Where a reader lands with nothing carried, for the link a card draws when its URL carries none. */
export function composeSiteUrl(siteId: ComposeSiteId) {
  return COMPOSE_SITES[siteId].url;
}

/** Whether a link to this site is the question or only the door. */
export function isPromptCarriedToSite(siteId: ComposeSiteId) {
  return COMPOSE_SITES[siteId].isPromptCarriedByUrl;
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
