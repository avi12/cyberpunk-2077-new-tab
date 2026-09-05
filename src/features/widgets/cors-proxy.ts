import { fetchBytes, fetchText } from "@/lib/fetch";

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
