/**
 * Opens browsers on the built `.output/` extension with CDP listening, through the dev loop's
 * launcher and kept profiles. Ctrl+C closes all of them.
 *
 * Usage: `pnpm ext:sideload [--port 9223] [--edge] [--firefox] [--opera] [--all]`
 */

import { CDP_PORT, launchBrowser, PROJECT_ROOT } from "./browser.mjs";
import { join } from "node:path";
import process from "node:process";

/** Opera is not a target (it blocks `chrome_url_overrides`), only a spare Chromium to check against. */
const BUILD_DIRECTORIES = {
  chrome: join(PROJECT_ROOT, ".output", "chrome-mv3"),
  edge: join(PROJECT_ROOT, ".output", "chrome-mv3"),
  opera: join(PROJECT_ROOT, ".output", "chrome-mv3"),
  firefox: join(PROJECT_ROOT, ".output", "firefox-mv3")
};

const args = process.argv.slice(2);
const iPortFlag = args.indexOf("--port");
const firstPort = iPortFlag === -1 ? CDP_PORT : Number(args[iPortFlag + 1]);

function browsersRequested() {
  if (args.includes("--all")) {
    return ["chrome", "edge", "opera", "firefox"];
  }

  if (args.includes("--edge")) {
    return ["edge"];
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
function launchPlan() {
  const plan = [];
  let portOffset = 0;
  for (const browser of browsersRequested()) {
    plan.push({
      browser,
      port: firstPort + portOffset
    });

    if (browser !== "firefox") {
      portOffset += 1;
    }
  }

  return plan;
}

/** A failed launch (Chrome without developer mode) must not take the other browsers down. */
async function launch({ browser, port }) {
  const runner = await launchBrowser({
    browser,
    sourceDir: BUILD_DIRECTORIES[browser],
    port
  }).catch(error => {
    console.error(`${browser}: ${error.message}`);

    return null;
  });
  if (!runner) {
    return null;
  }

  const debuggerNote = browser === "firefox" ? "" : `, devtools protocol on http://127.0.0.1:${port}`;
  console.log(`${browser}: sideloaded ${BUILD_DIRECTORIES[browser]}${debuggerNote}`);

  return runner;
}

const runners = (await Promise.all(launchPlan().map(launch))).filter(Boolean);
if (runners.length === 0) {
  process.exit(1);
}

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
