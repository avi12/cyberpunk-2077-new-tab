import { DEFAULT_BACKGROUND } from "./storage/defaults";
import { CACHED_PREFIX } from "./storage/media-store";
import { BackgroundMediaType } from "./storage/schema";
import { allSettings, settings } from "./storage/settings.svelte";
import { z } from "./zod";

/**
 * Export and import of the whole settings blob.
 *
 * Both walk the `settings` object rather than listing keys, so a setting added there is carried by
 * both without a second edit - the drift the original's two hand-written 21-key lists invited. The
 * shape each one may take is the setting's own schema, which is what a file is checked against.
 */

export const SETTINGS_FILE_NAME = "Cyberpunk-settings.json";

export const INVALID_SETTINGS_FILE = "Invalid settings file";

/**
 * A settings file is a stranger's JSON, so nothing goes in unverified. Every key is optional: a file
 * written before a setting existed still imports, and one written by a newer build loses only the
 * keys this one has never heard of.
 */
const snapshotSchema = z.object(
  Object.fromEntries(Object.entries(allSettings).map(([key, setting]) => [key, setting.schema.optional()]))
);

function exportableBackground(value: string): string {
  return value.startsWith(CACHED_PREFIX) ? DEFAULT_BACKGROUND : value;
}

/** Every setting as one object - what a file holds, and what the browser account holds. */
export function settingsSnapshot(): Record<string, unknown> {
  const snapshot: Record<string, unknown> = {};
  for (const [key, setting] of Object.entries(allSettings)) {
    snapshot[key] = setting.current;
  }

  snapshot.background = exportableBackground(settings.background.current);
  snapshot.backgroundMediaType = settings.background.current.startsWith(CACHED_PREFIX)
    ? BackgroundMediaType.image
    : settings.backgroundMediaType.current;

  // The same check the import runs, so what this page writes is what it will take back.
  return snapshotSchema.parse(snapshot);
}

/** A file is indented: it is the copy a reader may open. */
export function exportSettings(): string {
  return JSON.stringify(settingsSnapshot(), null, 2);
}

function readJson(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    throw new Error(INVALID_SETTINGS_FILE);
  }
}

/** The first thing wrong with the file, named, because "invalid" alone says nothing to fix. */
function problem(error: z.ZodError): Error {
  const path = error.issues[0]?.path.join(".");

  return new Error(path ? `${INVALID_SETTINGS_FILE} - ${path} does not look right` : INVALID_SETTINGS_FILE);
}

/**
 * All or nothing: the whole file is checked before a single setting moves, so a bad key leaves the
 * page as it was rather than half imported. It resolves once every value is in storage, because the
 * page reloads on the other side of this call and a write still in flight would not survive it.
 */
export async function importSettings(json: string): Promise<void> {
  const parsed = snapshotSchema.safeParse(readJson(json));
  if (!parsed.success) {
    throw problem(parsed.error);
  }

  const arriving = Object.entries(allSettings)
    .filter(([key]) => parsed.data[key] !== undefined)
    .map(([key, setting]) => setting.set(parsed.data[key]));

  await Promise.all(arriving);
}

export function downloadFile({ name, contents, type }: {
  name: string;
  contents: BlobPart;
  type: string;
}): void {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const elAnchor = document.createElement("a");
  elAnchor.href = url;
  elAnchor.download = name;
  document.body.append(elAnchor);
  elAnchor.click();
  elAnchor.remove();
  URL.revokeObjectURL(url);
}
