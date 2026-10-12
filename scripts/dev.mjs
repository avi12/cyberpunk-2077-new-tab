/**
 * `wxt` shuts down when stdin closes, so it runs here with a stdin pipe that is never closed.
 *
 * The browser is opened here rather than by `wxt`, so restarting the CLI (for an `.env` or config
 * edit, or a watcher crash) never closes the window - the extension is reloaded instead.
 *
 * Firefox has no dev server, since its extension pages refuse remote code. It is rebuilt instead: a
 * component is hot-swapped (`dev-hmr.mjs`), other page changes reload the page (`dev-reload.mjs`),
 * and a background or manifest change reloads the add-on (`firefox-pages.mjs`).
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
import { buildHotGraph, hotModuleId, isHotModule } from "./dev-hmr.mjs";
import { plantHotEntry, plantReloadClient, startReloadChannel } from "./dev-reload.mjs";
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

const OWNS_BROWSER = "WXT_DEV_OWNS_BROWSER";

/**
 * Polled, because `fs.watch` on Windows silently stops delivering. Polling also ignores reads, so a
 * build or an editor indexing the tree raises nothing.
 */
const WATCH_POLL_MS = 500;
const SETTLE_MS = 500;

const SERVER_HEARTBEAT_MS = 5000;
const SERVER_MISSES_ALLOWED = 3;

const IGNORED_ENV_FILE = ".env.example";

const CONFIG_FILE = "wxt.config.ts";

/*
 * Node would end the session on an unhandled rejection, and the ones this loop raises are transient.
 * Vite's EBUSY watch race is not even worth printing - the build still succeeds.
 */
process.on("unhandledRejection", reason => {
  const isWatcherRace = reason?.code === "EBUSY" && reason?.syscall === "watch";
  if (isWatcherRace) {
    return;
  }

  console.info("[dev] something failed in the background and was survived:");
  console.error(reason);
});

/** Capped, so a config that can never start shows its error instead of looping. */
const MAX_CRASH_RESTARTS = 5;
const CRASH_WINDOW_MS = 60_000;

const RELOAD_WAIT_MS = 15_000;
const BROWSER_EXIT_MS = 5000;

const BUILD_WAIT_MS = 90_000;
const BUILD_POLL_MS = 200;

/** Only an add-on reload picks these up; everything else a page reload refetches. */
const EXTENSION_OWNED_FILES = ["background.js", "manifest.json"];

const args = process.argv.slice(2);
const iBrowserFlag = args.findIndex(arg => arg === "-b" || arg === "--browser");
const browser = iBrowserFlag === -1 ? "chrome" : args[iBrowserFlag + 1];

/**
 * Per browser: two sessions for one browser overwrite each other's `.output` manifest, while
 * different browsers have their own output directory and port and can run side by side.
 */
const LOCK_FILE = join(PROJECT_ROOT, "node_modules", ".cache", `wxt-dev-${browser}.lock`);

const SOURCE_DIRECTORY = join(PROJECT_ROOT, "src");

/**
 * Firefox drops the manifest's CSP naming the dev server and applies `script-src 'self'`, so a
 * served page paints nothing. It is rebuilt instead, with hot swapping done from its own modules.
 */
const isServedByDevServer = browser !== "firefox";

const isPortNamed = args.includes("--port");
const servedArgs = isPortNamed ? args : [...args, "--port", String(devServerPort(browser))];
const wxtArgs = isServedByDevServer ? servedArgs : ["build", ...args];

let wxtProcess = null;
let runner = null;
let reloadChannel = null;
let watchers = [];
let extensionStamp = "";
let isBuilding = false;
let pendingChange = null;
let isRestarting = false;
let isHotPlanted = false;
let settleTimer = null;
let crashRestarts = 0;
let firstCrashAtMs = 0;

