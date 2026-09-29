import { composeAccessRequest, ComposeSiteId, hasComposeAccess, requestComposeAccess } from "./sites";
import type { AccessRequest } from "@/lib/permissions";
import { requestAccessTogether } from "@/lib/permissions";
import { composeRefusalsItem } from "@/lib/storage/items";

/**
 * Whether a prompt can be finished off at a site, which decides what submitting does. Two things
 * have to be true: the reader allowed the site, and the browser did not refuse the script outright.
 *
 * The refusal is discovered rather than predicted: a browser or an enterprise policy can refuse
 * every extension a host however the permission was come by, and trying is the only way to find out.
 * No host is named here, so one that starts refusing - or stops - needs no code change.
 */
class ComposeAccess {
  /**
   * Undefined for a site until the browser has been asked about it. Acting on a `false` that only
   * means "not looked yet" would ask everyone who had already allowed the site all over again, so
   * anything that reads this waits for an actual answer.
   */
  granted = $state<Partial<Record<ComposeSiteId, boolean>>>({});

  refused = $state<ComposeSiteId[]>([]);

  /** The one answer to act on; asking its two halves separately is how they drift apart. */
  canCompose(siteId: ComposeSiteId) {
    return this.granted[siteId] === true && !this.refused.includes(siteId);
  }

  /**
   * Whether asking about a site could still change anything: not already handed over, and not one
   * the browser refuses to script however it is answered. Said here rather than at each press, so a
   * pick and a card's hand-off cannot disagree about when there is a question worth raising.
   */
  isWorthAsking(siteId: ComposeSiteId) {
    return this.granted[siteId] !== true && !this.refused.includes(siteId);
  }

  async refresh() {
    const siteIds = Object.values(ComposeSiteId);
    const [granted, refused] = await Promise.all([
      Promise.all(siteIds.map(siteId => hasComposeAccess(siteId))),
      composeRefusalsItem.getValue()
    ]);

    this.granted = Object.fromEntries(siteIds.map((siteId, i) => [siteId, granted[i]]));
    this.refused = refused;
  }

  /** Only ever called straight out of a click: a permission prompt needs the gesture that asked. */
  async allow(siteId: ComposeSiteId) {
    const isGranted = await requestComposeAccess(siteId);
    this.granted = {
      ...this.granted,
      [siteId]: isGranted
    };

    return isGranted;
  }

  /** What this site would have to be handed over as, or nothing where asking could change nothing. */
  accessWorthAsking(siteId: ComposeSiteId | null) {
    if (siteId === null || !this.isWorthAsking(siteId)) {
      return null;
    }

    return composeAccessRequest(siteId);
  }

  /**
   * Everything one press needs handed over, in the one dialog a press is worth.
   *
   * `also` is whatever else the same press has to ask for - the reader's own browsing, where the
   * prompt sends some of it ahead of the question - and it travels here rather than being asked for
   * on its own because a press only pays for one question. Asking twice leaves the second refused
   * before it is drawn, and a prompt that needed a script to arrive lands in an empty box instead.
   *
   * Read back rather than returned: the grants are what the rest of the hand-off goes on, and this
   * is the one place that knows they have just changed.
   */
  async allowAlongside({ siteId, also = null }: {
    siteId: ComposeSiteId | null;
    also?: AccessRequest | null;
  }) {
    await requestAccessTogether([this.accessWorthAsking(siteId), also]);
    await this.refresh();
  }
}

export const composeAccess = new ComposeAccess();
