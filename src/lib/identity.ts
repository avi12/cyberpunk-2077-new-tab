import { browser } from "#imports";

/**
 * The name of the person signed into the browser.
 *
 * No browser API returns a name: `identity.getProfileUserInfo` answers with an email address and an
 * account id and nothing else, and the Chromium team has said there is no supported way to read the
 * profile name either. Chrome's OAuth route would give the account's real `given_name`, but it needs
 * an `oauth2` key in the manifest, which Edge does not support - so a name is read out of the
 * address instead: "jane.doe@..." becomes "Jane Doe", "avi6106@..." becomes "Avi".
 */

const NAME_SEPARATORS = /[._+-]+/;
const TRAILING_DIGITS = /\d+$/;

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/** Trailing digits are how people claim an address someone else already took, not part of a name. */
function nameFromLocalPart(localPart: string): string | null {
  const words = localPart
    .split(NAME_SEPARATORS)
    .map(part => part.replace(TRAILING_DIGITS, ""))
    .filter(Boolean);
  if (words.length === 0) {
    return localPart ? capitalize(localPart) : null;
  }

  return words.map(capitalize).join(" ");
}

export async function browserAccountName(): Promise<string | null> {
  if (!browser.identity?.getProfileUserInfo) {
    return null;
  }

  const { email } = await browser.identity.getProfileUserInfo({ accountStatus: "ANY" });

  const [localPart = ""] = email.split("@");

  return nameFromLocalPart(localPart);
}
