/**
 * Narrows Vite's `any`-indexed env to the real `.env` keys. Must stay free of imports and exports so
 * interface merging applies. Keep in sync with `.env.example`.
 */
interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID: string;
  readonly VITE_GOOGLE_CLIENT_SECRET: string;
  readonly VITE_GA4_MEASUREMENT_ID: string;
  readonly VITE_GA4_API_SECRET: string;
}
