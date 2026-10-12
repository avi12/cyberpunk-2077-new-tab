import type { Bookmark } from "@/lib/storage/schema";
import { BookmarkCategory } from "@/lib/storage/schema";
import { settings } from "@/lib/storage/settings.svelte";

// Lower case, matching how the original stored category names
export function normalizeName(name: string) {
  return name.trim().toLowerCase();
}

export function categoryOf(bookmark: Bookmark) {
  return bookmark.category || BookmarkCategory.other;
}

export function addCategory(name: string) {
  if (!settings.customCategories.current.includes(name)) {
    settings.customCategories.current = [...settings.customCategories.current, name];
  }

  if (!settings.categoryOrder.current.includes(name)) {
    settings.categoryOrder.current = [...settings.categoryOrder.current, name];
  }
}

export function renameCategory({ from, to }: {
  from: string;
  to: string;
}) {
  settings.bookmarks.current = settings.bookmarks.current.map(bookmark =>
    (categoryOf(bookmark) === from ? {
      ...bookmark,
      category: to
    } : bookmark));
  settings.categoryOrder.current = settings.categoryOrder.current.map(name => (name === from ? to : name));

  if (settings.customCategories.current.includes(from)) {
    settings.customCategories.current = settings.customCategories.current.map(name => (name === from ? to : name));
  }

  const { [from]: isCollapsed, ...rest } = settings.collapsedCategories.current;
  if (isCollapsed !== undefined) {
    settings.collapsedCategories.current = {
      ...rest,
      [to]: isCollapsed
    };
  }
}

export function deleteCategory(name: string) {
  settings.bookmarks.current = settings.bookmarks.current.filter(bookmark => categoryOf(bookmark) !== name);
  settings.categoryOrder.current = settings.categoryOrder.current.filter(entry => entry !== name);
  settings.customCategories.current = settings.customCategories.current.filter(entry => entry !== name);

  if (name in settings.collapsedCategories.current) {
    const { [name]: _removed, ...rest } = settings.collapsedCategories.current;
    settings.collapsedCategories.current = rest;
  }
}

export function toggleCollapsed(name: string) {
  settings.collapsedCategories.current = {
    ...settings.collapsedCategories.current,
    [name]: !settings.collapsedCategories.current[name]
  };
}
