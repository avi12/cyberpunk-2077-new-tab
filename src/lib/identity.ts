import { z } from "./zod";
import { browser } from "#imports";

/**
 * The name of the person signed into the browser.
 *
 * Chrome hands out a display name only through OAuth - `identity` returns an email and a gaia id and
 * nothing else. `getAuthToken` mints a token for the profile's Google account and OpenID Connect's
 * userinfo endpoint answers with the account's given name. That needs an
 * OAuth client id in the manifest (see the README), so when the build has none - or the account
 * refuses consent - this falls back to the one thing the plain `identity` permission gives, the
 * email address, and reads a name out of its local part: "jane.doe@..." becomes "Jane Doe" and
 * "avi6106@..." becomes "Avi".
 */

const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

const NAME_SEPARATORS = /[._+-]+/;
const TRAILING_DIGITS = /\d+$/;

const userInfoSchema = z.object({
  given_name: z.string().optional(),
  name: z.string().optional()
});

async function nameFromAccount(): Promise<string | null> {
  if (!browser.identity?.getAuthToken) {
    return null;
  }

  try {
    const { token } = await browser.identity.getAuthToken({ interactive: true });
    if (!token) {
      return null;
    }

    const response = await fetch(USERINFO_URL, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    if (!response.ok) {
      return null;
    }

    const parsed = userInfoSchema.safeParse(await response.json());
    if (!parsed.success) {
      return null;
    }

    return parsed.data.given_name || parsed.data.name || null;
  } catch {
    return null;
  }
}

function capitalize(word: string): string {
  return word[0].toUpperCase() + word.slice(1);
}

/** "jane.doe" -> "Jane Doe", "avi6106" -> "Avi": the digits people add to claim a taken address. */
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

async function nameFromEmail(): Promise<string | null> {
  if (!browser.identity?.getProfileUserInfo) {
    return null;
  }

  const { email } = await browser.identity.getProfileUserInfo({ accountStatus: "ANY" });

  return nameFromLocalPart(email.split("@")[0]);
}

export async function browserAccountName(): Promise<string | null> {
  return await nameFromAccount() ?? await nameFromEmail();
}
