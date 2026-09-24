/**
 * One dev server, one browser window, for as long as the session lasts.
 *
 * `wxt` watches stdin for its `o + enter` shortcut and shuts down when that stream closes, so
 * running it detached (no TTY) kills the session on the first rebuild. This runs the same CLI with
 * an stdin pipe that is simply never closed.
 *
 * The browser is opened here rather than by `wxt`, which is the whole point: the CLI has to be
 * restarted for some edits, and when `wxt` owns the window a restart takes the window with it. A
 * browser opened here is opened once, and a restart is answered by telling the extension to read
 * itself off disk again. `webExt.disabled` in `wxt.config.ts` is switched by the env var set below,
 * so plain `pnpm ext:dev` still opens its own browser as it always did.
 *
 * Two edits are worth a restart. An `.env` one, because Vite inlines those values when the build
 * starts and a running server goes on serving the old ones - which reads as a key that did not take
 * rather than as a server that never re-read it. And a watcher crash: Vite watches the project root,
 * which holds `companion/`, and a locked artifact there - MSBuild holding an `obj/**` binary
 * mid-build, or the tray app holding its own exe - makes chokidar raise EBUSY, which Vite treats as
 * fatal. `wxt.config.ts` asks Vite to ignore the directory, which helps for a file that exists at
 * startup and not for one that appears during a build. A server lost that way takes its port with it
 * and leaves its process standing, so the port is polled rather than the process - `pollDevServer`.
 *
 * Firefox is the exception to all of that: it has no dev server at all, because an extension page
 * there refuses remote code and a dev server is remote code. Its loop is a build, a window that
 * stays, and an open new tab that reloads itself as soon as the rebuild lands - see
 * `isServedByDevServer` and `scripts/dev-reload.mjs`. Where a rebuild does reach the background or
 * the manifest, the add-on is reloaded and its pages are navigated back into the tabs they were in -
 * `scripts/firefox-pages.mjs`.
 *
 * Nothing here closes a browser. Every failure this script knows how to answer - a dead server, a
 * build that would not start, a save that landed mid-build, a promise nobody caught - is answered
 * without the window going anywhere.
 *
 * Refusing to start twice is not a nicety, and it is per browser. Two sessions for one browser race
 * for the dev server's port and build into the same `.output` directory: the manifest ends up naming
 * one server's port while the page it serves names the other's, and the extension loads nothing at
 * all. It has happened, with three at once. Two sessions for *different* browsers are fine and
 * useful - each gets its own lock, its own output directory and its own port - so one change can be
 * watched landing in Edge and Firefox at the same time.
 *
 * Usage: `pnpm ext:dev:hmr [-b edge|firefox]`
 */

import {
  buildOutputDirectory,
  CDP_PORT,
  devOutputDirectory,
  devServerPort,
  FIREFOX_BIDI_PORT,
  launchBrowser,
  PROJECT_ROOT,
  reloadExtension
} from "./browser.mjs";
import { plantReloadClient, startReloadChannel } from "./dev-reload.mjs";
import { parkExtensionPages, restoreExtensionPages } from "./firefox-pages.mjs";
import chokidar from "chokidar";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { createRequire } from "node:module";
import {
  basename,
  dirname,
  join,
  relative,
  resolve,
  sep
} from "node:path";
import process from "node:process";

// The package's `exports` map does not expose `bin/`, so the CLI is located relative to the entry.
const wxtEntry = createRequire(import.meta.url).resolve("wxt");
const wxtCli = resolve(dirname(wxtEntry), "../bin/wxt.mjs");

/** Read by `wxt.config.ts` to leave the browser alone, since this script is opening one. */
const OWNS_BROWSER = "WXT_DEV_OWNS_BROWSER";

/**
 * How often the tree is looked at, and how long a change waits for its neighbours.
 *
 * Polled rather than subscribed. `fs.watch` was what this used, and on Windows it stops delivering:
 * measured here, a session went an hour answering nothing - the process alive, the port listening,
 * every save ignored, and not a word said about it. A poll compares mtime and size, so it cannot go
 * deaf, and it has the second virtue `youtube-time-manager` found first: a *read* is not a change,
 * so a build bundling its own sources or an editor indexing the tree raises nothing.
 *
 * The settle is one poll interval, so a save that lands either side of a tick is still one build.
 */
