/**
 * Mints (once) the keypair that gives this extension a permanent id, and writes the public half
 * where both sides read it from: `companion/extension-identity.json`.
 *
 * A Chromium extension's id is a hash of its public key. Loaded unpacked with no key, the id is a
 * hash of the folder path instead - different on every machine - and a native messaging host cannot
 * name an origin that keeps moving. Declaring the public key in the manifest pins the id everywhere:
 * unpacked, packed as a CRX, or installed from a store.
 *
 *   node scripts/generate-key.mjs          # mint if absent, then write the identity
 *   node scripts/generate-key.mjs --force  # mint a new keypair - this CHANGES the extension id
 *
 * `keys/chrome.pem` is the private half and is git-ignored: it signs release CRXs and nothing else.
 * The public half is not a secret - it ships inside every copy of the built manifest.
 */

import { createHash, createPublicKey, generateKeyPairSync } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const RSA_MODULUS_BITS = 2048;
const ID_ALPHABET_OFFSET = "a".charCodeAt(0);
const ID_LENGTH = 32;
const HEX_RADIX = 16;

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const privateKeyPath = join(repoRoot, "keys", "chrome.pem");
const identityPath = join(repoRoot, "companion", "extension-identity.json");

function mintPrivateKey() {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: RSA_MODULUS_BITS });
  mkdirSync(dirname(privateKeyPath), { recursive: true });
  writeFileSync(
    privateKeyPath, privateKey.export({
      type: "pkcs8",
      format: "pem"
    }), "utf8"
  );
}

/** Chromium's id: the first 128 bits of SHA-256 over the DER public key, hex mapped onto a-p. */
function extensionIdFrom(publicKeyDer) {
  const digits = createHash("sha256").update(publicKeyDer).digest("hex").slice(0, ID_LENGTH);

  return Array.from(
    digits, digit => String.fromCharCode(ID_ALPHABET_OFFSET + Number.parseInt(digit, HEX_RADIX))
  ).join("");
}

if (process.argv.includes("--force") || !existsSync(privateKeyPath)) {
  mintPrivateKey();
  console.log(`minted ${privateKeyPath}`);
}

const publicKeyDer = createPublicKey(readFileSync(privateKeyPath, "utf8")).export({
  type: "spki",
  format: "der"
});
const identity = {
  extensionId: extensionIdFrom(publicKeyDer),
  publicKey: publicKeyDer.toString("base64")
};
mkdirSync(dirname(identityPath), { recursive: true });
writeFileSync(identityPath, `${JSON.stringify(identity, null, 2)}\n`, "utf8");

console.log(`wrote ${identityPath}`);
console.log(`  extension id: ${identity.extensionId}`);
