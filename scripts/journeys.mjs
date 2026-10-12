/**
 * `companion/` is a private submodule, so a public clone has none - this says so in a sentence
 * instead of throwing a module resolution error.
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const COMPANION_DIR = join(REPO_ROOT, "companion");

const COMPANION_SCRIPTS = {
  package: join(COMPANION_DIR, "packaging", "build.mjs"),
  default: join(COMPANION_DIR, "packaging", "companion.mjs")
};

const [command = "", ...rest] = process.argv.slice(2);

const isPackaging = command === "package";
const script = isPackaging ? COMPANION_SCRIPTS.package : COMPANION_SCRIPTS.default;
const forwardedArguments = isPackaging ? rest : [command, ...rest].filter(Boolean);
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

spawn(process.execPath, [script, ...forwardedArguments], { stdio: "inherit" })
  .on("exit", code => process.exit(code ?? 0));
