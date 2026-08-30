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
pnpm icons:generate   # re-render public/icon/*.png from the terminal glyph
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
| `geolocation`    | the weather's automatic location, and "USE MY LOCATION" in either form  |
| `storage`        | every setting                                                           |
| `identity`       | "USE BROWSER ACCOUNT" names the greeting after the signed-in account     |
| `identity.email` | that address is the only name any browser API will hand over             |

The last two are Chrome-only: Firefox exposes the `identity` namespace without
`getProfileUserInfo`, so its manifest omits both and the button reports no account.

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
    storage/               defaults -> wxt/storage items -> a rune-backed settings store
    sortable.ts            one pointer-driven reorder action, shared by all three drag lists
    ...                    time, quotes, weather, geolocation, colour, search, top-sites, glitch
  components/
    netlinks/ widgets/ terminal/ modals/
scripts/
  generate-icons.mjs       renders public/icon/*.png from the terminal glyph
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
  `SearchEngineId`, `BookmarkCategory`), and their string values are the persisted contract.
- **Storage is `wxt/storage`**, so it is async; `lib/storage/settings.svelte.ts` wraps it in runes so
  components still read and write synchronously. The tab title is mirrored into `localStorage` purely
  as a paint-time cache, since extension storage cannot answer before the first frame.
- **The weather follows the device by default.** The original shipped San Francisco's coordinates
  under the name "Night City" and only ever moved if you typed new ones. Here the widget reads the
  device position through the extension's own `geolocation` permission on each load and stores
  nothing, falling back to Night City when there is no fix. Its location line opens the same override
  form the world clock uses, holding the two sources side by side: "Follow my location" keeps reading
  the device, and confirming a latitude and longitude pins those instead. Whichever one the widget is
  reading is lit and the other is dimmed, though both stay usable; a stored location *is* the
  override, so following the device again clears it.
- **Dropdowns are popovers.** The engine list, the icon pickers and the Terminal Display panel use
  `popover="auto"` with CSS anchor positioning, so opening, Escape and click-outside dismissal come
  from the browser instead of a document-level listener.

Custom background image/video blobs still live in IndexedDB under the original's database name, so an
existing user's uploaded background survives the switch.

## Licence

MIT
