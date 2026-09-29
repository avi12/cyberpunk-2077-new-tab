import type { Browser } from "wxt/browser";

/**
 * Asking for the permissions this extension does not install with.
 *
 * Almost nothing here is granted up front: the reader is asked at the moment a feature is about to
 * use something, so an install prompt never lists a capability for a feature they may never touch.
 *
 * Both answers are booleans, including the ones the browser gives by throwing. A browser that was
 * never offered the permission - the Firefox build declares nothing optional at all, since every one
 * of them follows a companion or a script it has no way to run - refuses the question rather than
 * the permission, and to a caller those are the same no.
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

/**
 * Everything one press needs, in the one dialog it is worth.
 *
 * A click buys a single question. The activation it carries runs out while the reader is reading the
 * dialog it raised - measured in this extension's own page: six seconds after a click,
 * `permissions.request` is refused with "must be called during a user gesture" before anything is
 * drawn. A press that asks twice therefore has its second question answered no by nobody, and the
 * feature behind it quietly does not happen.
 *
 * Nothing is returned, because a merged answer is not one anybody can act on: each half is read back
 * on its own afterwards, and a reader may already have held one of them.
 */
export async function requestAccessTogether(requests: (AccessRequest | null)[]) {
  const asked = requests.filter(request => request !== null);
  if (asked.length === 0) {
    return;
  }

  await requestAccess({
    permissions: asked.flatMap(request => request.permissions ?? []),
    origins: asked.flatMap(request => request.origins ?? [])
  });
}
