/**
 * `wxt` watches stdin for its `o + enter` shortcut and shuts down when that stream closes, so
 * running it detached (no TTY) kills the browser on the first rebuild. This runs the same CLI with
 * an stdin pipe that is simply never closed, which keeps the dev loop alive: edits hot-update the
 * open tab, and the browser is never restarted.
 *
 * The one edit that cannot hot-update is an `.env` one. Vite inlines those values when the build
 * starts, so a running server goes on serving the old ones - which reads as a key that did not take
 * rather than as a server that never re-read it. This watches for that and restarts the CLI, which
 * is the only thing that picks the values up. The browser does come back with it; a restart is the
 * cost of the change, and a silently stale key is worse.
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

let child = null;
let isRestarting = false;
let settleTimer = null;

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

    process.exit(code ?? 0);
  });
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
    child?.kill(signal);
  });
}
