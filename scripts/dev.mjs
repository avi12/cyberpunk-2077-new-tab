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
 * startup and not for one that appears during a build.
 *
 * Firefox is the exception to all of that: it has no dev server at all, because an extension page
 * there refuses remote code and a dev server is remote code. Its loop is a build, a window that
 * stays, and an open new tab that reloads itself as soon as the rebuild lands - see
 * `isServedByDevServer` and `scripts/dev-reload.mjs`.
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
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  watch,
  writeFileSync
} from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import process from "node:process";

// The package's `exports` map does not expose `bin/`, so the CLI is located relative to the entry.
const wxtEntry = createRequire(import.meta.url).resolve("wxt");
const wxtCli = resolve(dirname(wxtEntry), "../bin/wxt.mjs");

/** Read by `wxt.config.ts` to leave the browser alone, since this script is opening one. */
const OWNS_BROWSER = "WXT_DEV_OWNS_BROWSER";

/** Long enough that an editor writing a temp file and renaming it counts as one change. */
const SETTLE_MS = 250;

/** Vite never loads the example, so editing the documentation is not a reason to restart. */
const IGNORED_ENV_FILE = ".env.example";

/**
 * How many times a crash is worth answering with a restart before the crash is the answer. A watcher
 * that lost a race comes back; a config that cannot start never will, and looping on it hides the
 * error that says so.
 */
const MAX_CRASH_RESTARTS = 5;

/** A crash later than this is a fresh problem rather than the same one going round. */
const CRASH_WINDOW_MS = 60_000;

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
let extensionStamp = "";
let isBuilding = false;
let isRestarting = false;
let settleTimer = null;
let crashRestarts = 0;
let firstCrashAtMs = 0;

/** One build, start to finish, and whether it worked - the whole of the Firefox loop's other half. */
function build() {
  return new Promise(resolve => {
    const builder = spawn(process.execPath, [wxtCli, ...wxtArgs], {
      stdio: ["pipe", "inherit", "inherit"],
      env: {
        ...process.env,
        [OWNS_BROWSER]: "true"
      }
    });
    builder.on("exit", code => resolve(code === 0));
  });
}

/**
 * A change, built and handed to the open window. Overlapping presses of the same save are dropped
 * rather than queued: the build reads the tree as it is now, so the one already running has it.
 */
async function rebuild(filename) {
  if (isBuilding) {
    return;
  }

  isBuilding = true;
  console.info(`\n[dev] ${filename} changed - rebuilding`);
  const isBuilt = await build();
  isBuilding = false;

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

    return;
  }

  /*
   * A temporary add-on reads its files off this directory as it needs them, so a page that reloads
   * is already running the build that just finished - and reloading the add-on, which is what costs
   * the tab, answers nothing that changed.
   */
  const reloadedPages = reloadChannel.broadcast();
  console.info(
    reloadedPages
      ? "[dev] the open new tab reloaded itself - the extension was left alone"
      : "[dev] no page was listening, so nothing reloaded; Ctrl+T for the new build"
  );
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

  const isReloaded = await reloadExtension({
    runner,
    browser
  }).catch(() => false);
  if (!isReloaded) {
    console.info("[dev] could not reach the extension to reload it; open a tab, or reload it from the extensions page");

    return;
  }

  /*
   * Firefox tears an extension's own pages down when the add-on is reloaded - measured: the new tab
   * that was open is left at `about:blank`. Nothing here can keep it, so it is said out loud rather
   * than left looking like the rebuild broke the page. A rebuild only comes this far when the
   * background or the manifest changed; every other change is answered by the page reloading itself.
   */
  console.info(
    isServedByDevServer
      ? "[dev] extension reloaded - the browser stayed open"
      : "[dev] extension reloaded - the window stayed open, but Firefox closed its pages; Ctrl+T for the new build"
  );
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

  restart(filename);
}

function restart(filename) {
  if (isRestarting || !child) {
    return;
  }

  console.info(`\n[dev] ${filename} changed - restarting so the new values are inlined`);
  isRestarting = true;
  child.kill();
}

function isEnvFile(filename) {
  /* `.env` and `.env.anything`, but not `.environment` - the dot is what makes it a suffix. */
  const isEnvName = filename === ".env" || filename.startsWith(".env.");

  return Boolean(filename) && isEnvName && filename !== IGNORED_ENV_FILE;
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
  await runner?.exit().catch(() => undefined);
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
 * The directory rather than each file: an editor that saves by writing a temp file and renaming it
 * over the original leaves a watch on the old inode, which then never fires again.
 */
watch(PROJECT_ROOT, (_, filename) => {
  if (!isEnvFile(filename)) {
    return;
  }

  clearTimeout(settleTimer);
  settleTimer = setTimeout(() => answerChange(filename), SETTLE_MS);
});

/* The source tree, for the browser that has no server watching it. Everything under `src/` counts. */
if (!isServedByDevServer) {
  watch(join(PROJECT_ROOT, "src"), { recursive: true }, (_, filename) => {
    if (!filename) {
      return;
    }

    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => answerChange(filename), SETTLE_MS);
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
