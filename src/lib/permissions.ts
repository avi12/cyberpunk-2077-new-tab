import type { Browser } from "wxt/browser";

/**
 * Asking for the permissions this extension does not install with.
 *
 * Almost nothing here is granted up front: the reader is asked at the moment a feature is about to
 * use something, so an install prompt never lists a capability for a feature they may never touch.
 *
 * Both answers are booleans, including the ones the browser gives by throwing. A browser that was
 * never offered the permission - Firefox is given no optional origins at all, since declaring them
 * there would drag a `strict_min_version` along - refuses the question rather than the permission,
 * and to a caller those are the same no.
 */

/** What a permission is asked for as, named here so a caller needs one import rather than two. */
export type AccessRequest = Browser.permissions.Permissions;

export async function hasAccess(request: AccessRequest) {
  return browser.permissions.contains(request).catch(() => false);
}

/** Only ever called straight out of a click: a permission prompt needs the gesture that asked for it. */
export async function requestAccess(request: AccessRequest) {
  return browser.permissions.request(request).catch(() => false);
}