const WATCH_POLL_MS = 500;
const SETTLE_MS = 500;

/**
 * How often a served browser's dev server is asked whether it is still there.
 *
 * Vite's own watcher raises EBUSY on Windows against a file the browser or a build is holding, and
 * that takes the server down while leaving the process that owns it running - so `child.on("exit")`
 * never fires and the loop believes it is healthy. Measured: an Edge session whose page answered
 * `ERR_CONNECTION_REFUSED` for every module while its `dev.mjs` sat there content. The port is the
 * only honest signal, so it is the one that is read.
 */
const SERVER_HEARTBEAT_MS = 5000;
const SERVER_MISSES_ALLOWED = 3;

/** Vite never loads the example, so editing the documentation is not a reason to restart. */
const IGNORED_ENV_FILE = ".env.example";

/** Where the manifest comes from, which is the other root file a build is the only reader of. */
const CONFIG_FILE = "wxt.config.ts";

/*
 * A hiccup in the background is not a reason to end a session the reader has a browser open on.
 * Node ends the process on an unhandled rejection, and the ones this loop can raise are all
 * transient - a socket to the browser that went while a reload was in flight, a poll that lost its
 * server mid-request. They are printed and survived instead.
 *
 * The EBUSY exception is Vite's own watcher losing a race with a file the browser or a build is
 * holding. The watch fails and the build does not, so saying so every time would only be noise -
 * the same finding `youtube-time-manager` writes down.
 */
process.on("unhandledRejection", reason => {
  const isWatcherRace = reason?.code === "EBUSY" && reason?.syscall === "watch";
  if (isWatcherRace) {
    return;
  }

  console.info("[dev] something failed in the background and was survived:");
  console.error(reason);
});

/**
 * How many times a crash is worth answering with a restart before the crash is the answer. A watcher
 * that lost a race comes back; a config that cannot start never will, and looping on it hides the
 * error that says so.
 */
const MAX_CRASH_RESTARTS = 5;

/** A crash later than this is a fresh problem rather than the same one going round. */
const CRASH_WINDOW_MS = 60_000;

/** How long an extension reload is given to answer before the loop stops waiting on it. */
const RELOAD_WAIT_MS = 15_000;

/** And how long the browser is given to close, for the same reason and with the same deadline. */
const BROWSER_EXIT_MS = 5000;

/** The dev server writes its build a moment after it starts, and the browser needs it to exist. */
const BUILD_WAIT_MS = 90_000;
const BUILD_POLL_MS = 200;

/**
 * The two files a reloading page cannot answer for: code that runs outside it, and the document the
 * browser read once at install. Everything else the new tab uses, it fetches when it loads.
 */
const EXTENSION_OWNED_FILES = ["background.js", "manifest.json"];

const args = process.argv.slice(2);
const iBrowserFlag = args.findIndex(arg => arg === "-b" || arg === "--browser");
const browser = iBrowserFlag === -1 ? "chrome" : args[iBrowserFlag + 1];

/**
 * Under `node_modules`, which is git-ignored and wiped by a reinstall - both true of this too.
 *
 * One lock per browser rather than one for the project: what has to be refused is a second session
 * for the *same* browser, since those two share `.output/<browser>-mv3-dev` and overwrite each
 * other's manifest. Different browsers write different directories and Vite hands the second server
 * the next free port, so Edge and Firefox can be up at once - which is the only way to watch one
 * change land in both.
 */
const LOCK_FILE = join(PROJECT_ROOT, "node_modules", ".cache", `wxt-dev-${browser}.lock`);

/** Watched in full for the browser with no server doing it, and named once so both readers agree. */
const SOURCE_DIRECTORY = join(PROJECT_ROOT, "src");

