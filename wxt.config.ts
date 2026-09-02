import extensionIdentity from "./companion/extension-identity.json";
import { defineConfig } from "wxt";

/** Chrome-only: Firefox's `identity` has no `getProfileUserInfo`. */
const IDENTITY_PERMISSIONS = ["identity", "identity.email"];

/**
 * Copilot Journeys are read through the companion app over native messaging, and only Edge on
 * Windows or macOS has any to read. Optional rather than granted up front, so the prompt only ever
 * appears for the people the feature exists for - everyone else installs without it, and Firefox
 * never sees it at all.
 */
const JOURNEYS_PERMISSIONS = ["nativeMessaging"];

/**
 * Firefox ties `storage.sync` to the add-on's own id: a build without one has no account area to
 * write to, so the backup in System Settings needs this declared rather than assigned at listing
 * time. Chromium pins its id with `key` below instead.
 */
const FIREFOX_ID = "cyberpunk-2077-new-tab@avi12.com";

/**
 * Declaring the public key pins the Chromium extension id - the same one unpacked, packed as a CRX,
 * or installed from a store. The companion app has to name an origin it will talk to, and without
 * this that origin would be a hash of whatever folder the extension was loaded from. The private
 * half lives in git-ignored `keys/`; regenerate both with `pnpm key:generate`.
 */
const { publicKey } = extensionIdentity;

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: "src",
  // `srcDir` does not carry `publicDir` with it - that one still resolves against the project root.
  publicDir: "src/public",
  modules: ["@wxt-dev/module-svelte"],
  manifest: ({ browser }) => ({
    name: "Cyberpunk 2077 New Tab",
    description: "An immersive Cyberpunk 2077 themed homepage with dynamic and interactive elements!",
    // No `action` key on purpose: the extension is the new tab, so a toolbar button would only
    // duplicate the one thing Ctrl+T already does. Nothing may touch `browser.action` while this is
    // absent - the API is not there to be called, and the read alone would kill the worker.
    // `search` runs the browser's own default engine for the "Default" search option; `topSites`
    // seeds the netlinks on first run; `geolocation` backs the "USE MY LOCATION" button in the
    // weather/world-clock location override; `storage` holds every setting, local and the backup in
    // the browser account alike; `identity` +
    // `identity.email` name the greeting after the signed-in account. No host permissions -
    // open-meteo, timeapi, allorigins, bigdatacloud and Google's userinfo endpoint all answer with
    // `Access-Control-Allow-Origin: *`.
    permissions: [
      "search",
      "topSites",
      "geolocation",
      "storage",
      "unlimitedStorage",
      ...(browser === "firefox" ? [] : IDENTITY_PERMISSIONS)
    ],
    ...(browser === "firefox"
      ? {
        browser_specific_settings: {
          gecko: {
            id: FIREFOX_ID
          }
        }
      }
      : {
        key: publicKey,
        optional_permissions: JOURNEYS_PERMISSIONS
      }),
    author: {
      email: "avi6106@gmail.com"
    },
    homepage_url: "https://avi12.com"
  }),
  webExt: {
    // Pairs the dev browser with the chrome-devtools MCP server configured in .mcp.json, so the new
    // tab can be driven and screenshotted while `pnpm ext:dev` runs.
    chromiumArgs: ["--remote-debugging-port=9223"]
  },
  zip: {
    artifactTemplate: "cyberpunk-2077-new-tab-{{versionName}}-{{browser}}.zip",
    // The companion app is distributed on its own, and `keys/` is the signing key - neither belongs
    // in a store upload.
    excludeSources: [
      ".output/**",
      ".wxt/**",
      ".fallow/**",
      "reference/**",
      "scripts/**",
      "companion/**",
      "keys/**"
    ]
  }
});
