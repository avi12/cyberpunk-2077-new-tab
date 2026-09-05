import { ComposeSiteId, hasComposeAccess, requestComposeAccess } from "./sites";
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
}

export const composeAccess = new ComposeAccess();
