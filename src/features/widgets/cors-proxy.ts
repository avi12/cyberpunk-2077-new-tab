import { fetchBytes, fetchText } from "@/lib/fetch";
import { openableUrlSchema } from "@/lib/url";

// The extension ships no host permissions, so cross-origin reads go through free public CORS
// proxies. Any one of them being down is the ordinary case, so a read races them all.

const PROXY_TIMEOUT_MS = 8000;

const PROXY_URLS = [
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url: string) => `https://cors.redoc.ly/${url}`,
  (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`
];

/** The address is pasted into the proxy's own URL (`cors.redoc.ly` takes it as the whole path). */
function isProxyableUrl(url: string) {
  return openableUrlSchema.safeParse(url).success;
}

/** `Promise.any` only skips a rejection, so a failed read's null is turned into one. */
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
