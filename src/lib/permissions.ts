import type { Browser } from "wxt/browser";

/**
 * A throw reads as `false`: the Firefox build declares no optional permissions, so it refuses the
 * question rather than the permission, and to a caller those are the same no.
 */

export type AccessRequest = Browser.permissions.Permissions;

export async function hasAccess(request: AccessRequest) {
  return browser.permissions.contains(request).catch(() => false);
}

/** Only ever called straight out of a click: a permission prompt needs the gesture that asked for it. */
export async function requestAccess(request: AccessRequest) {
  return browser.permissions.request(request).catch(() => false);
}

/** The has/request pair for one site, so a source declares its origin once and nothing else. */
export function originAccess(origin: string) {
  const request: AccessRequest = {
    origins: [origin]
  };

  return {
    origin,
    has: () => hasAccess(request),
    /** Call straight from a click: a permission prompt needs the user gesture. */
    request: () => requestAccess(request)
  };
}

/**
 * One press buys one dialog: its activation runs out while the reader reads the first one (measured:
 * six seconds after a click, `permissions.request` is refused as outside a user gesture), so a second
 * request would be silently denied.
 *
 * Nothing is returned - a merged answer is not actionable, so each half is read back on its own.
 */
export async function requestAccessTogether(requests: (AccessRequest | null)[]) {
  const pendingRequests = requests.filter(request => request !== null);
  if (pendingRequests.length === 0) {
    return;
  }

  await requestAccess({
    permissions: pendingRequests.flatMap(request => request.permissions ?? []),
    origins: pendingRequests.flatMap(request => request.origins ?? [])
  });
}
