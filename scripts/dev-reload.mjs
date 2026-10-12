/**
 * Firefox's extension CSP refuses a remote script but not a connection, so the page opens an
 * `EventSource` to this loopback server and is told to `reload` or `swap` one module. Server-sent
 * events because Node ships no WebSocket server, and `EventSource` reconnects by itself.
 *
 * The client is written into the build output, never `src/`, so no production build can carry it.
 */

import { HOT_CLIENT_PATH, HOT_REGISTRY } from "./dev-hmr.mjs";
import { readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";

const RELOAD_PORT = 9225;

const RELOAD_EVENT = "reload";
const SWAP_EVENT = "swap";
const CLIENT_FILE = "dev-reload.js";
const PAGE_FILE = "newtab.html";
const HEAD_CLOSE = "</head>";
const CLIENT_TAG = `<script src="/${CLIENT_FILE}"></script>`;

/** Rewritten in place rather than adding a tag, so two entries never mount into the same `#app`. */
const PAGE_ENTRY = /(<script type="module"[^>]*\ssrc=")[^"]+(")/;

/** An external file, because the extension page's `script-src 'self'` forbids inline scripts. */
const CLIENT_SOURCE = `/* Written by scripts/dev-reload.mjs into the build output. Never in src/, so it cannot ship. */
const channel = new EventSource("http://127.0.0.1:${RELOAD_PORT}");

channel.addEventListener("${RELOAD_EVENT}", () => location.reload());

channel.addEventListener("${SWAP_EVENT}", async e => {
  const isSwapped = await globalThis.${HOT_REGISTRY}?.applyChange(e.data).catch(() => false);
  if (!isSwapped) {
    location.reload();
  }
});
`;

export function plantReloadClient({ outputDir }) {
  writeFileSync(join(outputDir, CLIENT_FILE), CLIENT_SOURCE);

  const pagePath = join(outputDir, PAGE_FILE);
  const page = readFileSync(pagePath, "utf8");
  if (page.includes(CLIENT_TAG)) {
    return;
  }

  writeFileSync(pagePath, page.replace(HEAD_CLOSE, `  ${CLIENT_TAG}\n  ${HEAD_CLOSE}`));
}

export function plantHotEntry({ outputDir }) {
  const pagePath = join(outputDir, PAGE_FILE);
  const page = readFileSync(pagePath, "utf8");
  if (!PAGE_ENTRY.test(page)) {
    return false;
  }

  writeFileSync(pagePath, page.replace(PAGE_ENTRY, `$1/${HOT_CLIENT_PATH}$2`));

  return true;
}

/** A taken port is logged rather than thrown - the rebuild loop is worth more than the reload. */
export function startReloadChannel() {
  const openPageStreams = new Set();

  const server = createServer((request, response) => {
    response.writeHead(200, {
      "access-control-allow-origin": "*",
      "cache-control": "no-store",
      "content-type": "text/event-stream"
    });

    openPageStreams.add(response);
    request.on("close", () => openPageStreams.delete(response));
  });

  server.on("error", error => console.info(`[dev] the reload channel could not listen on ${RELOAD_PORT}: ${error.message}`));
  server.listen(RELOAD_PORT, "127.0.0.1");

  function notifyPages({ event, data }) {
    for (const pageStream of openPageStreams) {
      pageStream.write(`event: ${event}\ndata: ${data}\n\n`);
    }

    return openPageStreams.size;
  }

  return {
    broadcast: () => notifyPages({
      event: RELOAD_EVENT,
      data: Date.now()
    }),
    swap: moduleId => notifyPages({
      event: SWAP_EVENT,
      data: moduleId
    }),
    close() {
      for (const pageStream of openPageStreams) {
        pageStream.end();
      }

      server.close();
    }
  };
}
