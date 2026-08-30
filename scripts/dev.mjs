/**
 * `wxt` watches stdin for its `o + enter` shortcut and shuts down when that stream closes, so
 * running it detached (no TTY) kills the browser on the first rebuild. This runs the same CLI with
 * an stdin pipe that is simply never closed, which keeps the dev loop alive: edits hot-update the
 * open tab, and the browser is never restarted.
 *
 * The remote debugging port comes from `webExt.chromiumArgs` in wxt.config.ts, so the
 * chrome-devtools MCP can attach to the same browser.
 *
 * Usage: `pnpm ext:dev:hmr [-b firefox]`
 */

import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import process from "node:process";

// The package's `exports` map does not expose `bin/`, so the CLI is located relative to the entry.
const wxtEntry = createRequire(import.meta.url).resolve("wxt");
const wxtCli = resolve(dirname(wxtEntry), "../bin/wxt.mjs");

const child = spawn(process.execPath, [wxtCli, ...process.argv.slice(2)], { stdio: ["pipe", "inherit", "inherit"] });

child.on("exit", code => process.exit(code ?? 0));

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
