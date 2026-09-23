/**
 * The extension's own pages in the dev Firefox, put back after a rebuild takes them.
 *
 * A temporary add-on is rooted at the output directory, and `wxt build` empties that directory
 * before it writes the new one. Firefox answers by taking the add-on's pages away - and it takes
 * the *tab*, not just the document, which costs more than a page: a window whose last tab has just
 * been closed closes with it, and the browser ends. Measured twice. A dev Firefox showing nothing
 * but the new tab exited on the first change that reached the background, taking its own remote
 * protocol with it and leaving the rebuild waiting on a browser that was no longer there. With a
 * second tab open beside it the window lived, and the extension's tab was simply gone.
 *
 * So the pages are parked on `about:blank` before the build and pointed back afterwards. A parked
 * tab is nothing to do with the add-on by the time the build pulls it apart, so nothing closes it,
 * and it is there to be filled again a second later. A tab that went anyway - one opened after the
 * parking - gets its page back in a new tab instead, which is worth a tab out of position.
 *
 * Over BiDi because that is the only remote protocol Firefox 156 still has, and `web-ext` will not
 * lend its own RDP socket. Navigating to a `moz-extension://` url needs
 * `--remote-allow-system-access`, which `browser.mjs` already launches with and documents.
 *
 * Nothing here may ever fail to answer, which is not a wish but a rule with a deadline behind it:
 * this runs inside the rebuild loop, and a reply that never comes would hold `isBuilding` true and
 * leave every later save dropped in silence - the exact failure `scripts/dev.mjs` was found in. So
 * every request is raced against a timeout, a dead socket settles whatever it was still owed, and a
 * page that cannot be put back costs a line of output and nothing else.
 *
 * Firefox allows one BiDi session at a time, so the session here is opened late, kept for as few
 * calls as possible, and always ended. A driver attached from outside - the scratchpad's `bidi.mjs`,
 * say - will be refused for the moment a rebuild spans, and this is the reason.
 */

const EXTENSION_SCHEME = "moz-extension://";

/** Where a tab waits out a build: a page the add-on has no claim on, so nothing closes it. */
const PARKED_URL = "about:blank";

const NAVIGATE_ATTEMPTS = 3;
const RETRY_MS = 400;

/** Long enough for a browser mid-reload, short enough that the loop never waits on a lost reply. */
const REQUEST_TIMEOUT_MS = 5000;
const CONNECT_TIMEOUT_MS = 3000;

function wait(delayMs) {
  return new Promise(resolve => setTimeout(resolve, delayMs));
}

function connect(port) {
  const socket = new WebSocket(`ws://127.0.0.1:${port}/session`);

  return new Promise(resolve => {
    const giveUp = setTimeout(() => resolve(null), CONNECT_TIMEOUT_MS);
    socket.addEventListener("open", () => {
      clearTimeout(giveUp);
      resolve(socket);
    }, { once: true });
    socket.addEventListener("error", () => {
      clearTimeout(giveUp);
      resolve(null);
    }, { once: true });
  });
}

/**
 * One BiDi session, for the length of one call, and never for longer than its deadlines allow.
 *
 * An answer of `null` means the browser could not be reached or would not start a session - which
 * is what a second driver already holding one looks like - and every caller treats that as nothing
 * to do rather than as something to report.
 */
async function withSession({ port, use }) {
  const socket = await connect(port);
  if (!socket) {
    return null;
  }

  let nextId = 0;
  const pending = new Map();

  function settle(id, answer) {
    pending.get(id)?.(answer);
    pending.delete(id);
  }

  socket.addEventListener("message", e => {
    const message = JSON.parse(e.data);
    settle(message.id, message);
  });
  socket.addEventListener("close", () => {
    for (const id of pending.keys()) {
      settle(id, { error: "the socket closed" });
    }
  });

  function send(method, params) {
    const id = ++nextId;

    return new Promise(resolve => {
      const giveUp = setTimeout(() => settle(id, { error: "timed out" }), REQUEST_TIMEOUT_MS);
      pending.set(id, answer => {
        clearTimeout(giveUp);
        resolve(answer);
      });
      socket.send(
        JSON.stringify({
          id,
          method,
          params
        })
      );
    });
  }

  const started = await send("session.new", {
    capabilities: {}
  });
  if (started.error) {
    socket.close();

    return null;
  }

  const answer = await use(send).catch(() => null);
  await send("session.end", {});
  socket.close();

  return answer;
}