/**
 * Firefox is not served, it is rebuilt.
 *
 * An extension page in Firefox will not load a remote script, and the dev server is remote: the
 * manifest's `content_security_policy` naming it is thrown away on install - measured,
 * `runtime.getManifest().content_security_policy` is `null` - and the policy that applies instead is
 * `script-src 'self'; upgrade-insecure-requests`, which blocks the page's own module. The new tab
 * then paints an empty `<div id="app">` and says nothing in the console. Neither manifest version
 * behaves differently, and no base-policy pref moves it: remote code is what MV3 forbids, and a dev
 * server is remote code.
 *
 * So Firefox gets the other shape of the same loop - build, keep the window, rebuild and reload on
 * every change - which is what this script already knew how to do for a restart. A rebuild measures
 * about 1.5 seconds; the module-level state HMR would have kept is the price, and there is no way to
 * pay less on that engine.
 */
const isServedByDevServer = browser !== "firefox";

/** Named here unless the caller named one, since `wxt` would otherwise give every browser 3000. */
const isPortNamed = args.includes("--port");
const servedArgs = isPortNamed ? args : [...args, "--port", String(devServerPort(browser))];
const wxtArgs = isServedByDevServer ? servedArgs : ["build", ...args];

let child = null;
let runner = null;
let reloadChannel = null;
let watchers = [];
let extensionStamp = "";
let isBuilding = false;
let pendingChange = null;
let isRestarting = false;
let settleTimer = null;
let crashRestarts = 0;
let firstCrashAtMs = 0;

/**
 * One build, start to finish, and whether it worked - the whole of the Firefox loop's other half.
 *
 * Settled by `error` as well as `exit`, and that is not belt and braces. A spawn that never starts -
 * a locked binary, a Windows file handle held a beat too long - emits only `error`, and a promise
 * left unsettled there leaves `isBuilding` true for the life of the session: every later save is
 * then dropped by the guard below, in silence. That is the shape of the failure this loop was found
 * in.
 */
function build() {
  return new Promise(resolve => {
    const builder = spawn(process.execPath, [wxtCli, ...wxtArgs], {
      stdio: ["pipe", "inherit", "inherit"],
      env: {
        ...process.env,
        [OWNS_BROWSER]: "true"
      }
    });
    builder.on("error", error => {
      console.info(`[dev] the build would not start: ${error.message}`);
      resolve(false);
    });
    builder.on("exit", code => resolve(code === 0));
  });
}

/**
 * A change, built and handed to the open window.
 *
 * A save that arrives mid-build is remembered rather than dropped. The build already running read
 * the tree before that save existed, so dropping it loses the edit outright - which reads exactly
 * like the loop being broken, because for that file it is.
 */
async function rebuild(filename) {
  if (isBuilding) {
    pendingChange = filename;

    return;
  }

  isBuilding = true;
  console.info(`\n[dev] ${filename} changed - rebuilding`);
  /* Before the build, because the build is what takes the pages - and it takes the tab with them,
   * which can take the window. `firefox-pages.mjs` says how that was measured. */
  const openPages = isServedByDevServer ? null : await parkExtensionPages(FIREFOX_BIDI_PORT);
  const isBuilt = await build();
  isBuilding = false;

  if (pendingChange) {
    const next = pendingChange;
    pendingChange = null;
    await rebuild(next);

    return;
  }

  if (!isBuilt) {
    console.info("[dev] the build failed - the window is still running the last one that worked");

    return;
  }

  /* The build emptied the output directory, so the page's way of hearing about the next one is gone. */
  plantReloadClient({ outputDir: sourceDirectory() });

  const stamp = readExtensionStamp();
  const isExtensionChanged = stamp !== extensionStamp;
  extensionStamp = stamp;

  if (isExtensionChanged) {
    await announceReload();
    await putPagesBack(openPages);

    return;
  }

  /*
   * A temporary add-on reads its files off this directory as it needs them, so a page that survived
   * the build is already running it - and reloading the add-on, which is what costs the background
   * its state, answers nothing that changed. Any page opened since the parking hears it this way;
   * the parked ones are put back below.
   */
  reloadChannel.broadcast();
  console.info("[dev] the extension was left alone - only its pages came back");
  await putPagesBack(openPages);
}

/**
 * The tabs the build took, pointed back at what they were showing.
 *
 * Said out loud only when there was something to do, because most rebuilds leave the page alone and
 * a line saying nothing happened every time is a line nobody reads.
 */
