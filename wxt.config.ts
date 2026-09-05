import extensionIdentity from "./companion/extension-identity.json";
import { defineConfig } from "wxt";

/**
 * Copilot Journeys and Copilot tips are read through the companion app over native messaging, and
 * only Edge files either of them under a profile. Optional rather than granted up front, so the
 * prompt only ever appears for the people the feature exists for - everyone else installs without
 * it, and Firefox never sees it at all.
 */
const COMPANION_PERMISSIONS = ["nativeMessaging"];

/**
 * What a Copilot tip asking about the reader is answered with. A quarter of Edge's catalogue asks
 * about their own tabs or their own recent reading, and Copilot inside Edge can see both without
 * asking - every destination this extension can reach cannot, so the context is read here and
 * written into the prompt.
 *
 * Optional, and asked for by the card that needs it rather than at install: this is the reader's
 * browsing leaving their machine, so nobody hands it over for a card they never press. Chromium
 * only, beside the companion's own permission and for the same reason - the tips come from the
 * companion, which only Windows and Edge have, so Firefox has no card that could ever ask.
 */
const TIP_CONTEXT_PERMISSIONS = ["tabs", "history"];

/**
 * Reading the pages themselves, which is the only way to answer the tips that ask about them.
 *
 * Reverse engineered from `msedge.dll`: Edge's own context is not a list of links. `PageContext`
 * carries `url`, `title`, `inner_text`, `tab_screenshot`, `pdf_data` and `page_passages`, and
 * `HistoryVisitItem` carries `page_title`, `page_url` and `passages` - so Copilot is handed the text
 * of what the reader read, cut into passages and ranked against the question by
 * `AnnotationReducerLiveTabResolverRequest { query, passage_context }`. A title cannot answer "pull
 * the key takeaways"; only the words on the page can.
 *
 * Edge has that access by being the browser. An extension has to ask, and this is the heaviest thing
 * it can ask for - so it is optional, requested by the card that needs it, and refusing drops back to
 * titles and addresses, which is what the previous build sent.
 */
const PAGE_TEXT_ORIGIN = "<all_urls>";

/**
 * The sites a prompt can be finished off at, so it need not go by way of the clipboard. Spelled out
 * again here, and unavoidably: a manifest is built by Node before any of `src/` is bundled, so
 * `compose/sites.ts` cannot be the one that says it - only the one that has to agree with it.
 * Optional and never asked for at install: the reader is only offered it once the companion app has
 * actually answered, and a refusal costs only the typing.
 *
 * Beside `nativeMessaging` and for the same reason - the offer only ever follows a companion that
 * answered, and Firefox is never given the permission that lets one answer. Declaring it there would
 * also drag a `strict_min_version` along, since Firefox only learned this key in 128, and lock older
 * readers out of the whole extension over a feature they could never reach.
 */
const COMPOSE_ORIGINS = ["https://copilot.microsoft.com/*", "https://claude.ai/*"];

/**
 * Google's own weather, read off the search page it draws it on. Optional and asked for only by a
 * reader who turns it on, so the default install still reaches nothing but the open APIs it always
 * did - and a refusal costs the widget nothing, since it falls back to the one it was using.
 */
const WEATHER_ORIGIN = "https://www.google.com/*";

/**
 * Where Edge itself gets the Copilot tips. Reverse engineered out of `msedge.dll`, which names the
 * endpoint in one string: Edge fetches this and writes the answer under the profile, which is the
 * file the companion app has been reading second-hand.
 *
 * Asking for it directly is the same read one step earlier - and it is a plain public GET, no
 * account, no Edge headers, so it works on a machine that has never run Edge. It carries no CORS
 * headers, so the origin is what makes the fetch possible at all: measured, without it the request
 * fails outright.
 */
const TIPS_ORIGIN = "https://edge.microsoft.com/*";

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
    // seeds the netlinks on first run; `storage` holds every setting, local and the backup in the
    // browser account alike; `identity` is the greeting's "Use Google account" button, and it is
    // `launchWebAuthFlow` alone - no `identity.email`, so no "know your email address" warning, and
    // no `oauth2` key, which Edge would not honour anyway. No host permissions - open-meteo,
    // timeapi, allorigins and bigdatacloud all answer with `Access-Control-Allow-Origin: *`, and
    // Google's authorize page is opened in a window rather than fetched.
    //
    // Google's weather is asked for at the moment it is used. Where the reader is, though, is asked
    // for here, at install, and has to be: `geolocation` is one of the permissions Chromium refuses
    // to make optional - requesting it produced "only permissions specified in the manifest may be
    // requested" at the click - so the only two choices are declaring it or going without.
    //
    // Going without is what this did, leaning on the prompt an extension page raises like any other
    // origin. That prompt can be answered "block", and once it has been the browser never raises it
    // again: the button goes dead for good, with nothing the page can do about it. Declared instead,
    // Chromium grants it to the extension's own pages outright - measured, `permissions.query` says
    // `granted` and the read returns a fix with no prompt at any point - which is a location that
    // works on the first press and cannot be locked out. The cost is one line at install.
    //
    // An offscreen document was tried and is not needed: it wants this very permission, and once
    // this is here the page can read the device itself.
    permissions: [
      "search",
      "topSites",
      "storage",
      "unlimitedStorage",
      "identity",
      // Typing a prompt into Copilot, which is a script the background injects into the tab it
      // opened. Required rather than optional: an API binding is fixed when a context is created,
      // so a worker that started before the grant could never reach it - the same trap the
      // companion's own permission documents. It carries no warning of its own; the site does.
      "scripting",
      "geolocation"
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
        optional_permissions: [...COMPANION_PERMISSIONS, ...TIP_CONTEXT_PERMISSIONS],
        optional_host_permissions: [...COMPOSE_ORIGINS, WEATHER_ORIGIN, TIPS_ORIGIN, PAGE_TEXT_ORIGIN]
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
