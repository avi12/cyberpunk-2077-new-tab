import { DEFAULT_BACKGROUND } from "./storage/defaults";
import { CACHED_PREFIX } from "./storage/media-store";
import { BackgroundMediaType } from "./storage/schema";
import { allSettings, settings } from "./storage/settings.svelte";
import { z } from "./zod";

/**
 * Export and import of the whole settings blob.
 *
 * Both walk the `settings` object rather than listing keys, so a setting added there is carried by
 * both without a second edit - the drift the original's two hand-written 21-key lists invited.
 */

export const SETTINGS_FILE_NAME = "Cyberpunk-settings.json";

function exportableBackground(value: string): string {
  return value.startsWith(CACHED_PREFIX) ? DEFAULT_BACKGROUND : value;
}

export function exportSettings(): string {
  const snapshot: Record<string, unknown> = {};
  for (const [key, setting] of Object.entries(allSettings)) {
    snapshot[key] = setting.current;
  }

  snapshot.background = exportableBackground(settings.background.current);
  snapshot.backgroundMediaType = settings.background.current.startsWith(CACHED_PREFIX)
    ? BackgroundMediaType.image
    : settings.backgroundMediaType.current;

  return JSON.stringify(snapshot, null, 2);
}

const snapshotSchema = z.record(z.string(), z.unknown());

export function importSettings(json: string): void {
  const parsed = snapshotSchema.safeParse(JSON.parse(json));
  if (!parsed.success) {
    throw new Error("Invalid settings file");
  }

  for (const [key, setting] of Object.entries(allSettings)) {
    const value = parsed.data[key];
    if (value !== undefined && value !== null) {
      setting.current = value;
    }
  }
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
