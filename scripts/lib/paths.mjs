import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export const LOGO_ICO = join(REPO_ROOT, "scripts", "cyberpunk-logo.ico");
export const ICON_DIR = join(REPO_ROOT, "src", "public", "icon");
