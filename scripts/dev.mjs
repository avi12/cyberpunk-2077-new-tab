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
 * Refusing to start twice is not a nicety. Two of these race for the dev server's port, and both
 * build into the same `.output` directory: the manifest ends up naming one server's port while the
 * page it serves names the other's, and the extension loads nothing at all. It has happened, with
 * three at once.
 *
 * Usage: `pnpm ext:dev:hmr [-b edge]`
 */

import {
  CDP_PORT,
  devOutputDirectory,
  launchBrowser,
  PROJECT_ROOT,
  reloadExtension
} from "./browser.mjs";
import { spawn } from "node:child_process";
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

/** Under `node_modules`, which is git-ignored and wiped by a reinstall - both true of this too. */
const LOCK_FILE = join(PROJECT_ROOT, "node_modules", ".cache", "wxt-dev.lock");

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

const args = process.argv.slice(2);
const iBrowserFlag = args.findIndex(arg => arg === "-b" || arg === "--browser");
const browser = iBrowserFlag === -1 ? "chrome" : args[iBrowserFlag + 1];

let child = null;
let runner = null;
let isRestarting = false;
let settleTimer = null;
let crashRestarts = 0;
let firstCrashAtMs = 0;

function start() {
  child = spawn(process.execPath, [wxtCli, ...args], {
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
    console.info("[dev] the dev server wrote no build - leaving the extension as it is");

    return;
  }

  const isReloaded = await reloadExtension({
    runner,
    browser
  }).catch(() => false);

  console.info(
    isReloaded
      ? "[dev] extension reloaded - the browser stayed open"
      : "[dev] could not reach the extension to reload it; open a tab, or reload it from the extensions page"
  );
}

async function waitForBuild() {
  const deadlineMs = Date.now() + BUILD_WAIT_MS;

  while (Date.now() < deadlineMs) {
    const output = devOutputDirectory(browser);
    if (output && existsSync(join(output, "manifest.json"))) {
      return true;
    }

    await new Promise(resolve => setTimeout(resolve, BUILD_POLL_MS));
  }

  return false;
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
  await runner?.exit().catch(() => undefined);
  process.exit(code);
}

const owner = runningOwner();
if (owner) {
  console.error(
    `[dev] a dev server is already running as process ${owner}.\n`
    + "      Two of them race for the port and overwrite each other's build, so this one is stopping.\n"
    + "      Stop that one first, or use its browser - it is the same extension."
  );
  process.exit(1);
}

claimLock();
start();

const output = await waitForBuild();
if (!output) {
  console.error("[dev] the dev server wrote no build in time - not opening a browser");
  await stop(1);
}

runner = await launchBrowser({
  browser,
  sourceDir: devOutputDirectory(browser)
}).catch(async error => {
  console.error(`[dev] the browser would not open: ${error.message}`);
  await stop(1);
});

console.info(`\n[dev] ${browser} is open on the devtools protocol at http://127.0.0.1:${CDP_PORT}`);
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
  settleTimer = setTimeout(() => restart(filename), SETTLE_MS);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    isRestarting = false;
    crashRestarts = MAX_CRASH_RESTARTS + 1;
    child?.kill(signal);
    void stop(0);
  });
}
