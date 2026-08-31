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

async function readThrough({ proxyUrl, timeoutMs }: {
  proxyUrl: string;
  timeoutMs: number;
}) {
  const response = await fetch(proxyUrl, { signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) {
    throw new Error(`${proxyUrl} answered ${response.status}`);
  }

  return response;
}

/** The first proxy to answer. Rejects only when every one of them has failed. */
async function raceProxies({ url, timeoutMs }: {
  url: string;
  timeoutMs: number;
}) {
  return Promise.any(
    PROXY_URLS.map(toProxyUrl => readThrough({
      proxyUrl: toProxyUrl(url),
      timeoutMs
    }))
  );
}

/** The body of the first proxy to answer, or an empty string when every one of them fails. */
export async function readProxied({ url, timeoutMs = PROXY_TIMEOUT_MS }: {
  url: string;
  timeoutMs?: number;
}) {
  return raceProxies({
    url,
    timeoutMs
  }).then(response => response.text()).catch(() => "");
}

/**
 * The bytes at a URL, for a background the user asked to keep: straight from the host when it sends
 * the header that allows it, and through the proxies when it does not. `null` when nobody answers.
 */
export async function fetchBlob({ url, timeoutMs = PROXY_TIMEOUT_MS }: {
  url: string;
  timeoutMs?: number;
}) {
  const direct = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) }).catch(() => null);
  if (direct?.ok) {
    return direct.blob();
  }

  return raceProxies({
    url,
    timeoutMs
  }).then(response => response.blob()).catch(() => null);
}
