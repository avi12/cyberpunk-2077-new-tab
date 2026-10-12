import { DEFAULT_BACKGROUND } from "@/lib/storage/defaults";
import { CACHED_PREFIX } from "@/lib/storage/media-store";
import { BackgroundMediaType } from "@/lib/storage/schema";
import { allSettings, settings } from "@/lib/storage/settings.svelte";
import { z } from "@/lib/zod";

// Export and import both walk `allSettings` rather than listing keys, so a new setting needs no
// second edit here.

export const SETTINGS_FILE_STEM = "Cyberpunk-settings";

export const INVALID_SETTINGS_FILE = "Invalid settings file";

/** Every key is optional, so older files still import and newer ones lose only unknown keys. */
const snapshotSchema = z.object(
  Object.fromEntries(Object.entries(allSettings).map(([key, setting]) => [key, setting.schema.optional()]))
);

export function settingsSnapshot() {
  const snapshot: Record<string, unknown> = {};
  for (const [key, setting] of Object.entries(allSettings)) {
    snapshot[key] = setting.current;
  }

  const background = settings.background.current;
  const isCachedBackground = background.startsWith(CACHED_PREFIX);
  snapshot.background = isCachedBackground ? DEFAULT_BACKGROUND : background;
  snapshot.backgroundMediaType = isCachedBackground ? BackgroundMediaType.image : settings.backgroundMediaType.current;

  // The same check the import runs, so what this page writes is what it will take back.
  return snapshotSchema.parse(snapshot);
}

/** Indented, since a person may open the file. */
export function exportSettings() {
  return JSON.stringify(settingsSnapshot(), null, 2);
}

function readJson(json: string) {
  try {
    const snapshot: unknown = JSON.parse(json);

    return snapshot;
  } catch {
    throw new Error(INVALID_SETTINGS_FILE);
  }
}

function firstIssueError(error: z.ZodError) {
  const path = error.issues[0]?.path.join(".");

  return new Error(path ? `${INVALID_SETTINGS_FILE} - ${path} does not look right` : INVALID_SETTINGS_FILE);
}

/**
 * All or nothing: the whole file is validated before any setting moves. Resolves only once every
 * value is stored, because the caller reloads the page and an in-flight write would not survive it.
 */
export async function importSettings(json: string) {
  const parsed = snapshotSchema.safeParse(readJson(json));
  if (!parsed.success) {
    throw firstIssueError(parsed.error);
  }

  const pendingWrites = Object.entries(allSettings)
    .filter(([key]) => parsed.data[key] !== undefined)
    .map(([key, setting]) => setting.set(parsed.data[key]));

  await Promise.all(pendingWrites);
}
