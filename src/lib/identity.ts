import { z } from "./zod";
import { browser } from "#imports";

/**
 * The name of the person signed into the browser.
 *
 * No browser API returns a name: `identity.getProfileUserInfo` answers with an email address and an
 * account id and nothing else, and the Chromium team has said there is no supported way to read the
 * profile name either. Reading a name out of the address only works when the address happens to
 * hold one - "jane.doe@..." does, "cyberwolf99@..." does not - so the name is asked for instead.
 *
 * `launchWebAuthFlow` is the OAuth door that needs no `oauth2` manifest key, the key Edge has never
 * supported, and every target browser implements it, Firefox included. On top of it runs the flow
 * RFC 8252 and OAuth 2.1 ask for: authorization code with PKCE, `state` against CSRF, `nonce`
 * against a replayed ID token. The code is redeemed at the token endpoint over TLS, which is what
 * lets the ID token be read without verifying its signature - a token arriving through a redirect
 * fragment would have to be.
 *
 * What is deliberately absent is storage. The grant buys one claim; the tokens are read once, never
 * written anywhere, and the access token is handed straight back to Google.
 */

/** Public by design: an extension cannot hide either of these, and Google's token endpoint wants both. */
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const CLIENT_SECRET = import.meta.env.VITE_GOOGLE_CLIENT_SECRET;

/** A build missing either has nothing to ask with, and the button that would ask says so. */
export const isGoogleAccountConfigured = Boolean(CLIENT_ID) && Boolean(CLIENT_SECRET);

const AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";

/** `openid` is what makes Google mint an ID token; `profile` is what puts a name inside it. */
const SCOPES = ["openid", "profile"];

const PKCE_VERIFIER_BYTES = 32;

const tokenSchema = z.object({
  id_token: z.string(),
  access_token: z.string().optional()
});

const claimsSchema = z.object({
  aud: z.string(),
  nonce: z.string(),
  given_name: z.string().optional(),
  name: z.string().optional()
});

function toBase64Url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function randomVerifier() {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(PKCE_VERIFIER_BYTES)));
}

async function toChallenge(verifier: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));

  return toBase64Url(new Uint8Array(digest));
}

/** A JWT payload is base64url, and a name outside ASCII only survives a real UTF-8 decode. */
function claimsFromIdToken(idToken: string) {
  const [, payload = ""] = idToken.split(".");
  const base64 = payload.replaceAll("-", "+").replaceAll("_", "/");

  try {
    const bytes = Uint8Array.from(atob(base64), character => character.charCodeAt(0));

    return claimsSchema.safeParse(JSON.parse(new TextDecoder().decode(bytes)));
  } catch {
    return null;
  }
}

/** Nothing here is kept, so the grant is handed back rather than left open on the account. */
function revoke(accessToken: string) {
  void fetch(REVOKE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({ token: accessToken })
  }).catch(() => undefined);
}

async function redeem({ code, codeVerifier, redirectUri }: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}) {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      code_verifier: codeVerifier,
      redirect_uri: redirectUri,
      grant_type: "authorization_code"
    })
  }).catch(() => null);
  if (!response?.ok) {
    return null;
  }

  const parsed = tokenSchema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) {
    return null;
  }

  return parsed.data;
}

/** Null covers every way this ends without a name: a closed window, a refused consent, a bad token. */
export async function googleAccountName(): Promise<string | null> {
  const codeVerifier = randomVerifier();
  const state = crypto.randomUUID();
  const nonce = crypto.randomUUID();
  const redirectUri = browser.identity.getRedirectURL();

  const url = `${AUTHORIZE_URL}?${new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES.join(" "),
    code_challenge: await toChallenge(codeVerifier),
    code_challenge_method: "S256",
    prompt: "select_account",
    state,
    nonce
  })}`;

  const redirectUrl = await browser.identity
    .launchWebAuthFlow({
      url,
      interactive: true
    })
    .catch(() => null);
  if (!redirectUrl) {
    return null;
  }

  const returned = new URL(redirectUrl).searchParams;
  const code = returned.get("code");
  // `state` is what makes this the answer to the request that was just made, not one injected into it.
  if (!code || returned.get("state") !== state) {
    return null;
  }

  const tokens = await redeem({
    code,
    codeVerifier,
    redirectUri
  });
  if (!tokens) {
    return null;
  }

  if (tokens.access_token) {
    revoke(tokens.access_token);
  }

  const claims = claimsFromIdToken(tokens.id_token);
  // `nonce` ties the token to this request, `aud` ties it to this extension's client.
  if (!claims?.success || claims.data.nonce !== nonce || claims.data.aud !== CLIENT_ID) {
    return null;
  }

  return claims.data.given_name ?? claims.data.name ?? null;
}
