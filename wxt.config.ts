import extensionIdentity from "./extension-identity.json";
import { CDP_PORT } from "./scripts/browser.mjs";
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

/*
 * There is deliberately no origin here for reading the pages themselves.
 *
 * Edge's own context is not a list of links - reverse engineered from `msedge.dll`, `PageContext`
 * carries `inner_text` and `page_passages` beside the address - so a build that matched it would
 * send the words on the page rather than a way to reach them. Matching it costs `<all_urls>`, and a
 * wildcard is not a permission this extension asks for: Chromium refuses `permissions.request` for
 * any origin a wildcard does not already cover, so a page nobody can name in advance cannot be read
 * at all here. That is the whole of the trade, and the addresses go out on their own.
 */

/**
 * The sites a prompt can be finished off at, so it need not go by way of the clipboard. Spelled out
 * again here, and unavoidably: a manifest is built by Node before any of `src/` is bundled, so
 * `compose/sites.ts` cannot be the one that says them - only the one that has to agree with it.
 * Optional and never asked for at install: the reader is only offered one once they send a prompt
 * somewhere that needs it, and a refusal costs only the typing.
 *
 * Chromium only, because the script that uses them is not built for Firefox at all - so an origin
 * offered there could be granted and still reach nothing.
 *
 * It used to cost a `strict_min_version` as well, since Firefox only learned this key in 128, and
 * that was reason enough on its own. `Temporal` has since set the floor at 139 regardless, so that
 * half of the argument is spent: what keeps these off Firefox now is only that nothing there can
 * reach them.
 */
const COMPOSE_ORIGINS = ["https://claude.ai/*", "https://copilot.com/*"];

/**
 * Google's own weather, read off the search page it draws it on. Optional and asked for only by a
 * reader who turns it on, so the default install still reaches nothing but the open APIs it always
 * did - and a refusal costs the widget nothing, since it falls back to the one it was using.
 *
 * The one optional origin both engines are given, and the reason it is not filed with the rest:
 * everything else optional follows the companion, which is Edge on Windows alone, so Firefox has no
 * card that could ask. The weather widget is on every build and so is the switch that asks for this
 * - a Firefox left without the origin draws a switch that can only ever refuse to move.
 */
const WEATHER_ORIGIN = "https://www.google.com/*";

/**
 * Firefox ties `storage.sync` to the add-on's own id: a build without one has no account area to
 * write to, so the backup in System Settings needs this declared rather than assigned at listing
 * time. Chromium pins its id with `key` below instead.
 */
const FIREFOX_ID = "cyberpunk-2077-new-tab@avi12.com";

/**
 * What leaves the machine, said out loud. Firefox requires this of every new add-on from 3 November
 * 2025 and refuses the listing without it, so the only real decision is what goes in it.
 *
 * `none` was not available. The weather widget is on by default and works out a location on every
 * load, and those coordinates go to bigdatacloud to be given a name - a third party, reached without
 * asking anyone first. The name then goes to Google, which is the only thing that reads the sky
 * here, though that one is behind a site the reader hands over. Either way it is location data
 * leaving, so it is declared, and `required` is what "without asking first" means: nothing in the
 * page requests the first of those, so a reader cannot install without it.
 *
 * `technicalAndInteraction` is the counting, and Firefox only allows that one as optional - a reader
 * unticks it at install and `permissions.getAll().data_collection` says so afterwards, which
 * `analytics/consent.ts` already reads as a third way of being counted out. That file spells the
 * same string a second time and has to: a manifest is built by Node before any of `src/` is bundled.
 *
 * Deliberately absent, each for its own reason. The search bar hands a query to the chosen engine by
 * navigating the tab, which is the browser doing what its address bar does rather than this
 * gathering anything. The one script that does send typed text somewhere - `compose.ts`, into
 * claude.ai - is not built for Firefox at all. And the greeting's sign-in asks Google who the reader
 * is and writes the answer nowhere but their own browser, so nothing is collected there either.
 */
const DATA_COLLECTION = {
  required: ["locationInfo"],
  optional: ["technicalAndInteraction"]
};

/**
 * The oldest build that can run this, which is not decided by the same feature on both engines.
 *
 * Chromium is decided by `Temporal`, which shipped in 144: the clock, the freshness checks and every
 * stamp are written against it, and it is a built-in rather than something bundled, so a browser
 * without it has no polyfill to fall back on and fails at the first tick. Everything else here is
 * older - `position-area` 129, `anchor-name` 125, `field-sizing` 123 - so 144 is the whole of it.
 *
 * Gecko is decided by CSS anchor positioning, which landed in 147. `Temporal` was there from 139,
 * but every tooltip and both pickers are placed with `anchor-name` / `position-anchor` /
 * `position-area`, and there is no `@supports` fallback anywhere in `src/` - so on 139 to 146 this
 * installs, runs, and puts every hint in the wrong place, which is worse than not offering it. View
 * transitions want 144 too, though those merely stop animating.
 *
 * `field-sizing` is the one thing above this floor, at Gecko 152, and it stays above it: without it
 * the scratch pad keeps its `min-height` and scrolls rather than growing, which is a smaller loss
 * than five releases of readers.
 *
 * Both come from MDN's compatibility data, and `position-anchor` is read carefully: its headline
 * number is 151 on both engines, but that entry is about the property's initial value becoming
 * `normal`. Every use here passes an explicit `--name`, which is the 125 / 147 row.
 *
 * Declared rather than left open because the alternative is an install that looks fine and then does
 * not work: a store that knows the floor offers the reader nothing instead.
 */
