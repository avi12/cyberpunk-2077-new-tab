import { readProxied } from "@/features/widgets/cors-proxy";

const SCHEME_PATTERN = /^[a-z][a-z\d+.-]*:/i;
const WWW_PATTERN = /^www\./;
const TITLE_TIMEOUT_MS = 5000;
const MAX_TITLE_LENGTH = 60;

// "<name> <separator> <tagline>". The colon needs its trailing space, so a bare "10:30" never splits
const TITLE_TAGLINE_PATTERN = /\s+[|·—–-]\s+|:\s+/;

// So `bbc.co.uk` reads as "Bbc" and not as "Co"
const PUBLIC_SECOND_LEVEL_LABELS = new Set(["ac", "co", "com", "edu", "gov", "net", "org"]);

export function normalizeUrl(url: string) {
  const trimmed = url.trim();

  return SCHEME_PATTERN.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function hostOf(url: string) {
  if (!URL.canParse(url)) {
    return "";
  }

  return new URL(url).hostname.replace(WWW_PATTERN, "");
}

// `news.ycombinator.com` reads as `ycombinator`
export function hostLabel(url: string) {
  const labels = hostOf(url).split(".").filter(Boolean);
  if (labels.length > 1) {
    labels.pop();
  }

  const isPublicSuffix = labels.length > 1 && PUBLIC_SECOND_LEVEL_LABELS.has(labels.at(-1) ?? "");
  if (isPublicSuffix) {
    labels.pop();
  }

  return labels.at(-1) ?? "";
}

function nameFromUrl(url: string) {
  const label = hostLabel(url);
  if (!label) {
    return url;
  }

  return label.charAt(0).toUpperCase() + label.slice(1);
}

// Safe on untrusted HTML: a `DOMParser` document runs no script and loads no subresource
function titleOf(html: string) {
  const { title } = new DOMParser().parseFromString(html, "text/html");
  const [name] = title.trim().split(TITLE_TAGLINE_PATTERN);

  return (name || title).trim().slice(0, MAX_TITLE_LENGTH);
}

async function fetchPageTitle(url: string) {
  const html = await readProxied({
    url,
    timeoutMs: TITLE_TIMEOUT_MS
  });

  return titleOf(html);
}

export async function resolveTitle(url: string) {
  const pageTitle = await fetchPageTitle(url).catch(() => "");

  return pageTitle || nameFromUrl(url);
}
