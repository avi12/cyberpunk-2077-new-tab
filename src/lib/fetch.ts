import type { z } from "./zod";

/**
 * Nothing here throws: a missing network, an error status, a bad body and a changed shape all come
 * back as null. Every response belongs to somebody else, so it is validated here rather than failing
 * three files later as a property that turned out to be undefined.
 */

const DEFAULT_TIMEOUT_MS = 8000;

type Request = {
  url: string | URL;
  init?: RequestInit;
  timeoutMs?: number;
};

/** An `init` that brings its own signal overrides the timeout. */
async function fetchOk({ url, init, timeoutMs = DEFAULT_TIMEOUT_MS }: Request) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    ...init
  }).catch(() => null);
  if (!response?.ok) {
    return null;
  }

  return response;
}

export async function fetchText({ url, init, timeoutMs }: Request) {
  const response = await fetchOk({
    url,
    init,
    timeoutMs
  });
  if (!response) {
    return null;
  }

  return response.text().catch(() => null);
}

export async function fetchJson<TSchema extends z.ZodType>({ url, init, timeoutMs, schema }: Request & {
  schema: TSchema;
}) {
  const response = await fetchOk({
    url,
    init,
    timeoutMs
  });
  if (!response) {
    return null;
  }

  const parsed = schema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) {
    return null;
  }

  return parsed.data;
}

export async function fetchBytes({ url, init, timeoutMs }: Request) {
  const response = await fetchOk({
    url,
    init,
    timeoutMs
  });
  if (!response) {
    return null;
  }

  return response.blob().catch(() => null);
}

const HTML_CONTENT_TYPE = "text/html";

/**
 * `DOMParser` builds an inert tree, so nothing in a stranger's page runs. The content type is checked
 * here because `DOMParser` labels whatever it parses as HTML, so a PDF is indistinguishable afterwards.
 */
export async function fetchDocument({ url, init, timeoutMs }: Request) {
  const response = await fetchOk({
    url,
    init,
    timeoutMs
  });
  if (!response?.headers.get("content-type")?.includes(HTML_CONTENT_TYPE)) {
    return null;
  }

  const markup = await response.text().catch(() => null);
  if (markup === null) {
    return null;
  }

  return new DOMParser().parseFromString(markup, HTML_CONTENT_TYPE);
}
