/** To change the logo, replace `scripts/cyberpunk-logo.ico` and re-run `pnpm icons:generate`. */

import { encodePng, ICON_ARTWORK_RATIO, readLogo, renderLogo } from "./lib/logo.mjs";
import { ICON_DIR, LOGO_ICO } from "./lib/paths.mjs";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

/** 16 favicon, 24/32 toolbar at 1.5x/2x, 48 extensions page, 96 Firefox, 128 install prompt and store. */
const ICON_SIZES = [16, 24, 32, 48, 96, 128];

const source = readLogo(LOGO_ICO);
for (const size of ICON_SIZES) {
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
