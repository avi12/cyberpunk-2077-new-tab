import { composeAccessRequest, ComposeSiteId, hasComposeAccess, requestComposeAccess } from "./sites";
import type { AccessRequest } from "@/lib/permissions";
import { requestAccessTogether } from "@/lib/permissions";
import { composeRefusalsItem } from "@/lib/storage/items";

/**
 * A site needs both the reader's grant and the browser not refusing the script. Refusals are
 * discovered by trying, since a browser or enterprise policy can block a host regardless of grants.
 */
class ComposeAccess {
  /** Undefined until the browser has answered, so "not checked yet" is never mistaken for `false` */
  granted = $state<Partial<Record<ComposeSiteId, boolean>>>({});

  refused = $state<ComposeSiteId[]>([]);

  canCompose(siteId: ComposeSiteId) {
    return this.granted[siteId] === true && !this.refused.includes(siteId);
  }

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

  /** Only call straight from a click: a permission prompt needs the user gesture */
  async allow(siteId: ComposeSiteId) {
    const isGranted = await requestComposeAccess(siteId);
    this.granted = {
      ...this.granted,
      [siteId]: isGranted
    };

    return isGranted;
  }

  accessWorthAsking(siteId: ComposeSiteId | null) {
    if (siteId === null || !this.isWorthAsking(siteId)) {
      return null;
    }

    return composeAccessRequest(siteId);
  }

  /**
   * `also` joins the same dialog because one press only buys one: the gesture expires while the
   * first dialog is read, so a second request would be refused.
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
