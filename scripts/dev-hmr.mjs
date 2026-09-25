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
import { existsSync, rmSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compile, compileModule, preprocess } from "svelte/compiler";
import { build, transformWithOxc } from "vite";

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_DIRECTORY = join(PROJECT_ROOT, "src");

/** Where the hot modules land, beside the shipped build rather than inside it. */
export const HMR_DIRECTORY = "newtab-hmr";

/** What the page calls to get a module its hot hook can talk to. Spelled the same on both sides. */
const HOT_REGISTRY = "__cpHmr";

/** The local const `import.meta.hot` becomes, since the token itself cannot survive a build. */
const HOT_CONTEXT = "__cpHotContext";

/**
 * The entry, kept virtual so the source tree gains nothing for a dev-only feature. It mounts the
 * real `App` with this build's own Svelte instance and hands the page back a way to unmount, which
 * is what a full swap needs when a change lands somewhere HMR cannot patch.
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

const ENTRY_CODE = [
  `import App from "@/entrypoints/newtab/App.svelte";`,
  `import "@/app.css";`,
  `import "@/controls.css";`,
  `import { mount, unmount } from "svelte";`,
  `let app;`,
  `export function mountApp(target) {`,
  `  app = mount(App, { target });`,
  `}`,
  `export function unmountApp() {`,
  `  if (app) { unmount(app); app = undefined; }`,
  `}`
].join("\n");

const sveltePreprocessor = vitePreprocess({ script: true });

/** Stable across rebuilds and identical on both sides of the socket, so a change can be named. */
function toModuleId(id) {
  return relative(PROJECT_ROOT, id).replaceAll("\\", "/");
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
      const moduleId = JSON.stringify(toModuleId(id));

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
    /* The client asks the runtime for its own directory, and this is where that name comes from. */
    define: {
      __CP_HMR_DIR__: JSON.stringify(HMR_DIRECTORY)
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
      rollupOptions: {
        /*
         * The client is the input rather than the entry, and the entry only reachable through it:
         * every hot module registers itself as it evaluates, so the registry has to exist before
         * the graph is touched. The client is what guarantees that ordering.
         */
        input: join(dirname(fileURLToPath(import.meta.url)), "dev-hmr-client.js"),
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

/** A build that failed leaves nothing half-written for the page to import. */
export function clearHotGraph({ outputDirectory }) {
  const outDir = join(outputDirectory, HMR_DIRECTORY);
  if (existsSync(outDir)) {
    rmSync(outDir, {
      recursive: true,
      force: true
    });
  }
}
