import { categoryOf } from "./categories";
import type { Bookmark } from "@/lib/storage/schema";
import { allSettings, settings } from "@/lib/storage/settings.svelte";
import { z } from "@/lib/zod";

/**
 * Export and import of the grid on its own, rather than of everything.
 *
 * The settings file already carries the netlinks, because it carries every setting - but it carries
 * a reader's name, where they are, their theme and their wallpaper with them. That is the wrong
 * thing to hand somebody who asked for your links, and the wrong thing to accept from them: an
 * import of the whole file is an import of their identity over yours.
 *
 * So this is the same machinery pointed at four settings instead of all of them. It reads their
 * schemas out of the one registry rather than restating any shape, so a netlink that gains a field
 * is carried here without a second edit.
 */

/** The four settings that are the grid: the cards, the sections, and which sections are shut. */
const NETLINK_KEYS = ["bookmarks", "categoryOrder", "customCategories", "collapsedCategories"] as const;

export const NETLINKS_FILE_STEM = "Cyberpunk-netlinks";

export const INVALID_NETLINKS_FILE = "Invalid netlinks file";

/** How an import treats what is already on the page - which is a question only the reader can answer. */
export enum ImportMode {
  merge = "merge",
  replace = "replace"
}

type NetlinkKey = (typeof NETLINK_KEYS)[number];

/**
 * Derived from the registry rather than written out, so a setting that changes shape changes here
 * too. Every key optional: a file written before one of them existed still imports, and one written
 * by a newer build loses only the keys this one has never heard of.
 */
type Netlinks = Partial<{ [Key in NetlinkKey]: (typeof settings)[Key]["current"] }>;

/**
 * The runtime shape comes from the same registry the type does. Annotated rather than inferred
 * because `Object.fromEntries` widens its keys to `string` and takes the shape down with them.
 */
const netlinksSchema: z.ZodType<Netlinks> = z.object(
  Object.fromEntries(NETLINK_KEYS.map(key => [key, allSettings[key].schema.optional()]))
);

/** Everything the grid is, as one object - what a file holds, and what the browser account holds. */
export function netlinksSnapshot() {
  const snapshot: Record<string, unknown> = {};
  for (const key of NETLINK_KEYS) {
    snapshot[key] = allSettings[key].current;
  }

  // The same check the import runs, so what this page writes is what it will take back.
  return netlinksSchema.parse(snapshot);
}

/** A file is indented: it is the copy a reader may open, and may well send to somebody. */
export function exportNetlinks() {
  return JSON.stringify(netlinksSnapshot(), null, 2);
}

export function countNetlinks(snapshot: Netlinks) {
  return snapshot.bookmarks?.length ?? 0;
}

/** The first thing wrong with the file, named, because "invalid" alone says nothing to fix. */
function problem(error: z.ZodError) {
  const path = error.issues[0]?.path.join(".");

  return new Error(path ? `${INVALID_NETLINKS_FILE} - ${path} does not look right` : INVALID_NETLINKS_FILE);
}

export function readNetlinksFile(json: string) {
  const parsed = netlinksSchema.safeParse(parseJson(json));
  if (!parsed.success) {
    throw problem(parsed.error);
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

/**
 * The same link twice is the one thing a merge has to answer for, and the address is what decides it
 * - a title is a label a reader chose and two people will not have chosen the same one.
 *
 * Compared without its trailing slash or its scheme, so a link saved from the address bar and the
 * same link typed by hand do not both land.
 */
function sameLink(url: string) {
  return url.replace(/^https?:\/\//u, "").replace(/\/+$/u, "").toLowerCase();
}

/** An id is only ever a key within one grid, so a collision is renamed rather than refused. */
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
  const links = new Set(existing.map(bookmark => sameLink(bookmark.url)));
  const ids = new Set(existing.map(bookmark => bookmark.id));
  const added: Bookmark[] = [];

  for (const bookmark of arriving) {
    const link = sameLink(bookmark.url);
    if (links.has(link)) {
      continue;
    }

    links.add(link);
    const landing = withFreeId({
      bookmark,
      taken: ids
    });
    ids.add(landing.id);
    added.push(landing);
  }

  return [...existing, ...added];
}

/** Sections keep the order they already had; the ones a file brings are new and go after them. */
function mergeNames({ existing, arriving }: {
  existing: string[];
  arriving: string[];
}) {
  return [...existing, ...arriving.filter(name => !existing.includes(name))];
}

/**
 * All or nothing: the file is read and checked before a single setting moves, so a bad key leaves
 * the grid as it was rather than half imported.
 *
 * A merge never removes anything - a link a reader already had wins, and a section they had keeps
 * its place. A replace is the file exactly, which is what restoring your own backup means.
 */
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
