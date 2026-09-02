# Cyberpunk 2077 New Tab

A Cyberpunk 2077 themed new tab page: clock, search, quotes, netlinks seeded from your most-visited
sites, and drag-ordered widgets.

A ground-up rebuild of the [Cyberpunk 2077 Themed Homepage][original] extension on **WXT + Svelte 5**,
matching the original's visuals while replacing its React/Tailwind/dnd-kit stack.

[original]: https://chromewebstore.google.com/detail/cyberpunk-2077-themed-hom/dccdlniomlefbafjbonkmdnncabjenbk

## Getting started

```bash
pnpm install
pnpm ext:dev          # Chrome, with HMR (interactive terminal)
pnpm ext:dev:hmr      # same loop, detached - survives a closed terminal, CDP on :9223
pnpm ext:sideload     # open the built extension without a dev server
pnpm ext:build        # production build into .output/
pnpm ext:zip          # store-ready zip
pnpm icons:generate   # re-render src/public/icon/*.png from scripts/cyberpunk-logo.ico
pnpm key:generate     # mint keys/chrome.pem once, and write the permanent extension id
```

`ext:dev:hmr` exists because `wxt` shuts down when its stdin closes, which kills the browser the
moment a detached run rebuilds. It holds that pipe open, so an edit hot-updates the open tab and the
browser is never restarted - and the debugging port lets the chrome-devtools MCP drive the same
window.

Quality gates:

```bash
pnpm lint             # oxlint (logic) -> eslint --fix (style) -> oxlint (gate)
pnpm stylelint
pnpm svelte:check
pnpm fallow           # dead code, duplication, complexity
```

## Permissions

Six on Chrome, four on Firefox, and each backs one feature:

| Permission       | Why                                                                     |
| ---------------- | ----------------------------------------------------------------------- |
| `search`         | the "Default" search option runs the browser's own configured engine     |
| `topSites`       | seeds the netlinks grid on first run                                     |
| `geolocation`    | the weather's location, whenever it is following this device             |
| `storage`        | every setting, and the backup you can keep in your browser account       |
| `identity`       | "USE BROWSER ACCOUNT" names the greeting after the signed-in account     |
| `identity.email` | that address is the only name any browser API will hand over             |

The last two are Chrome-only: Firefox exposes the `identity` namespace without
`getProfileUserInfo`, so its manifest omits both and the button reports no account.

`nativeMessaging` is **optional** and Chromium-only: it is asked for only if you turn on Copilot
Journeys, so everyone else installs without ever seeing the prompt.

### Permanent extension id

The Chromium manifest carries a `key`, so the extension id is the same everywhere - unpacked, packed
as a CRX, or installed from a store. Without it the id is a hash of whatever folder the extension was
loaded from, and the Journeys companion has to name an origin that would then differ on every
machine. `pnpm key:generate` mints `keys/chrome.pem` (git-ignored; it signs release CRXs and nothing
else) and writes the public half to `companion/extension-identity.json`, which is the one place both
the manifest and the companion read it from.

Firefox has an id of its own in `browser_specific_settings`, for a different reason: it keys
`storage.sync` to the add-on id, so a build without one has no account area to back settings up to.

### Copilot Journeys (Edge on Windows)

Edge works out where your browsing is heading and writes the resulting cards into its own profile as
plaintext JSON - a feature it then only renders in some regions. The new tab shows them anyway, in
its own colours: title, summary, the sites the card was drawn from, and a button that opens Copilot
with the prompt Edge generated for it.

An extension cannot read a browser profile file, so the reading is done by
[a separate app](companion/README.md) that answers over native messaging - a paid Microsoft Store
add-on. The extension is complete without it: the section only exists on Edge for Windows, it can be
switched off like any other display element, and with the app absent it is one line saying so - one
that fills itself in a few seconds after the app arrives, with nothing reloaded or restarted.

The native call is made by the background script rather than the new tab, because `nativeMessaging`
is optional: a page that was already open when the permission is granted never receives the matching
API binding, while the background worker is restarted whenever permissions change.

Reading the cards afresh means snapshotting a database of tens of megabytes and takes about a quarter
of a second, which is long enough to watch, so the answer is cached for an hour. The section is on the
page as it opens rather than dropping in afterwards: placeholder cards hold the row the real ones
will occupy, so nothing below the section moves when they arrive. The first tab guesses that row
from type metrics and grows into the difference; every tab after it reserves the row the cards
actually came out at, remembered at the width it was measured, and moves nothing at all.

### Hover sounds

A card answers the cursor. Out of the box that answer is synthesised, not loaded: two oscillators
built on the spot, one modulating the other at an interval no instrument would pick, so it comes out
mechanical rather than musical - and a little different every time, which is what stops a row of
cards from sounding like a machine gun.

Drop an audio file on the terminal panel's Sound section and that plays instead. It is decoded once
when you pick it - a file the browser cannot read is refused there rather than failing silently on a
hover - and then kept in IndexedDB beside a custom background, in your browser only. Nothing is
bundled with the extension, so whatever you want a card to sound like is yours to bring.

The first sound of a page waits for its first click either way: a page nobody has touched is not
allowed to make one.

### Browser account name

