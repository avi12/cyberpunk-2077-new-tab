/**
 * The new tab, told to reload itself, on the one browser that has no dev server to tell it.
 *
 * Firefox's rebuild loop ends in `reloadAllExtensions()`, which takes the open new tab down to
 * `about:blank` - so every change cost a Ctrl+T. Most changes do not need the add-on reloaded at
 * all: a temporary add-on reads its files off the output directory, so a page that reloads after a
 * build is already running the new chunk. What was missing was a way to say "now".
 *
 * The signal travels outwards, from the page to this script, which is why it needs nothing from
 * BiDi, nothing from the remote protocol, and nothing awake in the background. An extension page's
 * content security policy refuses a remote *script* - the finding that killed the dev server, see
 * `scripts/dev.mjs` - but it restricts no connection, and a loopback address is trustworthy enough
 * that `upgrade-insecure-requests` leaves it alone. So the page opens an `EventSource` here and
 * waits.
 *
 * Server-sent events rather than a socket because `ws` is not a dependency and Node ships only the
 * client half of WebSocket: this needs nothing but `node:http`, and `EventSource` reconnects on its
 * own, which is the only retry logic the page needs.
 *
 * Nothing here is in `src/`. The client is written into the build output after each build and dies
 * with it - `wxt build` empties that directory - so no production build can carry it.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";

/** Next to `CDP_PORT` and `FIREFOX_BIDI_PORT`, and read only by this file and the client it writes. */
const RELOAD_PORT = 9225;

const RELOAD_EVENT = "reload";
const CLIENT_FILE = "dev-reload.js";
const PAGE_FILE = "newtab.html";
const HEAD_CLOSE = "</head>";
const CLIENT_TAG = `<script src="/${CLIENT_FILE}"></script>`;

/**
 * An external file, not an inline tag: `script-src 'self'` is exactly what an extension page is left
 * with, and it forbids inline. Byte-identical on every plant, since the port is a constant, so the
 * add-on never sees a file it did not have at install.
 */
const CLIENT_SOURCE = `/* Written by scripts/dev-reload.mjs into the build output. Never in src/, so it cannot ship. */
new EventSource("http://127.0.0.1:${RELOAD_PORT}")
  .addEventListener("${RELOAD_EVENT}", () => location.reload());
`;

/** The client, and the one line of HTML that runs it, put back after a build wiped both. */
export function plantReloadClient({ outputDir }) {
  writeFileSync(join(outputDir, CLIENT_FILE), CLIENT_SOURCE);

  const pagePath = join(outputDir, PAGE_FILE);
  const page = readFileSync(pagePath, "utf8");
  if (page.includes(CLIENT_TAG)) {
    return;
  }

  writeFileSync(pagePath, page.replace(HEAD_CLOSE, `  ${CLIENT_TAG}\n  ${HEAD_CLOSE}`));
}

/**
 * The channel, open for as long as the session is.
 *
 * A page that is gone closes its own request, so the set holds only live ones; a page that comes
 * back dials in again by itself. A port already taken is said out loud rather than thrown - the
 * rebuild loop is worth more than the reload, and the old message still tells you to press Ctrl+T.
 */
export function startReloadChannel() {
  const pages = new Set();

  const server = createServer((request, response) => {
    response.writeHead(200, {
      "access-control-allow-origin": "*",
      "cache-control": "no-store",
      "content-type": "text/event-stream"
    });

    pages.add(response);
    request.on("close", () => pages.delete(response));
  });

  server.on("error", error => console.info(`[dev] the reload channel could not listen on ${RELOAD_PORT}: ${error.message}`));
  server.listen(RELOAD_PORT, "127.0.0.1");

  return {
    broadcast() {
      for (const page of pages) {
        page.write(`event: ${RELOAD_EVENT}\ndata: ${Date.now()}\n\n`);
      }

      return pages.size;
    },
    close() {
      for (const page of pages) {
        page.end();
      }

      server.close();
    }
  };
}
