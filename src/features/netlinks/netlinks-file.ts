import { categoryOf } from "./categories";
import type { Bookmark } from "@/lib/storage/schema";
import { allSettings, settings } from "@/lib/storage/settings.svelte";
import { z } from "@/lib/zod";

// The grid apart from the full settings file, which also carries a reader's name, location, theme
// and wallpaper - nothing to hand over, or to accept, along with someone's links
const NETLINK_KEYS = ["bookmarks", "categoryOrder", "customCategories", "collapsedCategories"] as const;

export const NETLINKS_FILE_STEM = "Cyberpunk-netlinks";

export const INVALID_NETLINKS_FILE = "Invalid netlinks file";

export enum ImportMode {
  merge = "merge",
  replace = "replace"
}

type NetlinkKey = (typeof NETLINK_KEYS)[number];

// Every key optional, so a file written before one of them existed still imports
type Netlinks = Partial<{ [Key in NetlinkKey]: (typeof settings)[Key]["current"] }>;

// Annotated because `Object.fromEntries` widens its keys to `string` and loses the shape
const netlinksSchema: z.ZodType<Netlinks> = z.object(
  Object.fromEntries(NETLINK_KEYS.map(key => [key, allSettings[key].schema.optional()]))
);

export function netlinksSnapshot() {
  const snapshot: Record<string, unknown> = {};
  for (const key of NETLINK_KEYS) {
    snapshot[key] = allSettings[key].current;
  }

  // The same check the import runs, so what this page writes is what it will take back.
  return netlinksSchema.parse(snapshot);
}

export function exportNetlinks() {
  return JSON.stringify(netlinksSnapshot(), null, 2);
}

export function countNetlinks(snapshot: Netlinks) {
  return snapshot.bookmarks?.length ?? 0;
}

function errorNamingFirstIssue(error: z.ZodError) {
  const path = error.issues[0]?.path.join(".");

  return new Error(path ? `${INVALID_NETLINKS_FILE} - ${path} does not look right` : INVALID_NETLINKS_FILE);
}

export function readNetlinksFile(json: string) {
  const parsed = netlinksSchema.safeParse(parseJson(json));
  if (!parsed.success) {
    throw errorNamingFirstIssue(parsed.error);
  }

  return parsed.data;
}

function parseJson(json: string) {
  try {
    const snapshot: unknown = JSON.parse(json);

    return snapshot;
  } catch {
    throw new Error(INVALID_NETLINKS_FILE);
  }
}

// Duplicates are decided by address, never by title - a title is a label each reader chose
function comparableUrl(url: string) {
  return url.replace(/^https?:\/\//u, "").replace(/\/+$/u, "").toLowerCase();
}

function withFreeId({ bookmark, taken }: {
  bookmark: Bookmark;
  taken: Set<string>;
}) {
  if (!taken.has(bookmark.id)) {
    return bookmark;
  }

  return {
    ...bookmark,
    id: `${Temporal.Now.instant().epochMilliseconds}-${bookmark.id}`
  };
}

function mergeBookmarks({ existing, arriving }: {
  existing: Bookmark[];
  arriving: Bookmark[];
}) {
  const takenUrls = new Set(existing.map(bookmark => comparableUrl(bookmark.url)));
  const takenIds = new Set(existing.map(bookmark => bookmark.id));
  const added: Bookmark[] = [];

  for (const bookmark of arriving) {
    const url = comparableUrl(bookmark.url);
    if (takenUrls.has(url)) {
      continue;
    }

    takenUrls.add(url);
    const landing = withFreeId({
      bookmark,
      taken: takenIds
    });
    takenIds.add(landing.id);
    added.push(landing);
  }

  return [...existing, ...added];
}

function mergeNames({ existing, arriving }: {
  existing: string[];
  arriving: string[];
}) {
  return [...existing, ...arriving.filter(name => !existing.includes(name))];
}

// The file is fully validated before any setting moves, so a bad key never leaves a half import
export async function importNetlinks({ json, mode }: {
  json: string;
  mode: ImportMode;
}) {
  const arriving = readNetlinksFile(json);
  if (mode === ImportMode.replace) {
    await Promise.all(
      NETLINK_KEYS.filter(key => arriving[key] !== undefined).map(key => allSettings[key].set(arriving[key]))
    );

    return;
  }

  const merged = mergeBookmarks({
    existing: settings.bookmarks.current,
    arriving: arriving.bookmarks ?? []
  });
  const sections = mergeNames({
    existing: settings.categoryOrder.current,
    // A link filed under a section the file never listed still needs that section to exist.
    arriving: mergeNames({
      existing: arriving.categoryOrder ?? [],
      arriving: merged.map(categoryOf)
    })
  });

  await Promise.all([
    settings.bookmarks.set(merged),
    settings.categoryOrder.set(sections),
    settings.customCategories.set(
      mergeNames({
        existing: settings.customCategories.current,
        arriving: arriving.customCategories ?? []
      })
    )
  ]);
}