No browser API hands over a name:
[`identity.getProfileUserInfo`](https://developer.chrome.com/docs/extensions/reference/api/identity#method-getProfileUserInfo)
answers with an email address and an account id, and that is the whole of it - the Chromium team has
[said the same](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/QN_wvxn5Aiw) about
reading the profile name. Chrome's OAuth route would give the account's real `given_name`, but it
needs an `oauth2` key in the manifest, which Edge does not support, and an OAuth client that can only
be created by hand in the Google Cloud console.

So the name is read out of the address instead, minus the digits people add to claim one that was
taken: `jane.doe@...` becomes `Jane Doe`, `avi6106@...` becomes `Avi`. A local part that is nothing
but digits is left as it is, and a browser with no signed-in account says so.

No host permissions: open-meteo, timeapi, allorigins and bigdatacloud all answer with
`Access-Control-Allow-Origin: *`, and an extension page follows ordinary CORS.

## Layout

```
src/
  app.css                  reset, theme tokens, cross-component effects (glitch, scan lines, tooltip)
  controls.css             shared control primitives (dialogs, inputs, buttons, option tiles)
  entrypoints/
    background.ts          topSites + default-engine search, over @webext-core/messaging
    newtab/                the page itself
  lib/
    icons/                 lucide path data (generated), the <svg> wrapper, the 40-icon picker list
    storage/               zod schemas -> defaults -> wxt/storage items -> a rune-backed store
    settings-file.ts       the settings snapshot, out to a file and back
    settings-sync.ts       the same snapshot, kept in the browser account instead
    sortable.ts            one pointer-driven reorder action, shared by all three drag lists
    sound.ts               the hover sound - one you bring, or a synthesised blip
    ...                    time, quotes, weather, geolocation, colour, search, top-sites, glitch
  components/
    netlinks/ widgets/ terminal/ modals/ journeys/
  public/
    icon/                  the toolbar/store PNGs and the terminal glyph the tab favicon uses
scripts/
  cyberpunk-logo.ico       the brand mark, the one source every icon size is scaled from
  generate-icons.mjs       renders src/public/icon/*.png from cyberpunk-logo.ico
  generate-key.mjs         mints the keypair behind the permanent extension id
companion/                 the paid Store app that reads Edge's journeys (its own README)
```

### How it differs from the original

- **No Tailwind.** The original themed itself with roughly 120 `!important` overrides per theme. Here
  one custom-property set on `.cyberpunk-container` is the source of truth and each alternate theme
  redefines only the tokens that differ. Two effects (`border-glitch`, `hover-glitch`) genuinely vary
  in step count between themes and keep per-theme keyframes.
- **No `@dnd-kit`.** The category list, each bookmark grid and the widget list are the only drag
  targets, and they only need reordering - `lib/sortable.ts` covers all three in ~180 lines.
- **Semantic HTML.** `<main>`, `<nav>`, `<section>`, `<article>`, `<blockquote>`/`<cite>`,
  `<time datetime>`, `<dialog>` for modals and `<details>` for the Terminal Display sections, in
  place of the original's divs and hand-rolled overlays.
- **Netlinks seed from `chrome.topSites`** on first run instead of six hardcoded example bookmarks.
  Sites keep the lucide-glyph look via a domain-to-icon table rather than fetching real favicons.
- **Closed value sets are enums** (`ColorTheme`, `ScanLinesMode`, `WidgetType`, `BackgroundMediaType`,
  `SearchEngineId`, `BookmarkCategory`), and their string values are the persisted contract. They sit
  in `lib/storage/schema.ts` beside the zod schema of every stored shape, which is where the types
  come from too - so the check an imported file has to pass is the one the compiler already enforces,
  never a second description of it. Import is all or nothing and names the key it choked on, and
  display preferences carry their defaults in the schema, so a file that predates an element still
  reads and that element comes back on.
- **Storage is `wxt/storage`**, so it is async; `lib/storage/settings.svelte.ts` wraps it in runes so
  components still read and write synchronously. The tab title is mirrored into `localStorage` purely
  as a paint-time cache, since extension storage cannot answer before the first frame.
- **Settings back up to the browser account.** The original could only write a file. System Settings
  still exports one, and now also puts the same snapshot in `storage.sync` on request, so a reinstall
  or a second machine picks it up with nothing to carry. That area holds about 100KB, and 8KB per
  value, so the snapshot goes in as numbered slices with one record saying how many there are and
  when they were taken. Only ever on request: a mirror that followed every change would spend the
  area, and the browser's hourly write allowance, on typing in the scratch pad.
- **The weather follows the device by default.** The original shipped San Francisco's coordinates
  under the name "Night City" and only ever moved if you typed new ones. Here the widget reads the
  device position through the extension's own `geolocation` permission on each load and stores
  nothing, falling back to Night City when there is no fix. Its location line opens a form holding the
  two sources side by side: "Follow my location" keeps reading the device, and confirming a latitude
  and longitude pins those instead. Whichever one the widget is reading is lit and the other is
  dimmed, though both stay usable; a stored location *is* the override, so following the device again
  clears it.
- **No world clock, and no hand-written AM/PM.** The header clock is the only clock, and `Intl`
  formats it - which day period the locale uses, and whether it has one at all - as it formats the
  temperature's degree sign and unit. A fresh install starts on whatever hour cycle the locale
  reports; the toggle still overrides it.
- **Dropdowns are popovers.** The engine list, the icon pickers and the Terminal Display panel use
  `popover="auto"` with CSS anchor positioning, so opening, Escape and click-outside dismissal come
  from the browser instead of a document-level listener.

Custom background image/video blobs still live in IndexedDB under the original's database name, so an
existing user's uploaded background survives the switch.

## Licence

MIT
