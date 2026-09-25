/**
 * The page's half of Firefox hot reload. Bundled into the dev build by `dev-hmr.mjs` and loaded by
 * the new tab in place of its normal mount; never part of a shipped build.
 *
 * Svelte's compiler does the hard part. With `hmr: true` it wraps every component in `$.hmr(...)`
 * and emits a self-accepting hook beside it:
 *
 *   Component = $.hmr(Component);
 *   import.meta.hot.accept((module) => Component[$.HMR].update(module.default));
 *
 * So each component is its own boundary and nothing here has to walk an import graph looking for
 * one. All this provides is the `import.meta.hot` that hook was compiled against - a place to keep
 * the callback - and the re-import that feeds it. The wrapper keeps the live instances; the update
 * swaps the implementation underneath them, which is why the state in them survives.
 */

/** Callbacks by module id, filled as each hot module runs its own top-level registration. */
const boundaries = new Map();

function hotContext(moduleId) {
  return {
    accept(callback) {
      boundaries.set(moduleId, callback);
    },
    /*
     * Present because the compiler's output may reach for them, and empty because a self-accepting
     * component needs neither: there is no state to carry across and nothing upstream to tell.
     */
    dispose() {},
    invalidate() {},
    data: {}
  };
}

/**
 * `src/x/Y.svelte` is emitted as `src/x/Y.js`, which is the whole of the mapping.
 *
 * Asked of the runtime rather than resolved against `import.meta.url`, and that is not a
 * preference: Vite reads `new URL(<template>, import.meta.url)` as an asset reference and rewrites
 * it to a lookup in a map it builds at compile time. With a path only known at runtime the map is
 * empty, the lookup is `undefined`, and every swap requests `.../undefined`. Measured, once.
 */
function moduleUrl(moduleId) {
  const path = moduleId.replace(/\.svelte$/, "").replace(/\.ts$/, "");

  return browser.runtime.getURL(`${__CP_HMR_DIR__}/${path}.js`);
}

/**
 * Swaps one module, and says whether it could.
 *
 * A module nobody accepted is one the compiler never made a boundary of - a plain `.ts`, a store,
 * the entry itself. There is nothing to patch there, so the caller is told no and reloads instead
 * of pretending.
 */
async function applyChange(moduleId) {
  const accept = boundaries.get(moduleId);
  if (!accept) {
    return false;
  }

  /* The query is what makes it a second module rather than the cached first one. */
  const fresh = await import(`${moduleUrl(moduleId)}?v=${Date.now()}`);
  accept(fresh);

  return true;
}

globalThis.__cpHmr = {
  hotContext,
  applyChange
};

/*
 * After the registry exists and not before: every module in the graph calls `hotContext` while it
 * is still evaluating, so the entry cannot be a static import of this file.
 */
const entry = await import("cp:hmr-entry");

entry.mountApp(document.querySelector("#app"));

globalThis.__cpHmr.remount = () => {
  entry.unmountApp();
  entry.mountApp(document.querySelector("#app"));
};