async function putPagesBack(openPages) {
  const restored = await restoreExtensionPages({
    port: FIREFOX_BIDI_PORT,
    pages: openPages
  });
  if (!restored) {
    return;
  }

  console.info(`[dev] ${restored} page${restored === 1 ? "" : "s"} put back where ${restored === 1 ? "it was" : "they were"}`);
}

/**
 * What the build left in the files only an extension reload can replace.
 *
 * Read off the output rather than guessed from the path that changed: which sources reach the
 * background is the bundler's graph, and a second copy of it here would drift the first time an
 * import moved.
 */
function readExtensionStamp() {
  const output = sourceDirectory();
  const stamp = createHash("sha1");

  for (const name of EXTENSION_OWNED_FILES) {
    stamp.update(readFileSync(join(output, name)));
  }

  return stamp.digest("hex");
}

function wait(delayMs) {
  return new Promise(resolve => setTimeout(resolve, delayMs));
}

function start() {
  child = spawn(process.execPath, [wxtCli, ...wxtArgs], {
    stdio: ["pipe", "inherit", "inherit"],
    env: {
      ...process.env,
      [OWNS_BROWSER]: "true"
    }
  });

  child.on("exit", async code => {
    if (isRestarting) {
      isRestarting = false;
      start();
      await announceReload();

      return;
    }

    if (code === 0 || !shouldAnswerCrash()) {
      console.info(
        `
[dev] wxt exited with ${code} and is not coming back - ending the session`
      );
      await stop(code ?? 0);

      return;
    }

    console.info(`\n[dev] wxt exited with ${code} - restarting (${crashRestarts}/${MAX_CRASH_RESTARTS})`);
    start();
    await announceReload();
  });
}

/** Counted inside a window, so a long healthy run resets the budget rather than spending it. */
function shouldAnswerCrash() {
  const nowMs = Date.now();
  const isSameSpell = nowMs - firstCrashAtMs < CRASH_WINDOW_MS;
  if (!isSameSpell) {
    firstCrashAtMs = nowMs;
    crashRestarts = 0;
  }

  crashRestarts += 1;

  return crashRestarts <= MAX_CRASH_RESTARTS;
}

/**
 * The restart's other half.
 *
 * A new CLI writes a new manifest - a different dev-server port in its content security policy,
 * among other things - and the extension in the open browser is still running the old one. Reloading
 * it is what makes the restart mean anything, and it is why the window did not have to close.
 */
async function announceReload() {
  if (!runner) {
    return;
  }

  const isBuilt = await waitForBuild();
  if (!isBuilt) {
    console.info("[dev] no build was written - leaving the extension as it is");

    return;
  }

  /*
   * Raced, because this one reaches outside the process. `web-ext` asks the add-on to reload over
   * its own socket and waits for an answer; a browser that has gone - or one busy enough not to
   * reply - leaves that wait open for good, and an open wait here is `isBuilding` stuck true and
   * every later save dropped without a word. A reload nobody confirmed is worth saying out loud;
   * it is not worth the session.
   */
  const isReloaded = await Promise.race([
    reloadExtension({
      runner,
      browser
    }).catch(() => false),
    wait(RELOAD_WAIT_MS).then(() => false)
  ]);
  if (!isReloaded) {
    console.info("[dev] could not reach the extension to reload it; open a tab, or reload it from the extensions page");

    return;
  }

  console.info("[dev] extension reloaded - the browser stayed open");
}

/** Whichever output this browser is running from: the dev server's, or a plain build's. */
function sourceDirectory() {
  return isServedByDevServer ? devOutputDirectory(browser) : buildOutputDirectory(browser);
}

async function waitForBuild() {
  const deadlineMs = Date.now() + BUILD_WAIT_MS;

  while (Date.now() < deadlineMs) {
    const output = sourceDirectory();
    if (output && existsSync(join(output, "manifest.json"))) {
      return true;
    }

    await new Promise(resolve => setTimeout(resolve, BUILD_POLL_MS));
  }

  return false;
}

/** A served session restarts to inline the new values; an unserved one has only the one answer. */
async function answerChange(filename) {
  if (!isServedByDevServer) {
    await rebuild(filename);

    return;
  }

  restart(`${filename} changed, and a build is the only thing that reads it`);
}

