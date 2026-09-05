import { fetchBytes, fetchText } from "@/lib/fetch";
import { openableUrlSchema } from "@/lib/url";

/**
 * Neither an arbitrary RSS feed nor an arbitrary web page sends `Access-Control-Allow-Origin`, and
 * the extension ships no host permissions, so both read through a public CORS proxy. These are free
 * services with no uptime to speak of - one of them being unreachable is the ordinary case, not the
 * exception - so a read races all of them and takes whichever answers first.
 */

const PROXY_TIMEOUT_MS = 8000;

const PROXY_URLS = [
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url: string) => `https://cors.redoc.ly/${url}`,
  (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`
];

/**
 * A proxy carries the address inside its own URL - `cors.redoc.ly` takes it as the whole path - so
 * what goes out is held to the one shape everything openable is held to. Anything else is a string
 * pasted into somebody else's URL rather than an address a reader meant this page to fetch.
 */
function isProxyableUrl(url: string) {
  return openableUrlSchema.safeParse(url).success;
}

/**
 * The body of the first proxy to answer. `Promise.any` moves past a proxy only for a rejection, so
 * the null a failed read answers with becomes that rejection; it rejects once every one has failed.
 */
async function raceProxies<TBody>({ url, readBody }: {
  url: string;
  readBody: (proxyUrl: string) => Promise<TBody | null>;
}) {
  return Promise.any(
    PROXY_URLS.map(async toProxyUrl => {
      const proxyUrl = toProxyUrl(url);
      const body = await readBody(proxyUrl);
      if (body === null) {
        throw new Error(`${proxyUrl} did not answer`);
      }

      return body;
    })
  );
}

/** The body of the first proxy to answer, or an empty string when every one of them fails. */
export async function readProxied({ url, timeoutMs = PROXY_TIMEOUT_MS }: {
  url: string;
  timeoutMs?: number;
}) {
  if (!isProxyableUrl(url)) {
    return "";
  }

  return raceProxies({
    url,
    readBody: proxyUrl => fetchText({
      url: proxyUrl,
      timeoutMs
    })
  }).catch(() => "");
}

/**
 * The bytes at a URL, for a background the user asked to keep: straight from the host when it sends
 * the header that allows it, and through the proxies when it does not. `null` when nobody answers.
 */
export async function fetchBlob({ url, timeoutMs = PROXY_TIMEOUT_MS }: {
  url: string;
  timeoutMs?: number;
}) {
  if (!isProxyableUrl(url)) {
    return null;
  }

  const direct = await fetchBytes({
    url,
    timeoutMs
  });
  if (direct) {
    return direct;
  }

  return raceProxies({
    url,
    readBody: proxyUrl => fetchBytes({
      url: proxyUrl,
      timeoutMs
    })
  }).catch(() => null);
}
