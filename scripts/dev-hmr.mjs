/**
 * The hot half of the Firefox loop: a dev-only build of the new tab's component tree, written into
 * the extension itself.
 *
 * Firefox MV3 refuses remote code and a dev server is remote code, which is why this project serves
 * nothing on that engine - see `isServedByDevServer` in `dev.mjs`. What that ruled out was a dev
 * server, and what it was read as ruling out was hot reload. Those are not the same thing. An
 * extension page may import its own `moz-extension://` modules, and a module re-imported under a
 * fresh query string is a fresh module - measured in the dev browser before any of this was
 * written. So the modules live in the build and only the word "changed" travels over a socket.
 *
 * Two traps sit between that idea and a working build, and both are why this compiles Svelte by
 * hand rather than through the plugin:
 *
 * - `vite-plugin-svelte` force-disables `compilerOptions.hmr` whenever it is building rather than
 *   serving, so the components would come out cold. `svelte.compile` is called directly instead.
 * - Vite replaces `import.meta.*` with `undefined` in a build, which would delete the very hook the
 *   compiler just emitted. The token is rewritten to a local const before Vite ever sees the code.
 *
 * The shipped build is untouched by any of this: this writes beside it, and only in dev.
 */

import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import {
  dirname,
  join,
  relative,
  resolve,
  sep
} from "node:path";
import { fileURLToPath } from "node:url";
import { compile, compileModule, preprocess } from "svelte/compiler";
import { build, transformWithOxc } from "vite";

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_DIRECTORY = join(PROJECT_ROOT, "src");

/** Where the hot modules land, beside the shipped build rather than inside it. */
export const HMR_DIRECTORY = "newtab-hmr";

/**
 * What the page calls to get a module its hot hook can talk to. Spelled the same on both sides, and
 * exported for the third reader - the reload client, which is what tells it a module changed.
 */
export const HOT_REGISTRY = "__cpHmr";

/** The local const `import.meta.hot` becomes, since the token itself cannot survive a build. */
const HOT_CONTEXT = "__cpHotContext";

/**
 * The entry, kept virtual so the source tree gains nothing for a dev-only feature.
 *
 * It is the page's own entry and nothing else - the same module the shipped build runs, compiled
 * against this build's Svelte instead of that one's. Anything else would be a second boot to keep in
 * step with the first: the cached tab title, the beacon and the mount all live there, and a dev page
 * that mounted `App` itself would quietly stop matching the page being developed.
 */
const ENTRY_SPECIFIER = "cp:hmr-entry";
const ENTRY_ID = `\0${ENTRY_SPECIFIER}`;

/**
 * WXT's auto-import module, which only its own plugin knows how to resolve - without it the build
 * reaches for the type declaration and finds no `storage` to import. The two names the new tab's
 * graph actually uses are re-exported from the packages WXT would have pointed them at; the two it
 * does not (`defineBackground`, `defineUnlistedScript`) belong to entrypoints this build never
 * reaches, so naming them here would only invite them in.
 */
const WXT_IMPORTS_ID = "#imports";

const WXT_IMPORTS_CODE = [
  `export { browser } from "wxt/browser";`,
  `export { storage } from "wxt/utils/storage";`
].join("\n");

/*
 * Imported rather than mounted, and dynamically rather than statically: `sideEffects` in
 * `package.json` names only `*.css`, so a bare `import "main.ts"` is a module Rollup is entitled to
 * drop - and it does, leaving an entry chunk that is literally empty. A dynamic import is a chunk
 * boundary rather than a reference, so nothing can shake it out.
 */
const ENTRY_CODE = `await import("@/entrypoints/newtab/main.ts");`;

/**
 * The client's path in the repository, which `preserveModules` reproduces inside the graph - so this
 * build's input and the page's entry tag are one string said once.
 */
const CLIENT_SOURCE_PATH = "scripts/dev-hmr-client.js";

/** What the built page is pointed at instead of its own bundle, for as long as a graph is there. */
export const HOT_CLIENT_PATH = `${HMR_DIRECTORY}/${CLIENT_SOURCE_PATH}`;

const sveltePreprocessor = vitePreprocess({ script: true });

/** Stable across rebuilds and identical on both sides of the socket, so a change can be named. */
export function hotModuleId(repoRelativePath) {
  return repoRelativePath.replaceAll(sep, "/");
}

/**
 * Whether a change is one the page can take without reloading.
 *
 * Components only, because `hmr: true` wraps those and nothing else: a store or a plain module is
 * compiled into the graph with no hook to hand a new copy to. This is the cheap half of the answer
 * rather than the whole of it - the page is asked too, and a swap it cannot apply is answered
 * `false` so the loop can fall back to a reload.
 */
export function isHotModule(repoRelativePath) {
  return repoRelativePath.endsWith(".svelte");
}

/**
 * Compiles Svelte with the hot hook on, then takes the hook's name out of Vite's reach.
 *
 * `css: "injected"` keeps each component's styles in its own module rather than extracting them to
 * a file nothing would re-fetch - which is what lets a style edit swap as cheaply as a markup one.
 */
