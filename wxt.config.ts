import extensionIdentity from "./extension-identity.json";
import { CDP_PORT } from "./scripts/browser.mjs";
import { defineConfig } from "wxt";

/**
 * Copilot Journeys and tips are read through the companion app over native messaging, which only
 * Edge on Windows has. Optional so only the people who use it ever see the prompt.
 */
const COMPANION_PERMISSIONS = ["nativeMessaging"];

/**
 * Lets a Copilot tip that asks about the reader's own tabs or recent reading be answered, since the
 * destinations cannot see them the way Copilot inside Edge can. Optional and asked for by the card
 * that needs it, because it sends browsing off the machine. Chromium only: the tips come from the
 * companion, so Firefox has no card that could ask.
 */
const TIP_CONTEXT_PERMISSIONS = ["tabs", "history"];

/*
 * Deliberately no origin for reading page contents: matching Edge's own context (page text, not
 * just addresses) would cost `<all_urls>`, and Chromium refuses `permissions.request` for any origin
 * a wildcard does not already cover. So only the addresses go out.
 */

/**
 * The sites a prompt can be delivered to directly instead of via the clipboard. Duplicated from
 * `compose/sites.ts` because the manifest is built by Node before `src/` is bundled. Optional and
 * offered only when a prompt is sent somewhere that needs it. Chromium only, since the compose
 * script is not built for Firefox.
 */
const COMPOSE_ORIGINS = ["https://claude.ai/*", "https://copilot.com/*"];

/**
 * Google's own weather, read off its search page. Optional and asked for only when turned on in the
 * terminal panel - a refusal falls back to open-meteo. Chromium only: measured, Firefox never sends
 * the cookie jar the weather block depends on from an extension page, so the grant achieves nothing.
 */
const WEATHER_ORIGIN = "https://www.google.com/*";

const SHARED_PERMISSIONS = [
  "search",
  "topSites",
  "storage",
  "unlimitedStorage",
  "identity",
  // Types a prompt into Claude or Copilot via a script injected into the tab. Required rather than
  // optional: a worker that started before the grant could never use it.
  "scripting",
  "geolocation",
  // Keeps the companion's stored row current between new tabs - an MV3 worker cannot hold a timer.
  // No install warning on either engine; Firefox simply never uses it.
  "alarms"
];

/** Firefox ties `storage.sync` to the add-on id, so the backup needs it declared. Chromium uses `key`. */
const FIREFOX_ID = "cyberpunk-2077-new-tab@avi12.com";

/**
 * Required by Firefox for every new add-on since November 2025.
 *
 * `locationInfo` is required: the weather widget is on by default and sends coordinates to
 * bigdatacloud and open-meteo without asking first. `technicalAndInteraction` is the analytics,
 * which Firefox only allows as optional - `analytics/consent.ts` reads the reader's choice and
 * duplicates the string, since the manifest is built before `src/` is bundled.
 *
 * Not declared: search navigates the tab to the chosen engine, `compose.ts` is not built for
 * Firefox, and the Google sign-in result stays in the reader's browser.
 */
const DATA_COLLECTION = {
  required: ["locationInfo"],
  optional: ["technicalAndInteraction"]
};

/**
 * Chromium 144 is set by `Temporal`, a built-in with no polyfill here. Firefox 147 is set by CSS
 * anchor positioning (every tooltip and picker uses it, with no fallback), even though `Temporal`
 * landed in 139. `field-sizing` (Gecko 152) stays above the floor on purpose: without it the scratch
 * pad just scrolls. `position-anchor`'s MDN headline of 151 is about its initial value - explicit
 * names are the 125 / 147 row.
 */
const MINIMUM_CHROMIUM_VERSION = "144";
const MINIMUM_FIREFOX_VERSION = "147.0";

/**
 * The Chrome Web Store's public key pins the extension id to the published one
 * (`loeholjgiahjakohgpmglbhlfkhegccp`) in every build, so the companion app can allow exactly one
 * origin.
 */
const { publicKey } = extensionIdentity;

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: "src",
  // `wxt` still defaults Firefox to MV2; declaring it here means no command needs `--mv3`.
  manifestVersion: 3,
  // `srcDir` does not carry `publicDir` with it - that one still resolves against the project root.
  publicDir: "src/public",
  modules: ["@wxt-dev/module-svelte"],
  manifest: ({ browser }) => ({
    name: "Cyberpunk 2077 New Tab",
    description: "An immersive Cyberpunk 2077 themed homepage with dynamic and interactive elements!",
    // No `action` key on purpose: the extension is the new tab, so a toolbar button would duplicate
    // Ctrl+T. Nothing may touch `browser.action` while it is absent - even reading it kills the worker.
    //
    // `search` runs the browser's default engine; `topSites` seeds the netlinks on first run;
    // `storage` holds every setting and the account backup; `identity` is the greeting's "Use Google
    // account" button via `launchWebAuthFlow` alone - no `identity.email` (no email warning) and no
    // `oauth2` key (Edge ignores it). No host permissions at install, and the only later ones are
    // optional and Chromium's - allorigins, bigdatacloud, ipwho and open-meteo all send
    // `Access-Control-Allow-Origin: *`.
    //
    // `geolocation` is required because Chromium refuses to make it optional. Declared, Chromium
    // grants it to extension pages outright (measured), whereas the page-level prompt can be blocked
    // once and never raised again.
    permissions: SHARED_PERMISSIONS,
    ...(browser === "firefox"
      ? {
        // Firefox wants `author` as a string and rejects Chromium's object form, and vice versa.
        author: "avi12",
        browser_specific_settings: {
          gecko: {
            id: FIREFOX_ID,
            strict_min_version: MINIMUM_FIREFOX_VERSION,
            data_collection_permissions: DATA_COLLECTION
          }
        },
        permissions: SHARED_PERMISSIONS
      }
      : {
        author: {
          email: "avi6106@gmail.com"
        },
        key: publicKey,
        minimum_chrome_version: MINIMUM_CHROMIUM_VERSION,
        optional_permissions: [...COMPANION_PERMISSIONS, ...TIP_CONTEXT_PERMISSIONS],
        optional_host_permissions: [...COMPOSE_ORIGINS, WEATHER_ORIGIN]
      }),
    homepage_url: "https://avi12.com"
  }),
  vite: () => ({
    server: {
      watch: {
        // A locked file under `companion/` (MSBuild output, the running tray exe) makes chokidar emit
        // EBUSY and kills the dev server. Regexes, not globs: chokidar 4 reads a glob here as a
        // literal path.
        ignored: [/[\\/]companion[\\/]/]
      }
    }
  }),
  webExt: {
    // `scripts/dev.mjs` opens and keeps the browser itself, so it survives CLI restarts.
    disabled: process.env.WXT_DEV_OWNS_BROWSER === "true",
    // Pairs the dev browser with the chrome-devtools MCP server in .mcp.json.
    chromiumArgs: [`--remote-debugging-port=${CDP_PORT}`]
  },
  zip: {
    artifactTemplate: "cyberpunk-2077-new-tab-{{versionName}}-{{browser}}.zip",
    // An allowlist, so working-tree-only files (handoff notes, the companion app) never reach a
    // store upload. `scripts/browser.mjs` is here because this file imports it.
    includeSources: [
      "src/**",
      "scripts/browser.mjs",
      "wxt.config.ts",
      "extension-identity.json",
      "tsconfig.json",
      "package.json",
      "pnpm-lock.yaml",
      "pnpm-workspace.yaml",
      "README.md",
      "LICENSE"
    ]
  }
});
