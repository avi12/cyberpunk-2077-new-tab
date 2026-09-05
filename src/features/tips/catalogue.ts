import { fetchJson } from "@/lib/fetch";
import { hasAccess, requestAccess } from "@/lib/permissions";
import { z } from "@/lib/zod";

/**
 * Edge's tip catalogue, read from where Edge reads it.
 *
 * The companion app has been handing over `CopilotTipsCache.json`, which is Edge's own copy of one
 * HTTP response. `msedge.dll` names that endpoint in a single string, and it turns out to be a plain
 * public GET: no account, no Edge headers, no signature - measured, a bare `Mozilla/5.0` gets the
 * same 130 tips. So the page can ask for the catalogue itself rather than for Edge's copy of it,
 * which is both fresher and true on a machine that has never run Edge.
 *
 * It answers with no CORS headers at all, so the origin is not a nicety - measured, the fetch fails
 * outright without it and succeeds with it. Optional, because a reader who has the companion app
 * already has the tips and should not be asked for anything.
 *
 * The `language` parameter is sent and ignored: every locale tried came back `"language":"en"` with
 * the same English entries, which is why the wording is safe to match on elsewhere.
 */

const TIPS_URL = "https://edge.microsoft.com/edgecontextualchat/api/v1/copilottips/get-copilot-tips";

const TIPS_LANGUAGE = "en";

const TIPS_ACCESS = { origins: [`${new URL(TIPS_URL).origin}/*`] };

/** The envelope only: what a tip is stays `tips/model.ts`, which validates each one on the way out. */
const catalogueSchema = z.object({
  tips: z.array(z.unknown())
});

export async function hasTipsAccess() {
  return hasAccess(TIPS_ACCESS);
}

/** Only ever called straight out of a click: a permission prompt needs the gesture that asked for it. */
export async function requestTipsAccess() {
  return requestAccess(TIPS_ACCESS);
}

/**
 * The catalogue, or null for every way this can come to nothing - not allowed, offline, a shape that
 * is not what it was. Null is never a failure the reader sees: the companion is asked next, and the
 * row it fills is the one they had before.
 *
 * An empty answer counts as nothing. The endpoint has been seen to return zero tips, and keeping
 * that would blank the row for as long as the snapshot lasts.
 */
export async function fetchTipCatalogue() {
  if (!await hasTipsAccess()) {
    return null;
  }

  const url = new URL(TIPS_URL);
  url.searchParams.set("language", TIPS_LANGUAGE);

  const catalogue = await fetchJson({
    url,
    schema: catalogueSchema
  });
  if (!catalogue || catalogue.tips.length === 0) {
    return null;
  }

  return catalogue.tips;
}
