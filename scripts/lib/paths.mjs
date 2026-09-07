/**
 * Where the repo's fixed files live. A script that reads or writes one of them names it from here
 * rather than restating a path that another script already depends on.
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export const LOGO_ICO = join(REPO_ROOT, "scripts", "cyberpunk-logo.ico");
export const ICON_DIR = join(REPO_ROOT, "src", "public", "icon");
export const PRIVATE_KEY_PATH = join(REPO_ROOT, "keys", "chrome.pem");
export const IDENTITY_PATH = join(REPO_ROOT, "extension-identity.json");