function restart(reason) {
  if (isRestarting || !child) {
    return;
  }

  console.info(`\n[dev] ${reason} - restarting the dev server; the browser stays open`);
  isRestarting = true;
  child.kill();
}

/**
 * The dev server, asked every few seconds whether it is still answering.
 *
 * Its own process is not the question. Vite can lose its server to an EBUSY on a file the browser is
 * holding and leave the process standing, so the thing that says a session is alive - `child` not
 * having exited - is exactly the thing that stays true when it is not. The port is what the browser
 * actually asks, so the port is what this asks too, and a restart is the same restart an `.env`
 * change already triggers: a new CLI, the same window, the extension reloaded onto it.
 *
 * Two misses rather than one, so a server busy through a rebuild is not mistaken for a dead one.
 */
function pollDevServer() {
  const port = devServerPort(browser);
  let misses = 0;
  let hasAnswered = false;

  const timer = setInterval(async () => {
    const isBusyElsewhere = isRestarting || !child;
    if (isBusyElsewhere) {
      return;
    }

    /*
     * `localhost`, not `127.0.0.1`. Vite binds `::1` only - measured, and the page's own module
     * urls say `localhost` for exactly that reason - so a probe that names the v4 address is
     * refused by a server that is perfectly well. It answered "dead" every single time.
     */
    const isAnswering = await fetch(`http://localhost:${port}/@vite/client`, {
      signal: AbortSignal.timeout(SERVER_HEARTBEAT_MS)
    }).then(() => true).catch(() => false);
    if (isAnswering) {
      hasAnswered = true;
      misses = 0;

      return;
    }

    /*
     * A server that has not answered *yet* is a server still building, and the first build is the
     * long one. Silence only counts once there has been a voice to lose: without this the first
     * poll after the window opens reads as a dead server and restarts a CLI that was doing fine -
     * measured, and it is a loop, since the restart puts the next one back at the same starting
     * line.
     */
    if (!hasAnswered) {
      return;
    }

    misses += 1;
    const isGone = misses >= SERVER_MISSES_ALLOWED;
    if (!isGone) {
      return;
    }

    misses = 0;
    hasAnswered = false;
    restart(`the dev server stopped answering on ${port}`);
  }, SERVER_HEARTBEAT_MS);

  timer.unref();

  return timer;
}

function isEnvFile(filename) {
  /* `.env` and `.env.anything`, but not `.environment` - the dot is what makes it a suffix. */
  const isEnvName = filename === ".env" || filename.startsWith(".env.");

  return Boolean(filename) && isEnvName && filename !== IGNORED_ENV_FILE;
}

/**
 * A root file a running session cannot absorb, so the session is rebuilt around it instead.
 *
 * The `.env` files for their values, and the config for the manifest it generates - a permission
 * added or dropped there is not something Vite can hand to a page, because the browser read it when
 * the extension was loaded. Left out of this, the only sign of a manifest change is that the browser
 * carries on behaving like the build before it, which is indistinguishable from the change not
 * working.
 */
function isBuiltIn(filename) {
  return isEnvFile(filename) || filename === CONFIG_FILE;
}

/**
 * The owner of this project's dev session, if there already is one.
 *
 * A lock file outlives the process that wrote it - a crash, a killed terminal - so the number in it
 * is a claim rather than a fact, and signal 0 is how the claim is checked: it asks the operating
 * system whether that process is still there without sending it anything.
 */
function runningOwner() {
  if (!existsSync(LOCK_FILE)) {
    return null;
  }

  const owner = Number(readFileSync(LOCK_FILE, "utf8").trim());
  if (!owner) {
    return null;
  }

  try {
    process.kill(owner, 0);

    return owner;
  } catch {
    return null;
  }
}

function claimLock() {
  mkdirSync(dirname(LOCK_FILE), { recursive: true });
  writeFileSync(LOCK_FILE, String(process.pid));
}

function releaseLock() {
  rmSync(LOCK_FILE, { force: true });
}

