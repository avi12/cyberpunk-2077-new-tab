import { browser } from "#imports";

/**
 * The account signed into the browser, as a name. Chrome's `identity` API answers with an email
 * address and no display name, so the local part is the closest thing to a name it can give.
 * Firefox exposes the namespace without the profile lookup, so the API itself is the guard.
 */

const NAME_SEPARATORS = /[._+-]+/;

function nameFromEmail(email: string): string | null {
  return email
    .split("@")[0]
    .split(NAME_SEPARATORS)
    .filter(Boolean)
    .map(part => part[0].toUpperCase() + part.slice(1))
    .join(" ") || null;
}

export async function browserAccountName(): Promise<string | null> {
  if (!browser.identity?.getProfileUserInfo) {
    return null;
  }

  const { email } = await browser.identity.getProfileUserInfo({ accountStatus: "ANY" });

  return nameFromEmail(email);
}
