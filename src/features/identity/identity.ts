import { fetchJson, fetchText } from "@/lib/fetch";
import { z } from "@/lib/zod";
import { browser } from "#imports";

/*
 * No browser API exposes the profile's name (`identity.getProfileUserInfo` only gives an email), so
 * Google is asked via `launchWebAuthFlow`, which needs no `oauth2` key (unsupported on Edge).
 * Authorization code with PKCE, `state` and `nonce` per RFC 8252 / OAuth 2.1. The code is redeemed
 * over TLS, which is why the ID token's signature need not be verified. Nothing is stored.
 */

/** Public by design: an extension cannot hide either of these, and Google's token endpoint wants both. */
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const CLIENT_SECRET = import.meta.env.VITE_GOOGLE_CLIENT_SECRET;

export const isGoogleAccountConfigured = Boolean(CLIENT_ID) && Boolean(CLIENT_SECRET);

const AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";

/** `openid` mints an ID token; `profile` puts a name inside it */
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

type TokenExchange = {
  client_id: string;
  client_secret: string;
  code: string;
  code_verifier: string;
  redirect_uri: string;
  grant_type: "authorization_code";
};

type Revocation = {
  token: string;
};

function toFormPost(parameters: TokenExchange | Revocation) {
  return {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams(parameters)
  };
}

function toBase64Url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function createPkceVerifier() {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(PKCE_VERIFIER_BYTES)));
}

async function pkceChallengeFor(verifier: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));

  return toBase64Url(new Uint8Array(digest));
}

/** A name outside ASCII only survives a real UTF-8 decode of the base64url payload */
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

/** Nothing is kept, so the grant is handed back. Fire and forget */
function revokeAccessToken(accessToken: string) {
  void fetchText({
    url: REVOKE_URL,
    init: toFormPost({ token: accessToken })
  });
}

async function redeemAuthorizationCode({ code, codeVerifier, redirectUri }: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}) {
  const exchange: TokenExchange = {
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    code,
    code_verifier: codeVerifier,
    redirect_uri: redirectUri,
    grant_type: "authorization_code"
  };

  return fetchJson({
    url: TOKEN_URL,
    init: toFormPost(exchange),
    schema: tokenSchema
  });
}

/** Null for a closed window, a refused consent or a bad token */
export async function googleAccountName() {
  const codeVerifier = createPkceVerifier();
  const state = crypto.randomUUID();
  const nonce = crypto.randomUUID();
  const redirectUri = browser.identity.getRedirectURL();

  const url = `${AUTHORIZE_URL}?${new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES.join(" "),
    code_challenge: await pkceChallengeFor(codeVerifier),
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

  const redirectParameters = new URL(redirectUrl).searchParams;
  const code = redirectParameters.get("code");
  // `state` proves this answers the request just made, not one injected into it
  if (!code || redirectParameters.get("state") !== state) {
    return null;
  }

  const tokens = await redeemAuthorizationCode({
    code,
    codeVerifier,
    redirectUri
  });
  if (!tokens) {
    return null;
  }

  if (tokens.access_token) {
    revokeAccessToken(tokens.access_token);
  }

  const parsed = claimsFromIdToken(tokens.id_token);
  // `nonce` ties the token to this request, `aud` to this extension's client
  if (!parsed?.success || parsed.data.nonce !== nonce || parsed.data.aud !== CLIENT_ID) {
    return null;
  }

  return parsed.data.given_name ?? parsed.data.name ?? null;
}