async function stop(code) {
  releaseLock();
  reloadChannel?.close();
  await Promise.all(watchers.map(watcher => watcher.close().catch(() => undefined)));
  /*
   * Raced, because the alternative was measured: this released the lock and then never reached
   * `process.exit`, leaving a session that had let go of everything it owned and still held its own
   * process - the dev server gone, the browser sitting on a page it could no longer load, and
   * nothing anywhere saying so. A browser that will not close is not a reason to stay half alive.
   */
  await Promise.race([runner?.exit().catch(() => undefined), wait(BROWSER_EXIT_MS)]);
  process.exit(code);
}

const owner = runningOwner();
if (owner) {
  console.error(
    `[dev] a ${browser} dev server is already running as process ${owner}.\n`
    + "      Two for one browser overwrite each other's build, so this one is stopping.\n"
    + "      Stop that one first, or use its window - it is the same extension.\n"
    + "      Another browser is fine: each has its own lock, output directory and port."
  );
  process.exit(1);
}

claimLock();

if (isServedByDevServer) {
  start();
} else {
  console.info(`[dev] ${browser} cannot be served, so this is a build - see the note at the top`);
  await build();
}

const output = await waitForBuild();
if (!output) {
  console.error("[dev] there is no build to open - not opening a browser");
  await stop(1);
}

/*
 * Before the browser, because the add-on is installed from this directory: the page has to already
 * carry the line that listens, and what this build left in the extension's own files is the
 * baseline every later rebuild is measured against.
 */
if (!isServedByDevServer) {
  reloadChannel = startReloadChannel();
  plantReloadClient({ outputDir: sourceDirectory() });
  extensionStamp = readExtensionStamp();
}

runner = await launchBrowser({
  browser,
  sourceDir: sourceDirectory()
}).catch(async error => {
  console.error(`[dev] the browser would not open: ${error.message}`);
  await stop(1);
});

/** Firefox 156 has no DevTools protocol left to open, so the two announce different addresses. */
const remoteAddress = browser === "firefox"
  ? `WebDriver BiDi at ws://127.0.0.1:${FIREFOX_BIDI_PORT}/session`
  : `the devtools protocol at http://127.0.0.1:${CDP_PORT}`;

console.info(`\n[dev] ${browser} is open on ${remoteAddress}`);
console.info("[dev] it stays open across restarts; the extension is reloaded instead\n");

/*
 * The root for its `.env` files and its config, which are baked into a build and so need a restart
 * rather than a reload; and the source tree too for the browser that has no server watching it -
 * Vite is doing that job on the others, and two watchers over one tree would only build the same
 * change twice.
 *
 * Directories rather than files: an editor that saves by writing a temp file and renaming it over
 * the original leaves any watch on the old file pointed at nothing.
 *
 * Two watches rather than one path list, and that is the difference between polling a hundred files
 * and polling four thousand. chokidar takes a single `depth` for every path it is handed, so "the
 * root for its own files, and `src` in full" cannot be said in one watch - asked for both, it walks
 * the whole repository, `companion/` included. That is the directory `wxt.config.ts` already keeps
 * Vite out of, because a locked MSBuild artifact there raises the EBUSY that loses a watcher.
 */
const WATCH_OPTIONS = {
  ignoreInitial: true,
  usePolling: true,
  interval: WATCH_POLL_MS,
  ignored: path => path.includes("node_modules") || path.includes(`${sep}.output`)
};

watchers = [
  chokidar.watch(PROJECT_ROOT, {
    ...WATCH_OPTIONS,
    depth: 0
  }),
  ...isServedByDevServer ? [] : [chokidar.watch(SOURCE_DIRECTORY, WATCH_OPTIONS)]
];

if (isServedByDevServer) {
  pollDevServer();
}

for (const watcher of watchers) {
  watcher.on("error", error => console.info(`[dev] the watcher complained: ${error.message}`));
  watcher.on("all", (_event, path) => {
    const isUnderSource = path.startsWith(SOURCE_DIRECTORY);
    if (!isUnderSource && !isBuiltIn(basename(path))) {
      return;
    }

    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => answerChange(relative(PROJECT_ROOT, path)), SETTLE_MS);
  });
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    isRestarting = false;
    crashRestarts = MAX_CRASH_RESTARTS + 1;
    child?.kill(signal);
    void stop(0);
  });
}
