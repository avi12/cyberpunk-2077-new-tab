/**
 * Firefox MV3 refuses a dev server, but an extension page may re-import its own `moz-extension://`
 * modules under a fresh query string. So the hot modules are built into the extension and only the
 * word "changed" travels over a socket.
 *
 * Svelte is compiled by hand because `vite-plugin-svelte` disables `hmr` when building, and Vite
 * replaces `import.meta.*` with `undefined` in a build, so `import.meta.hot` is rewritten first.
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

export const HMR_DIRECTORY = "newtab-hmr";

export const HOT_REGISTRY = "__cpHmr";

const HOT_CONTEXT = "__cpHotContext";

/** Virtual, and just the page's real entry, so there is no second boot to keep in step. */
const ENTRY_SPECIFIER = "cp:hmr-entry";
const ENTRY_ID = `\0${ENTRY_SPECIFIER}`;

/** Only WXT's own plugin resolves `#imports`, so the two names the new tab uses are re-exported. */
const WXT_IMPORTS_ID = "#imports";

const WXT_IMPORTS_CODE = [
  `export { browser } from "wxt/browser";`,
  `export { storage } from "wxt/utils/storage";`
].join("\n");

/* Dynamic, because `sideEffects` names only `*.css` and Rollup drops a bare static import. */
const ENTRY_CODE = `await import("@/entrypoints/newtab/main.ts");`;

const CLIENT_SOURCE_PATH = "scripts/dev-hmr-client.js";

export const HOT_CLIENT_PATH = `${HMR_DIRECTORY}/${CLIENT_SOURCE_PATH}`;

const sveltePreprocessor = vitePreprocess({ script: true });

export function hotModuleId(repoRelativePath) {
  return repoRelativePath.replaceAll(sep, "/");
}

/** Components only, because `hmr: true` wraps nothing else. */
export function isHotModule(repoRelativePath) {
  return repoRelativePath.endsWith(".svelte");
}

/** `css: "injected"` keeps styles in the component's module, so a style edit swaps too. */
function svelteHotPlugin() {
  return {
    name: "cp-svelte-hmr",
    async transform(code, id) {
      const isRuneModule = id.endsWith(".svelte.ts") || id.endsWith(".svelte.js");
      if (isRuneModule) {
        /* Module-scope runes need Svelte's module transform, or `$state` throws `rune_outside_svelte`. */
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

function virtualModulesPlugin() {
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
    /* Ahead of Vite, since tsconfig maps `#imports` to a type declaration with no runtime exports. */
    enforce: "pre",
    resolveId(id) {
      return specifiers[id] ?? null;
    },
    load(id) {
      return modules[id] ?? null;
    }
  };
}

/** One unhashed file per module, so the loop can name the one path the page re-imports. */
export async function buildHotGraph({ outputDirectory }) {
  const hotGraphDirectory = join(outputDirectory, HMR_DIRECTORY);

  await build({
    root: PROJECT_ROOT,
    configFile: false,
    logLevel: "error",
    /* Relative, because the graph lives in a subdirectory and `/assets/...` would miss it. */
    base: "./",
    define: {
      __CP_HMR_DIR__: JSON.stringify(HMR_DIRECTORY),
      /* What WXT's plugin would have set; left out, `FIREFOX` would read `undefined` on Firefox. */
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
      outDir: hotGraphDirectory,
      emptyOutDir: true,
      minify: false,
      sourcemap: true,
      target: "firefox139",
      /* `sideEffects` names only `*.css`, so tree shaking would drop the imported entry's body. */
      rollupOptions: {
        treeshake: false,
        /* The client is the input, so its registry exists before any hot module registers. */
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

  return hotGraphDirectory;
}
