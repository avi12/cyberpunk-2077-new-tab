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
   * The box to fill, for a site that cannot be handed the prompt any other way. A site whose URL
   * already carries the prompt leaves this out, and its script only presses send - which is also
   * how the script knows which of the two it is doing.
   */
  composerSelector?: string;
  submitSelector: string;
};

export const COMPOSE_SITES: Record<ComposeSiteId, ComposeSite> = {
  [ComposeSiteId.copilot]: {
    url: "https://copilot.microsoft.com/",
    composerSelector: "[data-testid=\"composer-input\"]",
    submitSelector: "[data-testid=\"submit-button\"]"
  },
  [ComposeSiteId.claude]: {
    url: "https://claude.ai/new",
    submitSelector: "[data-testid=\"chat-input-send\"]"
  }
};

function composeOrigin(siteId: ComposeSiteId): string {
  return `${new URL(COMPOSE_SITES[siteId].url).origin}/*`;
}

/**
 * Asked for on its own and only when it is about to be used, so nobody hands over a site for a
 * destination they never pick. Refusing costs only the sending: the prompt still gets there.
 */
export async function requestComposeAccess(siteId: ComposeSiteId): Promise<boolean> {
  return requestAccess({ origins: [composeOrigin(siteId)] });
}

export async function hasComposeAccess(siteId: ComposeSiteId): Promise<boolean> {
  return hasAccess({ origins: [composeOrigin(siteId)] });
}

/** Whether a tab has arrived at a site, by origin, so a redirect within it still counts as there. */
export function isAtComposeSite({ url, siteId }: {
  url: string;
  siteId: ComposeSiteId;
}): boolean {
  try {
    return new URL(url).origin === new URL(COMPOSE_SITES[siteId].url).origin;
  } catch {
    return false;
  }
}
