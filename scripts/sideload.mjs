/**
 * Opens a Chromium with the built extension sideloaded and CDP listening, then stays alive so the
 * browser does.
 *
 * `pnpm ext:dev` is the normal loop, but it owns the terminal and closes its browser when that
 * terminal goes away - no good when the browser has to outlive the command, or be driven over the
 * DevTools protocol. This runs the same launcher WXT uses (`web-ext-run`) against `.output/`, with
 * no reload watcher. Ctrl+C closes the browser.
 *
 * Usage: `pnpm ext:sideload [--port 9223] [--firefox]`
 */

import process from "node:process";
import webExt from "web-ext-run";

const DEFAULT_PORT = 9223;

const args = process.argv.slice(2);

function flagValue(name, fallback) {
  const index = args.indexOf(name);

  return index === -1 ? fallback : args[index + 1];
}

const firefox = args.includes("--firefox");
const port = Number(flagValue("--port", DEFAULT_PORT));
const sourceDir = firefox ? ".output/firefox-mv2" : ".output/chrome-mv3";

const runner = await webExt.cmd.run(
  {
    target: [firefox ? "firefox-desktop" : "chromium"],
    sourceDir,
    // The remote debugging port is what lets the chrome-devtools MCP attach to this browser.
    args: firefox ? [] : [`--remote-debugging-port=${port}`, "--no-first-run", "--no-default-browser-check"],
    noReload: true,
    startUrl: ["about:blank"]
  },
  { shouldExitProgram: false }
);

console.log(`sideloaded ${sourceDir}`);

if (!firefox) {
  console.log(`devtools protocol: http://127.0.0.1:${port}`);
}

console.log("open a new tab to see the page; press Ctrl+C to close the browser");

runner.registerCleanup(() => process.exit(0));

// web-ext resolves once the browser is up; hold the process open so the browser is not orphaned.
setInterval(() => undefined, 1 << 30);