function svelteHotPlugin() {
  return {
    name: "cp-svelte-hmr",
    async transform(code, id) {
      const isRuneModule = id.endsWith(".svelte.ts") || id.endsWith(".svelte.js");
      if (isRuneModule) {
        /*
         * Runes at module scope - the settings stores are all like this - need Svelte's own module
         * transform, or `$state` throws `rune_outside_svelte` the moment the page loads. Vite has
         * not stripped the TypeScript yet at this point, so that happens here.
         */
        const script = id.endsWith(".ts")
          ? (await transformWithOxc(code, id, { lang: "ts" })).code
          : code;
        const compiled = compileModule(script, {
          filename: id,
          generate: "client",
          dev: true
        });

        return {
          code: compiled.js.code,
          map: compiled.js.map
        };
      }

      if (!id.endsWith(".svelte")) {
        return null;
      }

      const processed = await preprocess(code, sveltePreprocessor, { filename: id });
      const { js } = compile(processed.code, {
        filename: id,
        generate: "client",
        dev: true,
        hmr: true,
        css: "injected"
      });
      const rewritten = js.code.replaceAll("import.meta.hot", HOT_CONTEXT);
      const moduleId = JSON.stringify(hotModuleId(relative(PROJECT_ROOT, id)));

      return {
        code: `const ${HOT_CONTEXT} = globalThis.${HOT_REGISTRY}.hotContext(${moduleId});\n${rewritten}`,
        map: js.map
      };
    }
  };
}

/** The two modules this build has to conjure: its own entry, and the one WXT would have resolved. */
function virtualModulesPlugin() {
  /** What a source file may write, against what the graph holds it under. */
  const specifiers = {
    [ENTRY_SPECIFIER]: ENTRY_ID,
    [WXT_IMPORTS_ID]: WXT_IMPORTS_ID
  };
  const modules = {
    [ENTRY_ID]: ENTRY_CODE,
    [WXT_IMPORTS_ID]: WXT_IMPORTS_CODE
  };

  return {
    name: "cp-hmr-virtual",
    /*
     * Ahead of Vite's own resolution, and that is the whole reason this is `pre`: the project's
     * tsconfig maps `#imports` to a type declaration, which resolves first and then exports no
     * runtime `storage` for anything to import.
     */
    enforce: "pre",
    resolveId(id) {
      return specifiers[id] ?? null;
    },
    load(id) {
      return modules[id] ?? null;
    }
  };
}

/**
 * Builds the hot graph into `outputDirectory/newtab-hmr`.
 *
 * One file per module and no hashes in the names, because a changed module has to be nameable from
 * the outside: the loop sends an id and the page re-imports that one path. Minifying is off for the
 * same reason a source map is on - this is only ever read by a browser that is being worked in.
 */
export async function buildHotGraph({ outputDirectory }) {
  const outDir = join(outputDirectory, HMR_DIRECTORY);

  await build({
    root: PROJECT_ROOT,
    configFile: false,
    logLevel: "error",
    /*
     * Relative, because this graph is loaded from a subdirectory of the extension rather than from
     * its root. Left absolute, Vite writes the stylesheet preloads as `/assets/...` and the page
     * resolves them against `moz-extension://<id>/` - one directory above where they were written,
     * where the first import fails on a stylesheet that is not there.
     */
    base: "./",
    define: {
      /* The client asks the runtime for its own directory, and this is where that name comes from. */
      __CP_HMR_DIR__: JSON.stringify(HMR_DIRECTORY),
      /*
       * What WXT's own plugin would have set, said again because this build does not have it. Left
       * out, every one of them reads `undefined`: the right answer for two of them by accident, and
       * the wrong one for `FIREFOX` on the only engine that ever loads this graph. A Firefox-only
       * branch would then be dead in the hot page and live in the built one, which is exactly the
       * kind of difference this mechanism exists to stop.
       */
      "import.meta.env.BROWSER": JSON.stringify("firefox"),
      "import.meta.env.CHROME": "false",
      "import.meta.env.EDGE": "false",
      "import.meta.env.FIREFOX": "true"
    },
    resolve: {
      alias: {
        "@": SOURCE_DIRECTORY
      }
    },
    plugins: [virtualModulesPlugin(), svelteHotPlugin()],
    build: {
      outDir,
      emptyOutDir: true,
      minify: false,
      sourcemap: true,
      target: "firefox139",
      /*
       * Nothing is shaken out of a graph that exists to be swapped into. `sideEffects` in
       * `package.json` names only `*.css`, which is true of a build with real entries and a lie
       * here: the page's entry is reached through an import, so Rollup is entitled to drop its body
       * outright - and it does, leaving a `main.js` of three comments and no mount at all.
       */
      rollupOptions: {
        treeshake: false,
        /*
         * The client is the input rather than the entry, and the entry only reachable through it:
         * every hot module registers itself as it evaluates, so the registry has to exist before
         * the graph is touched. The client is what guarantees that ordering.
         */
        input: join(PROJECT_ROOT, CLIENT_SOURCE_PATH),
        preserveEntrySignatures: "allow-extension",
        output: {
          format: "es",
          preserveModules: true,
          preserveModulesRoot: PROJECT_ROOT,
          entryFileNames: "[name].js",
          chunkFileNames: "[name].js"
        }
      }
    }
  });

  return outDir;
}