/**
 * Settled by `error` too: a spawn that never starts emits only `error`, and an unsettled promise
 * would leave `isBuilding` stuck true and every later save silently dropped.
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

/** On a compile error Vite writes nothing, so the page keeps running the last graph that worked. */
function refreshHotGraph() {
  return buildHotGraph({ outputDirectory: extensionOutputDirectory() })
    .then(() => true)
    .catch(error => {
      console.info(`[dev] the hot graph would not build: ${error.message.split("\n")[0]}`);

      return false;
    });
}

async function plantHotGraph() {
  const isBuilt = await refreshHotGraph();

  return isBuilt && plantHotEntry({
    outputDir: extensionOutputDirectory()
  });
}

/** A save mid-build is queued, since the running build read the tree before it. */
async function rebuild(filename) {
  if (isBuilding) {
    pendingChange = filename;

    return;
  }

  isBuilding = true;
  /* A swap skips the parking too, because parking navigates the tab away and loses its state. */
  const isSwappable = isHotPlanted && isHotModule(filename);
  console.info(`\n[dev] ${filename} changed - ${isSwappable ? "swapping" : "rebuilding"}`);
  /* Before the build, because a build closes the extension's tabs, which can close the window. */
  const openPages = isServedByDevServer || isSwappable ? null : await parkExtensionPages(FIREFOX_BIDI_PORT);
  const isBuilt = isSwappable ? await refreshHotGraph() : await build();
  isBuilding = false;

  if (pendingChange) {
    const queuedChange = pendingChange;
    pendingChange = null;
    await rebuild(queuedChange);

    return;
  }

  if (!isBuilt) {
    console.info("[dev] the build failed - the window is still running the last one that worked");

    return;
  }

  if (isSwappable) {
    const isHeard = reloadChannel.swap(hotModuleId(filename)) > 0;
    console.info(
      isHeard
        ? "[dev] swapped into the open page - nothing reloaded"
        : "[dev] no open page heard the swap"
    );

    return;
  }

  /* The build emptied the output directory, reload client included. */
  plantReloadClient({ outputDir: extensionOutputDirectory() });
  isHotPlanted = await plantHotGraph();

  const stamp = readExtensionStamp();
  const isExtensionChanged = stamp !== extensionStamp;
  extensionStamp = stamp;

  if (isExtensionChanged) {
    await announceReload();
    await putPagesBack(openPages);

    return;
  }

  /* A temporary add-on reads its files off disk on demand, so a page reload is enough here. */
  reloadChannel.broadcast();
  console.info("[dev] the extension was left alone - only its pages came back");
  await putPagesBack(openPages);
}

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

/** Hashed from the output, since only the bundler knows which sources reach the background. */
function readExtensionStamp() {
  const outputDirectory = extensionOutputDirectory();
  const stamp = createHash("sha1");

  for (const name of EXTENSION_OWNED_FILES) {
    stamp.update(readFileSync(join(outputDirectory, name)));
  }

  return stamp.digest("hex");
}

function wait(delayMs) {
  return new Promise(resolve => setTimeout(resolve, delayMs));
}

