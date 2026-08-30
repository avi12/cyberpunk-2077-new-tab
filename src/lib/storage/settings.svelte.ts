import type {
  BackgroundMediaType,
  Bookmark,
  ColorTheme,
  DisplayPreferences,
  GeoLocation,
  ScanLinesMode,
  SearchEngine,
  Widget
} from "./defaults";
import { DEFAULT_WIDGET_ORDER, DEFAULT_WIDGETS } from "./defaults";
import {
  activeSearchEngineItem,
  backgroundBrightnessItem,
  backgroundItem,
  backgroundMediaTypeItem,
  backgroundMediaVersionItem,
  bookmarksItem,
  categoryOrderItem,
  collapsedCategoriesItem,
  colorThemeItem,
  customCategoriesItem,
  displayPreferencesItem,
  scanLinesModeItem,
  searchEnginesItem,
  tabFaviconItem,
  tabTitleItem,
  temperatureUnitItem,
  timeFormatItem,
  userNameItem,
  weatherLocationItem,
  widgetOrderItem,
  widgetsItem
} from "./items";
import type { WxtStorageItem } from "wxt/utils/storage";

type StorageItem<TValue> = WxtStorageItem<TValue, Record<string, unknown>>;

class Setting<TValue> {
  readonly item: StorageItem<TValue>;
  readonly #normalize: (stored: TValue) => TValue;
  #value: TValue = $state()!;

  constructor(item: StorageItem<TValue>, normalize?: (stored: TValue) => TValue) {
    this.item = item;
    this.#normalize = normalize ?? (stored => stored);
    this.#value = item.fallback;
  }

  get current(): TValue {
    return this.#value;
  }

  set current(value: TValue) {
    this.#value = value;
    void this.item.setValue(value);
  }

  async load(): Promise<void> {
    this.#value = this.#normalize(await this.item.getValue());
  }
}

/**
 * The stored list is reconciled with the shipped one on every read: widgets added since the user
 * last saved are appended, and ones that have since been retired are dropped rather than left as
 * empty slots in the panel.
 */
function withShippedWidgets(stored: Widget[]): Widget[] {
  const shipped = stored.filter(widget => DEFAULT_WIDGETS.some(({ id }) => id === widget.id));

  return [...shipped, ...DEFAULT_WIDGETS.filter(({ id }) => !shipped.some(widget => widget.id === id))];
}

function withShippedWidgetIds(stored: string[]): string[] {
  const shipped = stored.filter(id => DEFAULT_WIDGET_ORDER.includes(id));

  return [...shipped, ...DEFAULT_WIDGET_ORDER.filter(id => !shipped.includes(id))];
}

export const settings = {
  bookmarks: new Setting<Bookmark[]>(bookmarksItem),
  categoryOrder: new Setting<string[]>(categoryOrderItem),
  collapsedCategories: new Setting<Record<string, boolean>>(collapsedCategoriesItem),
  customCategories: new Setting<string[]>(customCategoriesItem),
  searchEngines: new Setting<SearchEngine[]>(searchEnginesItem),
  activeSearchEngine: new Setting<string>(activeSearchEngineItem),
  weatherLocation: new Setting<GeoLocation>(weatherLocationItem),
  temperatureUnit: new Setting<boolean>(temperatureUnitItem),
  timeFormat: new Setting<boolean>(timeFormatItem),
  colorTheme: new Setting<ColorTheme>(colorThemeItem),
  displayPreferences: new Setting<DisplayPreferences>(displayPreferencesItem),
  background: new Setting<string>(backgroundItem),
  backgroundBrightness: new Setting<number>(backgroundBrightnessItem),
  backgroundMediaType: new Setting<BackgroundMediaType>(backgroundMediaTypeItem),
  backgroundMediaVersion: new Setting<number>(backgroundMediaVersionItem),
  userName: new Setting<string>(userNameItem),
  widgets: new Setting<Widget[]>(widgetsItem, withShippedWidgets),
  widgetOrder: new Setting<string[]>(widgetOrderItem, withShippedWidgetIds),
  scanLinesMode: new Setting<ScanLinesMode>(scanLinesModeItem),
  tabTitle: new Setting<string>(tabTitleItem),
  tabFavicon: new Setting<string>(tabFaviconItem)
};

export async function loadSettings(): Promise<void> {
  await Promise.all(Object.values(settings).map(setting => setting.load()));
}

export const allSettings: Record<string, { current: unknown }> = settings;
