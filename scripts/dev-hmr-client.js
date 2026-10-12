/**
 * With `hmr: true` Svelte makes every component a self-accepting boundary
 * (`import.meta.hot.accept(module => Component[$.HMR].update(module.default))`), so this only
 * provides that `import.meta.hot` and the re-import that feeds it. Live instances keep their state.
 */

const acceptCallbacksByModuleId = new Map();

function hotContext(moduleId) {
  return {
    accept(callback) {
      acceptCallbacksByModuleId.set(moduleId, callback);
    },
    /* The compiler's output may call these; a self-accepting component needs neither. */
    dispose() {},
    invalidate() {},
    data: {}
  };
}

/**
 * Not `new URL(path, import.meta.url)`: Vite rewrites that into a compile-time asset lookup, which
 * resolves a runtime path to `undefined`.
 */
function moduleUrl(moduleId) {
  const path = moduleId.replace(/\.svelte$/, "").replace(/\.ts$/, "");

  return browser.runtime.getURL(`${__CP_HMR_DIR__}/${path}.js`);
}

/** A module with no accept callback is not a component, so the caller reloads instead. */
async function applyChange(moduleId) {
  const accept = acceptCallbacksByModuleId.get(moduleId);
  if (!accept) {
    return false;
  }

  /* The query makes it a fresh module rather than the cached one. */
  const freshModule = await import(`${moduleUrl(moduleId)}?v=${Date.now()}`);
  accept(freshModule);

  return true;
}

globalThis.__cpHmr = {
  hotContext,
  applyChange
};

/* Dynamic and last, because every hot module calls `hotContext` while it evaluates. */
await import("cp:hmr-entry");