function start() {
  wxtProcess = spawn(process.execPath, [wxtCli, ...wxtArgs], {
    stdio: ["pipe", "inherit", "inherit"],
    env: {
      ...process.env,
      [OWNS_BROWSER]: "true"
    }
  });

  wxtProcess.on("exit", async code => {
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

async function announceReload() {
  if (!runner) {
    return;
  }

  const isBuilt = await waitForBuild();
  if (!isBuilt) {
    console.info("[dev] no build was written - leaving the extension as it is");

    return;
  }

  /* Raced, because a browser that never answers would otherwise leave every later save dropped. */
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

function extensionOutputDirectory() {
  return isServedByDevServer ? devOutputDirectory(browser) : buildOutputDirectory(browser);
}

async function waitForBuild() {
  const deadlineMs = Date.now() + BUILD_WAIT_MS;

  while (Date.now() < deadlineMs) {
    const outputDirectory = extensionOutputDirectory();
    if (outputDirectory && existsSync(join(outputDirectory, "manifest.json"))) {
      return true;
    }

    await new Promise(resolve => setTimeout(resolve, BUILD_POLL_MS));
  }

  return false;
}

async function answerChange(filename) {
  if (!isServedByDevServer) {
    await rebuild(filename);

    return;
  }

  restart(`${filename} changed, and a build is the only thing that reads it`);
}

function restart(reason) {
  if (isRestarting || !wxtProcess) {
    return;
  }

  console.info(`\n[dev] ${reason} - restarting the dev server; the browser stays open`);
  isRestarting = true;
  wxtProcess.kill();
}

/**
 * The port is polled rather than the process: an EBUSY in Vite's watcher can kill the server while
 * the process keeps running, so its `exit` never fires.
 */
function pollDevServer() {
  const port = devServerPort(browser);
  let misses = 0;
  let hasAnswered = false;

  const timer = setInterval(async () => {
    const isBusyElsewhere = isRestarting || !wxtProcess;
    if (isBusyElsewhere) {
      return;
    }

    /* `localhost`, not `127.0.0.1`: Vite binds `::1` only. */
    const isAnswering = await fetch(`http://localhost:${port}/@vite/client`, {
      signal: AbortSignal.timeout(SERVER_HEARTBEAT_MS)
    }).then(() => true).catch(() => false);
    if (isAnswering) {
      hasAnswered = true;
      misses = 0;

      return;
    }

    /* Still on its first build, which would otherwise read as dead and restart in a loop. */
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
  const isEnvName = filename === ".env" || filename.startsWith(".env.");

  return Boolean(filename) && isEnvName && filename !== IGNORED_ENV_FILE;
}

function isBakedIntoBuild(filename) {
  return isEnvFile(filename) || filename === CONFIG_FILE;
}

/** A lock can outlive a crashed session, so signal 0 checks the process is still alive. */
function runningLockOwnerPid() {
  if (!existsSync(LOCK_FILE)) {
    return null;
  }

  const ownerPid = Number(readFileSync(LOCK_FILE, "utf8").trim());
  if (!ownerPid) {
    return null;
  }

  try {
    process.kill(ownerPid, 0);

    return ownerPid;
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
  /* Raced, so a browser that will not close cannot keep this process half alive. */
  await Promise.race([runner?.exit().catch(() => undefined), wait(BROWSER_EXIT_MS)]);
  process.exit(code);
}

const runningOwnerPid = runningLockOwnerPid();
if (runningOwnerPid) {
  console.error(
    `[dev] a ${browser} dev server is already running as process ${runningOwnerPid}.\n`
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

const isBuildWritten = await waitForBuild();
if (!isBuildWritten) {
  console.error("[dev] there is no build to open - not opening a browser");
  await stop(1);
}

/* Before the browser, because the add-on is installed from this directory. */
if (!isServedByDevServer) {
  reloadChannel = startReloadChannel();
  plantReloadClient({ outputDir: extensionOutputDirectory() });
  isHotPlanted = await plantHotGraph();
  extensionStamp = readExtensionStamp();
}

runner = await launchBrowser({
  browser,
  sourceDir: extensionOutputDirectory()
}).catch(async error => {
  console.error(`[dev] the browser would not open: ${error.message}`);
  await stop(1);
});

const remoteAddress = browser === "firefox"
  ? `WebDriver BiDi at ws://127.0.0.1:${FIREFOX_BIDI_PORT}/session`
  : `the devtools protocol at http://127.0.0.1:${CDP_PORT}`;

console.info(`\n[dev] ${browser} is open on ${remoteAddress}`);
console.info("[dev] it stays open across restarts; the extension is reloaded instead\n");

/*
 * Directories rather than files, since an editor that saves by rename orphans a file watch. Two
 * watches, because chokidar takes one `depth` for all paths, and depth 0 on the root keeps it out of
 * `companion/` and its locked MSBuild artifacts.
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
    if (!isUnderSource && !isBakedIntoBuild(basename(path))) {
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
    wxtProcess?.kill(signal);
    void stop(0);
  });
}
