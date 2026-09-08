/**
 * The one browser the dev loop drives, and everything that addresses it.
 *
 * The debugging port lives here rather than in `wxt.config.ts` because the dev server no longer
 * opens the browser - `scripts/dev.mjs` does, so the window can outlive a restart - and both that
 * and `scripts/sideload.mjs` have to name the same number. `.mcp.json` points the chrome-devtools
 * MCP at it too, and that one is a JSON file that cannot import anything, so it is the single copy
 * that has to be kept by hand.
 */

import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import webExt from "web-ext";

export const CDP_PORT = 9223;

export const PROJECT_ROOT = resolve(import.meta.dirname, "..");

/**
 * One kept profile per browser, kept outside the project.
 *
 * Kept, because without `keepProfileChanges` and a directory to keep, every launch mints a fresh
 * `tmp-web-ext-*` under the system temp directory and leaves it there - measured on this machine:
 * 396 of them. A kept profile also remembers its tabs, its zoom and its sign-ins between runs,
 * which a throwaway never could.
 *
 * Outside, because the dev server watches the project root and a live profile is a directory of
 * files the browser holds open for as long as it runs - `Default/Network/Cookies`,
 * `BrowserMetrics/*.pma`. chokidar answers a locked file with EBUSY, Vite treats that as fatal, and
 * a profile inside the tree took the dev server down five times in a row before the restart budget
 * gave up. Ignoring the directory in the watcher config did not stop it.
 */
const PROFILES_DIRECTORY = join(
  process.env.LOCALAPPDATA || join(homedir(), ".cache"),
  "cyberpunk-2077-new-tab",
  "user-profiles"
);

/** Git-ignored, because the paths are one machine's. A clone has none and web-ext finds its own. */
const LOCAL_BINARIES_CONFIG = join(PROJECT_ROOT, "web-ext.config.ts");

async function localBinaries() {
  if (!existsSync(LOCAL_BINARIES_CONFIG)) {
    return {};
  }

  const config = await import(pathToFileURL(LOCAL_BINARIES_CONFIG).href);

  return config.default?.binaries ?? {};
}

/**
 * The browser, opened once and handed back so the caller can close it.
 *
 * `noReload` because nothing here wants web-ext's own watcher: the dev server rebuilds, and
 * `reloadExtension` is what tells the browser about it.
 */
export async function launchBrowser({ browser, sourceDir, port = CDP_PORT }) {
  const binaries = await localBinaries();
  const profile = join(PROFILES_DIRECTORY, browser);
  const isFirefox = browser === "firefox";

  /* chrome-launcher opens its own log inside the profile before creating anything, so it has to be there. */
  mkdirSync(profile, { recursive: true });

  const firefoxOptions = {
    target: "firefox-desktop",
    firefox: binaries.firefox,
    firefoxProfile: profile
  };

  const chromiumOptions = {
    target: "chromium",
    chromiumBinary: binaries[browser],
    chromiumProfile: profile,
    args: [
      `--remote-debugging-port=${port}`,
      "--remote-debugging-address=127.0.0.1",
      /* A kept profile would otherwise meet the first-run experience once and the default-browser nag every time. */
      "--no-first-run",
      "--no-default-browser-check"
    ]
  };

  return webExt.cmd.run(
    {
      sourceDir,
      keepProfileChanges: true,
      noReload: true,
      noInput: true,
      ...isFirefox ? firefoxOptions : chromiumOptions
    },
    { shouldExitProgram: false }
  );
}

/**
 * The extension told to read itself off disk again, without the browser going anywhere.
 *
 * Asked of the extension's own service worker rather than of web-ext, whose Chromium reload re-runs
 * `Extensions.loadUnpacked` - a call Edge accepts and silently does nothing with. `runtime.reload`
 * is the extension reloading itself, which every Chromium honours.
 *
 * Firefox is web-ext's own job: its remote protocol is not the DevTools one, and the runner already
 * speaks it.
 */
export async function reloadExtension({ runner, browser, port = CDP_PORT }) {
  if (browser === "firefox") {
    await runner.reloadAllExtensions();

    return true;
  }

  const worker = await extensionWorker(port);
  if (!worker) {
    return false;
  }

  await evaluateInWorker({
    webSocketDebuggerUrl: worker.webSocketDebuggerUrl,
    expression: "chrome.runtime.reload()"
  });

  return true;
}

async function extensionWorker(port) {
  const response = await fetch(`http://127.0.0.1:${port}/json/list`).catch(() => null);
  if (!response?.ok) {
    return null;
  }

  const targets = await response.json();

  return targets.find(target => target.type === "service_worker" && target.url.startsWith("chrome-extension://"));
}

/**
 * One call, then the socket goes.
 *
 * No answer is waited for: `runtime.reload()` tears down the very worker that would have sent one,
 * so the reply never arrives and waiting for it only ever times out.
 */
function evaluateInWorker({ webSocketDebuggerUrl, expression }) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(webSocketDebuggerUrl);
    socket.addEventListener("error", () => reject(new Error("the extension's worker refused the connection")));
    socket.addEventListener("open", () => {
      socket.send(
        JSON.stringify({
          id: 1,
          method: "Runtime.evaluate",
          params: {
            expression
          }
        })
      );
      socket.close();
      resolve();
    });
  });
}

/**
 * Where the dev server writes the build for this browser, once it has written one.
 *
 * Read off disk rather than composed from the arguments. Every target is MV3, so the name is
 * `<browser>-mv3-dev` today - but which browser and which manifest version is the config's to
 * decide, and this script has no business restating that rule to disagree with it later.
 */
export function devOutputDirectory(browser) {
  const output = join(PROJECT_ROOT, ".output");
  if (!existsSync(output)) {
    return null;
  }

  const built = readdirSync(output).find(name => name.startsWith(`${browser}-`) && name.endsWith("-dev"));

  return built ? join(output, built) : null;
}
