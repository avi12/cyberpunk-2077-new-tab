/**
 * Opens browsers with the built extension sideloaded and CDP listening, then stays alive so they do.
 *
 * `pnpm ext:dev` is the normal loop, but it owns the terminal and closes its browser when that
 * terminal goes away - no good when the browser has to outlive the command, or be driven over the
 * DevTools protocol. This opens the same browsers that loop opens, through the same launcher and
 * the same kept profiles, against `.output/` rather than a dev build. Ctrl+C closes all of them.
 *
 * Usage: `pnpm ext:sideload [--port 9223] [--firefox] [--opera] [--all]`
 *
 * A Chrome that lists the extension but leaves it switched off wants developer mode - one press on
 * `chrome://extensions`, which the kept profile then remembers. `scripts/browser.mjs` says why it
 * cannot be pressed for you.
 */

import { CDP_PORT, launchBrowser, PROJECT_ROOT } from "./browser.mjs";
import { join } from "node:path";
import process from "node:process";

/**
 * Opera has no build of its own: it installs the Chromium one, as Chrome and Edge do, so the only
 * thing that differs is which binary `web-ext.config.ts` points the launcher at.
 */
const SOURCE_DIRECTORIES = {
  chrome: join(PROJECT_ROOT, ".output", "chrome-mv3"),
  opera: join(PROJECT_ROOT, ".output", "chrome-mv3"),
  firefox: join(PROJECT_ROOT, ".output", "firefox-mv3")
};

const args = process.argv.slice(2);
const iPortFlag = args.indexOf("--port");
const portBase = iPortFlag === -1 ? CDP_PORT : Number(args[iPortFlag + 1]);

function browsersRequested() {
  if (args.includes("--all")) {
    return ["chrome", "opera", "firefox"];
  }

  if (args.includes("--firefox")) {
    return ["firefox"];
  }

  if (args.includes("--opera")) {
    return ["opera"];
  }

  return ["chrome"];
}

/** Every Chromium needs a port of its own, or the second one quietly starts without a debugger. */
function planned() {
  const plan = [];
  let portOffset = 0;
  for (const browser of browsersRequested()) {
    plan.push({
      browser,
      port: portBase + portOffset
    });

    if (browser !== "firefox") {
      portOffset += 1;
    }
  }

  return plan;
}

/**
 * One browser that will not take the extension is not a reason to close the two that did - and
 * Chrome without developer mode is exactly that: `Extensions.loadUnpacked` is refused, web-ext's
 * connection closes under it, and the rejection used to take the whole run down with it.
 */
async function launch({ browser, port }) {
  const runner = await launchBrowser({
    browser,
    sourceDir: SOURCE_DIRECTORIES[browser],
    port
  }).catch(error => {
    console.error(`${browser}: ${error.message}`);

    return null;
  });
  if (!runner) {
    return null;
  }

  const debuggerNote = browser === "firefox" ? "" : `, devtools protocol on http://127.0.0.1:${port}`;
  console.log(`${browser}: sideloaded ${SOURCE_DIRECTORIES[browser]}${debuggerNote}`);

  return runner;
}

const runners = (await Promise.all(planned().map(launch))).filter(Boolean);
if (runners.length === 0) {
  process.exit(1);
}

/** One browser being closed is not the end of the run when three were asked for. */
let openCount = runners.length;
for (const runner of runners) {
  runner.registerCleanup(() => {
    openCount -= 1;

    if (openCount === 0) {
      process.exit(0);
    }
  });
}

console.log("open a new tab to see the page; press Ctrl+C to close every browser");

// web-ext resolves once a browser is up; hold the process open so none is orphaned.
setInterval(() => undefined, 1 << 30);
