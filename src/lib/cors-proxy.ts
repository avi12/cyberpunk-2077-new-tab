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

  return response.text();
}

/** The body of the first proxy to answer, or an empty string when every one of them fails. */
export async function readProxied({ url, timeoutMs = PROXY_TIMEOUT_MS }: {
  url: string;
  timeoutMs?: number;
}) {
  const reads = PROXY_URLS.map(toProxyUrl => readThrough({
    proxyUrl: toProxyUrl(url),
    timeoutMs
  }));

  return Promise.any(reads).catch(() => "");
}
