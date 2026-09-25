/**
 * The new tab, told what changed, on the one browser that has no dev server to tell it.
 *
 * Two messages travel this way. `reload`, for a change the page cannot absorb, and `swap`, naming a
 * single module the hot graph can replace under the running app - `scripts/dev-hmr.mjs` is what sits
 * on the other end of that one. A swap the page cannot apply answers `false` and becomes a reload,
 * so the loop never has to be certain.
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

import { HOT_CLIENT_PATH, HOT_REGISTRY } from "./dev-hmr.mjs";
import { readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";

/** Next to `CDP_PORT` and `FIREFOX_BIDI_PORT`, and read only by this file and the client it writes. */
const RELOAD_PORT = 9225;

const RELOAD_EVENT = "reload";
const SWAP_EVENT = "swap";
const CLIENT_FILE = "dev-reload.js";
const PAGE_FILE = "newtab.html";
const HEAD_CLOSE = "</head>";
const CLIENT_TAG = `<script src="/${CLIENT_FILE}"></script>`;

/**
 * The page's own entry, which is the one module script the document carries. Its address is what a
 * hot graph rewrites, rather than a tag it adds, so there is never a moment with two entries
 * mounting into the same `#app`.
 */
const PAGE_ENTRY = /(<script type="module"[^>]*\ssrc=")[^"]+(")/;

/**
 * An external file, not an inline tag: `script-src 'self'` is exactly what an extension page is left
 * with, and it forbids inline. Byte-identical on every plant, since the port is a constant, so the
 * add-on never sees a file it did not have at install.
 */
const CLIENT_SOURCE = `/* Written by scripts/dev-reload.mjs into the build output. Never in src/, so it cannot ship. */
const channel = new EventSource("http://127.0.0.1:${RELOAD_PORT}");

channel.addEventListener("${RELOAD_EVENT}", () => location.reload());

/*
 * Optional chaining carries the whole call, so a page with no hot graph in it falls straight through
 * to the reload - as does a module the compiler never made a boundary of, and one whose swap threw.
 */
channel.addEventListener("${SWAP_EVENT}", async e => {
  const isSwapped = await globalThis.${HOT_REGISTRY}?.applyChange(e.data).catch(() => false);
  if (!isSwapped) {
    location.reload();
  }
});
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
 * The built page, pointed at the hot graph instead of at its own bundle, and whether it could be.
 *
 * The graph's client is a drop-in for the entry it replaces: it puts the hot registry up and then
 * imports that same entry, so the page boots exactly as it would have and every component in it
 * arrives swappable. Re-planting is a no-op, which is what lets the loop call this after every build
 * without having to ask first.
 */
export function plantHotEntry({ outputDir }) {
  const pagePath = join(outputDir, PAGE_FILE);
  const page = readFileSync(pagePath, "utf8");
  if (!PAGE_ENTRY.test(page)) {
    return false;
  }

  writeFileSync(pagePath, page.replace(PAGE_ENTRY, `$1/${HOT_CLIENT_PATH}$2`));

  return true;
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

  /** How many pages heard it, so the loop can say "nothing open" rather than claim a swap. */
  function tell({ event, data }) {
    for (const page of pages) {
      page.write(`event: ${event}\ndata: ${data}\n\n`);
    }

    return pages.size;
  }

  return {
    broadcast: () => tell({
      event: RELOAD_EVENT,
      data: Date.now()
    }),
    swap: moduleId => tell({
      event: SWAP_EVENT,
      data: moduleId
    }),
    close() {
      for (const page of pages) {
        page.end();
      }

      server.close();
    }
  };
}
