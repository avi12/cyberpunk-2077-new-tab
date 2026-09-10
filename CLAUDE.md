# Stack

- pnpm
- WXT extension framework
- Svelte 5 (runes; the new tab page and the background script)
- TypeScript (100% type safety, let TypeScript infer return types - never write them explicitly)
- zod for every payload that crosses the extension boundary
- @webext-core/messaging for message passing
- Chrome, Edge, Opera and Firefox, all MV3 - there is no MV2 build of anything
  - Two builds, not four: Chrome, Edge and Opera all install the Chromium one, and Opera has no
    target of its own. Firefox is the only separate build, and every Firefox script passes `--mv3`
  - Single shared code path; branch only when an API genuinely diverges
  - The manifest is a function of `browser` in `wxt.config.ts`: `identity` and `identity.email` are
    Chromium-only, so Firefox's manifest omits them
  - No `oauth2` manifest key - Edge does not support it

# Code style

- Use the `browser` namespace
- Use early returns for readability and maintainability
- Use functional programming
- Use async/await whenever possible
- Use DRY with separation of concerns, prioritizing readability
- Minimize indentations
- Use `for-of` instead of `.forEach`, and a plain `for` loop instead of `.reduce()`
- Use modern browser and CSS features
- Avoid `window.` prefixes unless it increases readability
- Avoid `setTimeout` unless absolutely necessary
- Avoid comments unless absolutely necessary - prefer descriptive names; default to zero comments
  and rename variables/functions until they read like the comment would. Where one still earns its
  place, it says *why*, never what
- Don't use em dashes - use regular hyphens
- If a callback arrow function has a typed param, don't annotate the type explicitly
- Avoid nested try/catch - flatten with early returns or extracted functions
- Apply parallel modifications whenever possible
- A function taking 2+ parameters takes a destructured object instead, so every argument is
  self-documenting at the call site. Reuse an existing/built-in type when one fits the object shape;
  only inline the object type when nothing fits - never invent a named type just to convert.
  EXEMPT (stay positional): key/value-style accessors where the first argument is a key/identifier
  and the second its value/operation/options, and framework/runtime-positional signatures the caller
  does not control (HOF callbacks `.map`/`.filter`/`.sort`/`.forEach`/`addEventListener`, Promise
  executors, event handlers whose first parameter is `e`, `browser.*` listener callbacks, Svelte
  snippet/action/lifecycle parameters, external-library-dictated signatures)
- Validate loose data with zod, not hand-rolled checks: any multi-clause shape/range/format
  validation (typeof chains, `"x" in obj` guards, `Number.isFinite` + bounds combos, ad-hoc regex
  format tests on external/storage/message payloads) becomes a module-level zod schema +
  `safeParse`. Bounds always come from the existing `SCREAMING_SNAKE_CASE` constants via
  `.min()`/`.max()`; reuse an existing schema before authoring one; a schema consumed only for its
  inferred type stays un-exported. Import `z` from `@/lib/zod`. NOT zod material: single trivial
  checks, TS union narrowing of already-typed values, hot-loop arithmetic guards
- `safeParse` results take exactly two forms, chosen by what is consumed. Validity only: collapse
  immediately - `schema.safeParse(x).success` inline in the condition or into an `is`-prefixed
  boolean; never store the result object just to read `.success`. `.data`/`.error` consumed: store
  the result as `parsed` (`parsed<Subject>` when one scope holds several parses) and guard with
  `parsed.success` - never name it `result`/`<x>Parse`
- Inline one-off variables (assigned once, used once) when it stays readable - but NOT when the
  variable names a magic number/string or documents an otherwise opaque expression
- Extract an `if`/ternary/guard condition into a descriptive `is`-prefixed boolean variable rather
  than inlining the raw expression into the condition - the named boolean reads as the documentation
- Always prefer the `@` path alias over parent-relative (`../`) imports - `@/lib/foo` reads as an
  absolute anchor and survives file moves. Same-directory `./foo` stays relative

# Naming conventions

- Variables and functions: `camelCase`, full words (no abbreviations)
- Module-level constants: `SCREAMING_SNAKE_CASE`
- Exception: event handler first parameter is always `e`

## Variable prefixes

- Element: `el` prefix (e.g. `elButton`)
- Index: `i` prefix (e.g. `iItem`), or bare `i` when iterating in a for loop/higher-order function
- Boolean: `is` prefix (e.g. `isLoading`), phrased positively (e.g. `isEnabled`, not `isDisabled`
  or `isNotEnabled`)

# Hardcoded values

- Strings: use enums; if no enum fits, use a descriptive `SCREAMING_SNAKE_CASE` constant
- Numbers: use a descriptive `SCREAMING_SNAKE_CASE` constant
- An enum's string values are the persisted contract - never rename one without a migration

# Icons

- Individual `.svg` files (so they render in the IDE preview), imported via `?raw` and rendered with
  `{@html}`. `fill="currentColor"` and a shared `viewBox`; size and colour come from the container
  via CSS and `currentColor`, never baked in
