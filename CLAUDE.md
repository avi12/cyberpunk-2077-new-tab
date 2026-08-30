# Stack

- pnpm
- WXT extension framework
- Svelte 5 (runes; the new tab page and the background script)
- TypeScript (100% type safety, let TypeScript infer return types)
- zod for every payload that crosses the extension boundary
- @webext-core/messaging for message passing
- Chromium (Chrome, Edge, Opera) MV3 + Firefox MV2
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
- Use `for-of` instead of `.forEach`
- Use modern browser and CSS features
- Avoid `window.` prefixes unless it increases readability
- Avoid `setTimeout` unless absolutely necessary
- Avoid comments unless absolutely necessary - prefer descriptive names. Where one earns its place,
  it says *why*, never what
- Don't use em dashes - use regular hyphens
- If a callback arrow function has a typed param, don't annotate the type explicitly
- Avoid nested try/catch - flatten with early returns or extracted functions
- Apply parallel modifications whenever possible
- A function taking 2+ parameters takes a destructured object instead

# Naming conventions

- Variables and functions: `camelCase`, full words (no abbreviations)
- Module-level constants: `SCREAMING_SNAKE_CASE`
- Exception: event handler first parameter is always `e`

## Variable prefixes

- Element: `el` prefix (e.g. `elButton`)
- Index: `i` prefix (e.g. `iItem`), or bare `i` when iterating in a for loop/higher-order function
- Boolean: `is` prefix (e.g. `isLoading`)

# Hardcoded values

- Strings: use enums; if no enum fits, use a descriptive `SCREAMING_SNAKE_CASE` constant
- Numbers: use a descriptive `SCREAMING_SNAKE_CASE` constant
- An enum's string values are the persisted contract - never rename one without a migration

# Svelte

- Single-use functions: inline them
- `@attach` arrow functions in templates: extract to named functions in the script block
- No ternaries inside `$derived` - use `$derived.by` with early returns
- Icons are individual `.svg` files, not a shared icon component

# HTML

- Semantic elements only: `<form>` with a submit button over a click handler, `<fieldset>`/`<legend>`
  around a group, visible `<label>`s over placeholders, `<header>`/`<footer>`/`<section>`
- Overlays belong in the top layer: `<dialog>` with `showModal()`, `popover` for menus and tooltips,
  positioned with CSS anchor positioning - never a hand-rolled outside-click listener or a z-index
  ladder

# CSS

- Nesting over repeated selectors
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

# Dev server

`pnpm ext:dev:hmr` (`scripts/dev.mjs`) keeps the dev browser alive across rebuilds and exposes CDP on
port 9223, so the new tab can be driven and screenshotted while it runs.
