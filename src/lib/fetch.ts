import type { z } from "./zod";

/**
 * Every request this extension makes, and the one place a response is allowed to become a value.
 *
 * Nothing here throws. A network that is not there, a host that answers 500, a body that is not what
 * it claimed, a shape that has quietly changed under us - a caller gets null for all of them, which
 * is the answer every one of these features already wanted. Feature code decides what to show
 * instead; it never decides what a response is.
 *
 * The schema is not optional decoration. Everything on the other end of these calls belongs to
 * somebody else - Google's search page, open-meteo, Microsoft's catalogue, a stranger's RSS - and a
 * response that stops matching has to fail here, where it is one null, rather than three files later
 * as a property that turned out to be undefined.
 */

/** Every request is bounded: a page that hangs is worse to a reader than one that says it failed. */
const DEFAULT_TIMEOUT_MS = 8000;

type Request = {
  url: string | URL;
  init?: RequestInit;
  timeoutMs?: number;
};

/**
 * The response, or null. `AbortSignal.timeout` is built here rather than by callers so that no
 * request can be written without one, and an `init` that brings its own signal keeps it.
 */
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

/**
 * A parsed body, typed by the schema it satisfied, or null. The schema is the type: a caller
 * destructures what came back rather than checking whether each field survived the trip.
 */
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

/** Bytes, for the bodies that are not text at all - a background image fetched through a proxy. */
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

/** What the server called it, since a PDF decoded as text parses into a document all the same. */
const HTML_CONTENT_TYPE = "text/html";

/**
 * Markup as a document. Nothing is executed and nothing is attached - `DOMParser` builds an inert
 * tree - so a stranger's page can be read for the two or three things wanted from it without any of
 * it ever becoming part of this one.
 *
 * The content type is checked here rather than guessed at afterwards. `DOMParser` reports every
 * document it builds as HTML whatever went in, so a caller handed the document has no way left to
 * tell that it was really a PDF - this is the last point where the answer still exists.
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