const MINIMUM_CHROMIUM_VERSION = "144";
const MINIMUM_FIREFOX_VERSION = "147.0";

/**
 * Declaring the public key pins the Chromium extension id - the same one unpacked, packed as a CRX,
 * or installed from a store. The key is the Chrome Web Store's own for this item, so that id is
 * `loeholjgiahjakohgpmglbhlfkhegccp`, the published one: a development build and the download from
 * the store are the same extension as far as anything naming an origin is concerned, which is what
 * lets the companion app name exactly one.
 */
const { publicKey } = extensionIdentity;

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: "src",
  /**
   * There is no MV2 build of anything here, and this is what makes that true rather than a habit.
   *
   * `wxt` still defaults Firefox to MV2, so every Firefox command had to carry `--mv3` and a single
   * one left without it would build, install and zip an extension this project does not ship - with
   * a background page instead of an event page, `browser_action` instead of nothing, and optional
   * host permissions Firefox reads differently. Said once here, it cannot be forgotten at a call
   * site, and the flag is gone from all three Firefox scripts.
   */
  manifestVersion: 3,
  // `srcDir` does not carry `publicDir` with it - that one still resolves against the project root.
  publicDir: "src/public",
  modules: ["@wxt-dev/module-svelte"],
  manifest: ({ browser }) => ({
    name: "Cyberpunk 2077 New Tab",
    description: "An immersive Cyberpunk 2077 themed homepage with dynamic and interactive elements!",
    // No `action` key on purpose: the extension is the new tab, so a toolbar button would only
    // duplicate the one thing Ctrl+T already does. Nothing may touch `browser.action` while this is
    // absent - the API is not there to be called, and the read alone would kill the worker.
    //
    // One was tried, to give `captureVisibleTab` the `activeTab` a page click cannot grant, and to
    // anchor the `<all_urls>` prompt. Neither worked out: the screenshot draws the page itself now,
    // and `permissions.request` never resolved here with an action or without one.
    // `search` runs the browser's own default engine for the "Default" search option; `topSites`
    // seeds the netlinks on first run; `storage` holds every setting, local and the backup in the
    // browser account alike; `identity` is the greeting's "Use Google account" button, and it is
    // `launchWebAuthFlow` alone - no `identity.email`, so no "know your email address" warning, and
    // no `oauth2` key, which Edge would not honour anyway. No host permissions at install -
    // allorigins, bigdatacloud and ipwho all answer with `Access-Control-Allow-Origin: *`, and
    // Google's authorize page is opened in a window rather than fetched.
    //
    // Google's weather is the one address that does need declaring, and it is asked for at the
    // moment it is used. Where the reader is, though, is asked
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
      // Typing a prompt into Claude or Copilot, which is a script the background injects into the
      // tab it opened. Required rather than optional: a binding is fixed when a context is created,
      // so a worker that started before the grant could never reach it - the same trap the
      // companion's own permission documents. It carries no warning of its own; the site does.
      "scripting",
      "geolocation"
    ],
    ...(browser === "firefox"
      ? {
        /**
         * The one field the two engines disagree about the shape of. Chromium's MV3 `author` is an
         * object carrying an email; Firefox wants the name as a plain string and refuses the object
         * with "Expected string instead of {...}" - a warning on every install, and the field lost.
         * Neither accepts the other's, so each is handed its own.
         */
        author: "avi12",
        browser_specific_settings: {
          gecko: {
            id: FIREFOX_ID,
            strict_min_version: MINIMUM_FIREFOX_VERSION,
            data_collection_permissions: DATA_COLLECTION
          }
        },
        optional_host_permissions: [WEATHER_ORIGIN]
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
        // The dev server watches the project root, which sweeps in the companion's build output. A
        // locked artifact there - MSBuild holding `obj/**/*.dll`, or the tray app holding its own
        // `bin/*.exe` - makes chokidar emit EBUSY, and that kills the whole dev server rather than
        // skipping the one file. Nothing under `companion/` is bundled, so watching it buys
        // nothing and costs that.
        //
        // A mitigation rather than a fix: measured, a file that appears while the watcher is already
        // running still gets through. Anything held open for as long as it lives belongs outside the
        // project entirely - which is where the dev browser's profile went (`scripts/browser.mjs`).
        //
        // Regexes rather than globs: chokidar 4, which Vite 6 onwards ships, dropped glob support
        // in `ignored`, and a glob there is silently read as a literal path that matches nothing.
        ignored: [/[\\/]companion[\\/]/]
      }
    }
  }),
  webExt: {
    // `scripts/dev.mjs` opens the browser itself, so that one window survives the CLI restarts an
    // `.env` edit or a watcher crash forces - it sets this variable to say so. Plain `pnpm ext:dev`
    // does not, and goes on opening its own browser.
    disabled: process.env.WXT_DEV_OWNS_BROWSER === "true",
    // Pairs the dev browser with the chrome-devtools MCP server configured in .mcp.json, so the new
    // tab can be driven and screenshotted while `pnpm ext:dev` runs.
    chromiumArgs: [`--remote-debugging-port=${CDP_PORT}`]
  },
  zip: {
    artifactTemplate: "cyberpunk-2077-new-tab-{{versionName}}-{{browser}}.zip",
    // The companion app is distributed on its own, so it does not belong in a store upload.
    excludeSources: [
      ".output/**",
      ".wxt/**",
      ".fallow/**",
      "reference/**",
      "scripts/**",
      "companion/**"
    ]
  }
});