function extensionContexts(tree) {
  return (tree.result?.contexts ?? [])
    .filter(context => (context.url ?? "").startsWith(EXTENSION_SCHEME))
    .map(context => ({
      context: context.context,
      url: context.url
    }));
}

/**
 * Which tabs are showing one of this extension's pages, moved off them and remembered.
 *
 * Moved off, and that is the whole reason this runs before the build rather than after. Firefox does
 * not blank an extension page when the add-on goes - it closes the tab, and a window whose last tab
 * has just been closed closes too, which ends the browser. Measured twice: a dev Firefox showing
 * nothing but the new tab exited on the first background change, taking its remote protocol with it;
 * with a second tab open beside it the window lived and the extension's tab was simply gone.
 *
 * Parked on `about:blank` first, a tab is nothing to do with the add-on by the time the build pulls
 * it apart, so Firefox has no reason to close it - and it is pointed back afterwards.
 */
export function parkExtensionPages(port) {
  return withSession({
    port,
    async use(send) {
      const tree = await send("browsingContext.getTree", {});
      const pages = extensionContexts(tree);

      for (const page of pages) {
        await send("browsingContext.navigate", {
          context: page.context,
          url: PARKED_URL,
          wait: "complete"
        });
      }

      return pages;
    }
  });
}

/**
 * The pages that were open before the build, open again. Answers how many had to be put back.
 *
 * Counted by address rather than by tab. A context id is not a handle worth trusting across a
 * rebuild - some survive the parking and some are closed out from under it - and chasing them one
 * at a time grew the window a tab on every save before this was written by address instead. So the
 * rule is stated as an outcome: every address that was open is open once when this returns, in a
 * tab that was already there wherever there is one to reuse.
 *
 * Navigations are sent rather than waited on. `wait: "complete"` would hold this open for as long as
 * the page takes to load, and the page finishing is the page's business; what matters here is that
 * no tab is left sitting on `about:blank`.
 */
export async function restoreExtensionPages({ port, pages }) {
  if (!pages?.length) {
    return 0;
  }

  const wanted = [...new Set(pages.map(page => page.url))];

  const restored = await withSession({
    port,
    async use(send) {
      const tree = await send("browsingContext.getTree", {});
      const contexts = tree.result?.contexts ?? [];
      const shown = new Set(contexts.map(context => context.url));
      /* The tabs this rebuild emptied, which is where a page goes before a new tab is opened. */
      const spare = contexts.filter(context => context.url === PARKED_URL).map(context => context.context);
      let sent = 0;

      for (const url of wanted) {
        const isAlreadyShown = shown.has(url);
        if (isAlreadyShown) {
          continue;
        }

        const isSent = await sendTo({
          send,
          url,
          context: spare.shift()
        });
        if (isSent) {
          sent += 1;
        }
      }

      return sent;
    }
  });

  return restored ?? 0;
}

/**
 * One address into one tab: the one handed over, or a new one where there was none to spare.
 *
 * Created and then navigated, in two calls, because `browsingContext.create` takes no address and
 * handing it one is accepted in silence - measured, an empty tab appeared beside a page that never
 * came back, and the call reported success.
 */
async function sendTo({ send, url, context }) {
  const target = context ?? (await send("browsingContext.create", { type: "tab" })).result?.context;
  if (!target) {
    return false;
  }

  for (let attempt = 1; attempt <= NAVIGATE_ATTEMPTS; attempt++) {
    const answer = await send("browsingContext.navigate", {
      context: target,
      url,
      wait: "none"
    });
    if (!answer.error) {
      return true;
    }

    await wait(RETRY_MS);
  }

  return false;
}
