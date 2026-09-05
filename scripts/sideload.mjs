/**
 * Opens a Chromium with the built extension sideloaded and CDP listening, then stays alive so the
 * browser does.
 *
 * `pnpm ext:dev` is the normal loop, but it owns the terminal and closes its browser when that
 * terminal goes away - no good when the browser has to outlive the command, or be driven over the
 * DevTools protocol. This runs the same launcher WXT uses (`web-ext`) against `.output/`, with
 * no reload watcher. Ctrl+C closes the browser.
 *
 * Usage: `pnpm ext:sideload [--port 9223] [--firefox]`
 */

import process from "node:process";
import webExt from "web-ext";

const DEFAULT_PORT = 9223;

/** The remote debugging port is what lets the chrome-devtools MCP attach to this browser. */
const BROWSERS = {
  chromium: {
    webExtTarget: "chromium",
    sourceDir: ".output/chrome-mv3",
    launchArgs: port => [`--remote-debugging-port=${port}`, "--no-first-run", "--no-default-browser-check"]
  },
  firefox: {
    webExtTarget: "firefox-desktop",
    sourceDir: ".output/firefox-mv3",
    launchArgs: () => []
  }
};

const args = process.argv.slice(2);
const isFirefox = args.includes("--firefox");
const iPortFlag = args.indexOf("--port");
const isPortGiven = iPortFlag !== -1;
const port = isPortGiven ? Number(args[iPortFlag + 1]) : DEFAULT_PORT;
const { webExtTarget, sourceDir, launchArgs } = isFirefox ? BROWSERS.firefox : BROWSERS.chromium;

const runner = await webExt.cmd.run(
  {
    target: [webExtTarget],
    sourceDir,
    args: launchArgs(port),
    noReload: true,
    startUrl: ["about:blank"]
  },
  { shouldExitProgram: false }
);

console.log(`sideloaded ${sourceDir}`);

if (!isFirefox) {
  console.log(`devtools protocol: http://127.0.0.1:${port}`);
}

console.log("open a new tab to see the page; press Ctrl+C to close the browser");

runner.registerCleanup(() => process.exit(0));

// web-ext resolves once the browser is up; hold the process open so the browser is not orphaned.
setInterval(() => undefined, 1 << 30);
