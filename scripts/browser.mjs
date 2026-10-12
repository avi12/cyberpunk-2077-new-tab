/**
 * `CDP_PORT` lives here because `scripts/dev.mjs` opens the browser, not the dev server. `.mcp.json`
 * cannot import it, so the copy there has to be kept in step by hand.
 */

import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import webExt from "web-ext";

export const CDP_PORT = 9223;

/**
 * WebDriver BiDi, not CDP - Firefox 156 dropped CDP. `web-ext` reloads over its own RDP socket.
 * `--remote-allow-system-access` is required, or BiDi refuses to navigate to `moz-extension://`.
 */
export const FIREFOX_BIDI_PORT = 9224;

/**
 * One per browser: the port is baked into the manifest's CSP and every entrypoint's HTML, and `wxt`
 * gives every browser 3000. Two sessions at once would let Vite silently move the second to 3001,
 * leaving that browser loading the other session's modules - a blank new tab with no error.
 */
const DEV_SERVER_PORTS = {
  edge: 3000,
  chrome: 3001,
  opera: 3002
};

const DEFAULT_DEV_SERVER_PORT = 3000;

export function devServerPort(browser) {
  return DEV_SERVER_PORTS[browser] ?? DEFAULT_DEV_SERVER_PORT;
}

export const PROJECT_ROOT = resolve(import.meta.dirname, "..");

/**
 * Kept, or every launch leaves a fresh `tmp-web-ext-*` behind in the temp directory. Outside the
 * project, because the browser holds profile files locked, chokidar answers them with EBUSY and Vite
 * treats that as fatal - ignoring the directory in the watcher config did not help.
 */
const PROFILES_DIRECTORY = join(
  process.env.LOCALAPPDATA || join(homedir(), ".cache"),
  "cyberpunk-2077-new-tab",
  "user-profiles"
);

/** Git-ignored, because the paths are one machine's. Without it web-ext finds its own. */
const LOCAL_BINARIES_CONFIG = join(PROJECT_ROOT, "web-ext.config.ts");

async function localBinaries() {
  if (!existsSync(LOCAL_BINARIES_CONFIG)) {
    return {};
  }

  const config = await import(pathToFileURL(LOCAL_BINARIES_CONFIG).href);

  return config.default?.binaries ?? {};
}

/*
 * Chrome 137+ keeps a `--load-extension` extension disabled until developer mode is on, and this
 * cannot be automated: the preference sits behind an HMAC in `Secure Preferences`, and toggling it
 * over CDP resets the extension service mid-load. So it is one press by hand on
 * `chrome://extensions`, remembered by the kept profile.
 */

/** `noReload` because the dev server rebuilds and `reloadExtension` tells the browser. */
export async function launchBrowser({ browser, sourceDir, port = CDP_PORT }) {
  const binaries = await localBinaries();
  const profile = join(PROFILES_DIRECTORY, browser);
  const isFirefox = browser === "firefox";

  /* chrome-launcher writes its log into the profile before creating it. */
  mkdirSync(profile, { recursive: true });

  const firefoxOptions = {
    target: "firefox-desktop",
    firefox: binaries.firefox,
    firefoxProfile: profile,
    args: [
      "--remote-debugging-port",
      String(FIREFOX_BIDI_PORT),
      "--remote-allow-system-access"
    ]
  };

  const chromiumOptions = {
    target: "chromium",
    chromiumBinary: binaries[browser],
    chromiumProfile: profile,
    args: [
      `--remote-debugging-port=${port}`,
      "--remote-debugging-address=127.0.0.1",
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
 * Chromium reloads through the extension's own worker, because web-ext's reload re-runs
 * `Extensions.loadUnpacked`, which Edge silently ignores.
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

/** Never waits for a reply: `runtime.reload()` tears down the worker that would send it. */
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

/** Read off disk rather than composed, so the directory naming stays the config's to decide. */
function outputDirectory({ browser, isDev }) {
  const outputRoot = join(PROJECT_ROOT, ".output");
  if (!existsSync(outputRoot)) {
    return null;
  }

  const buildDirectoryName = readdirSync(outputRoot)
    .find(name => name.startsWith(`${browser}-`) && name.endsWith("-dev") === isDev);

  return buildDirectoryName ? join(outputRoot, buildDirectoryName) : null;
}

export function devOutputDirectory(browser) {
  return outputDirectory({
    browser,
    isDev: true
  });
}

export function buildOutputDirectory(browser) {
  return outputDirectory({
    browser,
    isDev: false
  });
}
