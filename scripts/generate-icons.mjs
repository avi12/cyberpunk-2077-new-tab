/**
 * Renders the extension icon set (`src/public/icon/*.png`) from `scripts/cyberpunk-logo.ico`, the
 * one file the brand mark lives in. Drop a new logo over that `.ico` and re-run
 * `pnpm icons:generate`; nothing else describes the mark.
 */

import { encodePng, readLogo, renderLogo } from "./lib/logo.mjs";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const SOURCE_ICO = join(SCRIPT_DIR, "cyberpunk-logo.ico");
const OUT_DIR = join(SCRIPT_DIR, "..", "src", "public", "icon");

/**
 * Chrome reads 16 for an extension page's favicon, 24 and 32 for the toolbar at 1.5x and 2x, 48 for
 * the extensions management page, and 128 for the install prompt and the Web Store listing. Firefox
 * asks for 96. WXT turns every `icon/<size>.png` here into the manifest's `icons` map, and Chrome
 * falls back to that map for the action, so the toolbar never has to rescale a mismatched frame.
 */
const SIZES = [16, 24, 32, 48, 96, 128];

/**
 * The Web Store wants 96px of artwork inside a 128px frame, the remaining 16px per side
 * transparent, so every listing tile carries the same optical weight. Holding one ratio across the
 * set keeps the mark the same size in the toolbar as in the store.
 */
const ARTWORK_RATIO = 96 / 128;

const source = readLogo(SOURCE_ICO);
for (const size of SIZES) {
  const file = join(OUT_DIR, `${size}.png`);
  writeFileSync(
    file, encodePng(
      renderLogo({
        source,
        width: size,
        height: size,
        artworkRatio: ARTWORK_RATIO
      })
    )
  );
  console.log(`wrote ${file}`);
}
