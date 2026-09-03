/**
 * The `.env` keys, typed.
 *
 * Vite's own `ImportMetaEnv` carries a `[key: string]: any` index signature, so without this every
 * `import.meta.env.VITE_*` read is an untyped `any` that no lint pass will catch. Declaring the key
 * here narrows it to `string` and makes a typo a build error. Interface merging does the rest, so
 * this file must stay free of imports and exports - a module would not merge.
 *
 * Every key added to `.env.example` belongs here too. See that file for what this one is for.
 */
interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID: string;
  readonly VITE_GOOGLE_CLIENT_SECRET: string;
}
