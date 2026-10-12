/**
 * `wxt build` empties the directory a temporary add-on is rooted at, and Firefox then closes the
 * add-on's tabs - and a window losing its last tab closes the browser. So the pages are parked on
 * `about:blank` before a build and pointed back afterwards, over WebDriver BiDi.
 *
 * Every request is raced against a timeout, because a reply that never comes would leave the
 * rebuild loop stuck. Firefox allows one BiDi session at a time, so each one is short and always
 * ended - an outside driver is refused while a rebuild holds it.
 */

const EXTENSION_SCHEME = "moz-extension://";

const PARKED_URL = "about:blank";

const NAVIGATE_ATTEMPTS = 3;
const RETRY_MS = 400;

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

/** `null` when the browser is unreachable or another driver holds the one session. */
async function withSession({ port, use }) {
  const socket = await connect(port);
  if (!socket) {
    return null;
  }

  let nextId = 0;
  const pendingReplies = new Map();

  function settle(id, answer) {
    pendingReplies.get(id)?.(answer);
    pendingReplies.delete(id);
  }

  socket.addEventListener("message", e => {
    const message = JSON.parse(e.data);
    settle(message.id, message);
  });
  socket.addEventListener("close", () => {
    for (const id of pendingReplies.keys()) {
      settle(id, { error: "the socket closed" });
    }
  });

  function send(method, params) {
    const id = ++nextId;

    return new Promise(resolve => {
      const giveUp = setTimeout(() => settle(id, { error: "timed out" }), REQUEST_TIMEOUT_MS);
      pendingReplies.set(id, answer => {
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
 * Restored by address rather than by context id, since ids do not reliably survive a rebuild and
 * chasing them opened a new tab on every save. Navigations are not awaited to `complete`.
 */
export async function restoreExtensionPages({ port, pages }) {
  if (!pages?.length) {
    return 0;
  }

  const urlsToRestore = [...new Set(pages.map(page => page.url))];

  const restoredCount = await withSession({
    port,
    async use(send) {
      const tree = await send("browsingContext.getTree", {});
      const contexts = tree.result?.contexts ?? [];
      const shownUrls = new Set(contexts.map(context => context.url));
      const parkedContexts = contexts.filter(context => context.url === PARKED_URL).map(context => context.context);
      let navigatedCount = 0;

      for (const url of urlsToRestore) {
        const isAlreadyShown = shownUrls.has(url);
        if (isAlreadyShown) {
          continue;
        }

        const isSent = await navigateTab({
          send,
          url,
          context: parkedContexts.shift()
        });
        if (isSent) {
          navigatedCount += 1;
        }
      }

      return navigatedCount;
    }
  });

  return restoredCount ?? 0;
}

/** Created then navigated, because `browsingContext.create` silently ignores an address. */
async function navigateTab({ send, url, context }) {
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
