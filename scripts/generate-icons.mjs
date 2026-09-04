/**
 * Renders the extension icon set (`src/public/icon/*.png`) from `scripts/cyberpunk-logo.ico`, the
 * one file the brand mark lives in. Drop a new logo over that `.ico` and re-run
 * `pnpm icons:generate`; nothing else describes the mark.
 */

import { encodePng, ICON_ARTWORK_RATIO, readLogo, renderLogo } from "./lib/logo.mjs";
import { ICON_DIR, LOGO_ICO } from "./lib/paths.mjs";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Chrome reads 16 for an extension page's favicon, 24 and 32 for the toolbar at 1.5x and 2x, 48 for
 * the extensions management page, and 128 for the install prompt and the Web Store listing. Firefox
 * asks for 96. WXT turns every `icon/<size>.png` here into the manifest's `icons` map, and Chrome
 * falls back to that map for the action, so the toolbar never has to rescale a mismatched frame.
 */
const SIZES = [16, 24, 32, 48, 96, 128];

const source = readLogo(LOGO_ICO);
for (const size of SIZES) {
  const file = join(ICON_DIR, `${size}.png`);
  writeFileSync(
    file, encodePng(
      renderLogo({
        source,
        width: size,
        height: size,
        artworkRatio: ICON_ARTWORK_RATIO
      })
    )
  );
  console.log(`wrote ${file}`);
}
