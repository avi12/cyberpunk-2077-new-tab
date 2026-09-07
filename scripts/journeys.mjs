/**
 * The one entry point for every `pnpm journeys*` script, and the seam between the two halves of this
 * checkout.
 *
 * The extension is open and the companion app is not, so `companion/` is a separate private
 * repository that lives inside this one. Anybody who cloned the extension has no `companion/` at all
 * - which is the intended shape, not a broken checkout - and running one of these scripts should say
 * so in a sentence rather than throwing a module resolution error at them.
 *
 * Everything else about the companion stays behind that directory. This file knows only that it may
 * not be there.
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const COMPANION_DIR = join(REPO_ROOT, "companion");

/** Which of the companion's own scripts a command runs, since `package` is a different program. */
const SCRIPTS = {
  package: join(COMPANION_DIR, "packaging", "build.mjs"),
  default: join(COMPANION_DIR, "packaging", "companion.mjs")
};

const [command = "", ...rest] = process.argv.slice(2);

const isPackaging = command === "package";
const script = isPackaging ? SCRIPTS.package : SCRIPTS.default;
const forwarded = isPackaging ? rest : [command, ...rest].filter(Boolean);
if (!existsSync(script)) {
  console.info(
    [
      "The companion app is not part of this checkout.",
      "",
      "The extension is open source and complete on its own - the new tab works without the app, and",
      "shows one line where the Copilot cards would be. The companion is a paid Microsoft Store",
      "download, and its source is closed, so `companion/` is absent here by design.",
      "",
      "https://github.com/avi12/cyberpunk-2077-new-tab#companion"
    ].join("\n")
  );
  process.exit(0);
}

spawn(process.execPath, [script, ...forwarded], { stdio: "inherit" })
  .on("exit", code => process.exit(code ?? 0));
