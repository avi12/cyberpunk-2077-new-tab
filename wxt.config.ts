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
 * The one site a prompt can be finished off at, so it need not go by way of the clipboard. Spelled
 * out again here, and unavoidably: a manifest is built by Node before any of `src/` is bundled, so
 * `compose/sites.ts` cannot be the one that says it - only the one that has to agree with it.
 * Optional and never asked for at install: the reader is only offered it once the companion app has
 * actually answered, and a refusal costs only the typing.
 *
 * Beside `nativeMessaging` and for the same reason - the offer only ever follows a companion that
 * answered, and Firefox is never given the permission that lets one answer.
 *
 * It used to cost a `strict_min_version` as well, since Firefox only learned this key in 128, and
 * that was reason enough on its own. `Temporal` has since set the floor at 139 regardless, so that
 * half of the argument is spent: what keeps these off Firefox now is only that nothing there can
 * reach them.
 */
const COMPOSE_ORIGIN = "https://claude.ai/*";

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
    // no `oauth2` key, which Edge would not honour anyway. No host permissions - open-meteo,
    // allorigins, bigdatacloud and ipwho all answer with `Access-Control-Allow-Origin: *`, and
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
      // Typing a prompt into Claude, which is a script the background injects into the tab it
      // opened. Required rather than optional: an API binding is fixed when a context is created,
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
            strict_min_version: MINIMUM_FIREFOX_VERSION
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
        optional_host_permissions: [COMPOSE_ORIGIN, WEATHER_ORIGIN, PAGE_TEXT_ORIGIN]
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
