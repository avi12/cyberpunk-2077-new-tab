import { bookmarkOrderItem } from "./storage/items";
import { settings } from "./storage/settings.svelte";

/** Category names are normalised to lower case, matching how the original stored them. */
export function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

export function addCategory(name: string): void {
  if (!settings.customCategories.current.includes(name)) {
    settings.customCategories.current = [...settings.customCategories.current, name];
  }

  if (!settings.categoryOrder.current.includes(name)) {
    settings.categoryOrder.current = [...settings.categoryOrder.current, name];
  }
}

export async function renameCategory({ from, to }: {
  from: string;
  to: string;
}): Promise<void> {
  settings.bookmarks.current = settings.bookmarks.current.map(bookmark =>
    (bookmark.category === from ? {
      ...bookmark,
      category: to
    } : bookmark));
  settings.categoryOrder.current = settings.categoryOrder.current.map(name => (name === from ? to : name));

  if (settings.customCategories.current.includes(from)) {
    settings.customCategories.current = settings.customCategories.current.map(name => (name === from ? to : name));
  }

  const order = await bookmarkOrderItem(from).getValue();
  if (order.length > 0) {
    await bookmarkOrderItem(from).removeValue();
    await bookmarkOrderItem(to).setValue(order);
  }

  const collapsed = settings.collapsedCategories.current;
  if (from in collapsed) {
    const { [from]: wasCollapsed, ...rest } = collapsed;
    settings.collapsedCategories.current = {
      ...rest,
      [to]: wasCollapsed
    };
  }
}

export async function deleteCategory(name: string): Promise<void> {
  settings.bookmarks.current = settings.bookmarks.current.filter(bookmark => bookmark.category !== name);
  settings.categoryOrder.current = settings.categoryOrder.current.filter(entry => entry !== name);
  settings.customCategories.current = settings.customCategories.current.filter(entry => entry !== name);
  await bookmarkOrderItem(name).removeValue();

  if (name in settings.collapsedCategories.current) {
    const { [name]: _removed, ...rest } = settings.collapsedCategories.current;
    settings.collapsedCategories.current = rest;
  }
}

export function toggleCollapsed(name: string): void {
  settings.collapsedCategories.current = {
    ...settings.collapsedCategories.current,
    [name]: !settings.collapsedCategories.current[name]
  };
}
