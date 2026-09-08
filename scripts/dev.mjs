/**
 * `wxt` watches stdin for its `o + enter` shortcut and shuts down when that stream closes, so
 * running it detached (no TTY) kills the browser on the first rebuild. This runs the same CLI with
 * an stdin pipe that is simply never closed, which keeps the dev loop alive: edits hot-update the
 * open tab, and the browser is never restarted.
 *
 * Two things it also survives, both of which used to end the session outright:
 *
 * An `.env` edit. Vite inlines those values when the build starts, so a running server goes on
 * serving the old ones - which reads as a key that did not take rather than as a server that never
 * re-read it. Only a restart picks them up, so this watches for one and restarts.
 *
 * A watcher crash. Vite watches the whole project root, which includes `companion/`, and a locked
 * artifact there - MSBuild holding an `obj/**` binary mid-build, or the tray app holding its own
 * exe - makes chokidar raise EBUSY. Vite treats that as fatal and takes the dev server with it, even
 * though nothing being watched there is ever bundled. `wxt.config.ts` asks Vite to ignore the
 * directory, which helps for a file that exists at startup and not for one that appears during a
 * build, so the crash is also caught here and the CLI brought back up.
 *
 * The remote debugging port comes from `webExt.chromiumArgs` in wxt.config.ts, so the
 * chrome-devtools MCP can attach to the same browser.
 *
 * Usage: `pnpm ext:dev:hmr [-b firefox]`
 */

import { spawn } from "node:child_process";
import { watch } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import process from "node:process";

// The package's `exports` map does not expose `bin/`, so the CLI is located relative to the entry.
const wxtEntry = createRequire(import.meta.url).resolve("wxt");
const wxtCli = resolve(dirname(wxtEntry), "../bin/wxt.mjs");

const projectRoot = resolve(dirname(new URL(import.meta.url).pathname.slice(1)), "..");

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

let child = null;
let isRestarting = false;
let settleTimer = null;
let crashRestarts = 0;
let firstCrashAtMs = 0;

function start() {
  child = spawn(process.execPath, [wxtCli, ...process.argv.slice(2)], {
    stdio: ["pipe", "inherit", "inherit"]
  });

  child.on("exit", code => {
    if (isRestarting) {
      isRestarting = false;
      start();

      return;
    }

    if (code === 0 || !shouldAnswerCrash()) {
      process.exit(code ?? 0);
    }

    console.info(`\n[dev] wxt exited with ${code} - restarting (${crashRestarts}/${MAX_CRASH_RESTARTS})`);
    start();
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

start();

/*
 * The directory rather than each file: an editor that saves by writing a temp file and renaming it
 * over the original leaves a watch on the old inode, which then never fires again.
 */
watch(projectRoot, (_, filename) => {
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
  });
}
