/**
 * Neither an arbitrary RSS feed nor an arbitrary web page sends `Access-Control-Allow-Origin`, and
 * the extension ships no host permissions, so both read through the same public CORS proxy.
 */
const PROXY_URL = "https://api.allorigins.win/raw?url=";

export function proxied(url: string) {
  return `${PROXY_URL}${encodeURIComponent(url)}`;
}