- A per-icon `.svelte` component ONLY when an icon genuinely needs dynamic/animated internal values
  or colours (not size)

# Svelte

- Single-use functions: inline them
- Event handlers used in exactly one place: inline them as an arrow function in the template
  (`onclick={() => ...}`) instead of declaring a named function
- Flow-gating buttons use both `disabled={!condition}` (UX) AND a guard in the handler, so HTML
  manipulation cannot bypass the gate. Reuse the existing `$derived` condition to keep it DRY
- `@attach` arrow functions in templates: extract to named functions in the script block
- No ternaries inside `$derived` - use `$derived.by` with early returns

# HTML

- Semantic elements only: `<form>` with a submit button over a click handler, `<fieldset>`/`<legend>`
  around a group, visible `<label>`s over placeholders, `<header>`/`<footer>`/`<section>`
- Overlays belong in the top layer: `<dialog>` with `showModal()`, `popover` for menus, positioned
  with CSS anchor positioning - never a hand-rolled outside-click listener or a z-index ladder
- Never the `title` attribute - a hint is `data-tooltip="..."`, which the `[data-tooltip]` rule in
  `src/app.css` draws as the trigger's own `::after`, and the accessible name is `aria-label`

# CSS

- Nesting over repeated selectors - nest child and state selectors under their parent (`&:hover`, a
  nested `.child`) instead of repeating the parent in flat sibling rules
- Always respect `prefers-reduced-motion` - never ship an ungated transition/animation. `src/app.css`
  carries the blanket CSS override; a JS/Svelte transition is not covered by it and has to read
  `prefersReducedMotion()` and collapse its duration to 0
- Never hand-write vendor prefixes (`-webkit-` etc.) - author the unprefixed standard only
- Individual `translate` / `scale` / `rotate`, never the `transform` shorthand
- Durations in `ms`, never `s`
- No non-standard selectors (`::-webkit-scrollbar`, `::-webkit-inner-spin-button`,
  `::-webkit-details-marker`)
- One token set is the source of truth; a theme redefines tokens, it does not override rules

# Locale

- `Intl` formats anything a locale decides: times, dates, numbers, units. Never hand-write a day
  period, a degree sign, or a padded hour

# Storage

- Don't automatically persist to storage - rely on fallback values; only use storage when the user
  has explicitly set something
- Use WXT's storage API (`storage.defineItem`, `storage.getItem`, `storage.setItem`), never
  `browser.storage.local.*`
- Only the `local:` or `sync:` areas, never `session:` - Firefox has no session area, so any
  load-bearing or cross-browser state must live in `local:`
- The absence of a stored value is the "automatic" mode; never add a second flag that can disagree
  with it

# UI copy

- No full stops at end of messages
- Informal tone

# Linting

After each modification, lint with oxlint, ESLint, Stylelint, svelte-check, and fallow:

```bash
pnpm lint && pnpm stylelint && pnpm svelte:check && pnpm fallow
```

- `pnpm fallow` is `fallow audit --base HEAD`: the incremental gate, scoped to what this change
  actually touched. Bare `fallow audit` compares against the far merge-base instead and reports the
  whole branch's accumulated work as though this change caused it
- `pnpm fallow:all` is the full sweep, for when something has been removed and the orphans it left
  behind are in files this change never opened
- After every bug fix, feature or refactor - anything that removes or rewires code - act on what it
  flags as newly unused (imports, helpers, exports, whole files) so a change never leaves orphans.
  Never run `fallow fix` to do it automatically
- `svelte:check` runs with `--tsgo`, which type checks through TypeScript 7 while `typescript` stays
  pinned at 6 for typescript-eslint, which does not support 7 yet. It transpiles components into
  `.svelte-check/` on the way, which is why every linter ignores that directory

# Dev server

Never build - the dev server is always running and reloads the extension on any change under `src/`.
Only run a build when explicitly asked.

`pnpm ext:dev:hmr` (`scripts/dev.mjs`) keeps the dev browser alive across rebuilds and exposes CDP on
port 9223, so the new tab can be driven and screenshotted while it runs.

# Companion app

The opposite rule to the extension's: `companion/` has no watcher, so a change there is not running
anywhere until it is built. After **any** edit under `companion/`, run `pnpm journeys` without being
asked - it stops the resident app, publishes the native build into `companion/bin/`, reconnects it to
Edge and starts it again. An edit left unbuilt means the tray, and the extension reading through it,
are still answering with the last build.

Never leave the app stopped: the extension's Copilot section goes offline with it.

# Versioning

Both start at `0.0.1` and neither has shipped yet. Two versions, not one: the extension is versioned
in `package.json` and the companion in `companion/package.json`, each the only place its own build
reads, and each ships on its own.

**Never bump a version as part of ordinary work.** A version is only raised when that thing is
actually deployed, and only then - a fix, a feature and a refactor all leave it exactly where it is.

At a deploy, raise the version of what is being deployed: **patch** by default, **minor** where the
release carries something bigger than a fix. Nothing here decides that on its own - wait to be told
a deploy is happening.
