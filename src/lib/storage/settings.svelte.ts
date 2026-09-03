import { z } from "../zod";
import { DEFAULT_DISPLAY_PREFERENCES, DEFAULT_WIDGET_ORDER, DEFAULT_WIDGETS } from "./defaults";
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
  playSoundsItem,
  scanLinesModeItem,
  searchEnginesItem,
  tabFaviconItem,
  tabTitleItem,
  temperatureUnitItem,
  userNameItem,
  weatherLocationItem,
  widgetOrderItem,
  widgetsItem
} from "./items";
import type { StorageItem } from "./items";
import type { DisplayPreferences, Widget } from "./schema";
import {
  bookmarkSchema,
  displayPreferencesSchema,
  geoLocationSchema,
  searchEngineSchema,
  widgetSchema
} from "./schema";
import { BackgroundMediaType, ColorTheme, ScanLinesMode } from "./schema";
/**
 * One setting: where it is kept, what shape it may take, and how a stored answer is brought up to
 * date with what this build ships. The schema is what a settings file is checked against, so the
 * shape a setting accepts is named once and both the compiler and an import obey it.
 */
class Setting<TValue> {
  readonly item: StorageItem<TValue>;
  readonly schema: z.ZodType<TValue>;
  readonly #normalize: (stored: TValue) => TValue;
  #value: TValue = $state()!;

  constructor({ item, schema, normalize }: {
    item: StorageItem<TValue>;
    schema: z.ZodType<TValue>;
    normalize?: (stored: TValue) => TValue;
  }) {
    this.item = item;
    this.schema = schema;
    this.#normalize = normalize ?? (stored => stored);
    this.#value = item.fallback;
  }

  get current(): TValue {
    return this.#value;
  }

  set current(value: TValue) {
    void this.set(value);
  }

  /** The write behind `current`, for a caller that cannot move on until storage has the value. */
  async set(value: TValue): Promise<void> {
    this.#value = value;
    await this.item.setValue(value);
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

/**
 * An element added to the page after the reader last saved has no answer stored for it, and an
 * absent answer is not "hidden" - it is the default the element ships with. Filling those in is what
 * the schema's per-element defaults already do, so reading is a parse.
 */
function withShippedElements(stored: DisplayPreferences): DisplayPreferences {
  const parsed = displayPreferencesSchema.safeParse(stored);

  return parsed.success ? parsed.data : DEFAULT_DISPLAY_PREFERENCES;
}

function withShippedWidgetIds(stored: string[]): string[] {
  const shipped = stored.filter(id => DEFAULT_WIDGET_ORDER.includes(id));

  return [...shipped, ...DEFAULT_WIDGET_ORDER.filter(id => !shipped.includes(id))];
}

export const settings = {
  bookmarks: new Setting({
    item: bookmarksItem,
    schema: z.array(bookmarkSchema)
  }),
  categoryOrder: new Setting({
    item: categoryOrderItem,
    schema: z.array(z.string())
  }),
  collapsedCategories: new Setting({
    item: collapsedCategoriesItem,
    schema: z.record(z.string(), z.boolean())
  }),
  customCategories: new Setting({
    item: customCategoriesItem,
    schema: z.array(z.string())
  }),
  searchEngines: new Setting({
    item: searchEnginesItem,
    schema: z.array(searchEngineSchema)
  }),
  activeSearchEngine: new Setting({
    item: activeSearchEngineItem,
    schema: z.string()
  }),
  weatherLocation: new Setting({
    item: weatherLocationItem,
    schema: geoLocationSchema
  }),
  temperatureUnit: new Setting({
    item: temperatureUnitItem,
    schema: z.boolean()
  }),
  colorTheme: new Setting({
    item: colorThemeItem,
    schema: z.enum(ColorTheme)
  }),
  displayPreferences: new Setting({
    item: displayPreferencesItem,
    schema: displayPreferencesSchema,
    normalize: withShippedElements
  }),
  background: new Setting({
    item: backgroundItem,
    schema: z.string()
  }),
  backgroundBrightness: new Setting({
    item: backgroundBrightnessItem,
    schema: z.number()
  }),
  backgroundMediaType: new Setting({
    item: backgroundMediaTypeItem,
    schema: z.enum(BackgroundMediaType)
  }),
  backgroundMediaVersion: new Setting({
    item: backgroundMediaVersionItem,
    schema: z.number()
  }),
  userName: new Setting({
    item: userNameItem,
    schema: z.string()
  }),
  widgets: new Setting({
    item: widgetsItem,
    schema: z.array(widgetSchema),
    normalize: withShippedWidgets
  }),
  widgetOrder: new Setting({
    item: widgetOrderItem,
    schema: z.array(z.string()),
    normalize: withShippedWidgetIds
  }),
  scanLinesMode: new Setting({
    item: scanLinesModeItem,
    schema: z.enum(ScanLinesMode)
  }),
  tabTitle: new Setting({
    item: tabTitleItem,
    schema: z.string()
  }),
  tabFavicon: new Setting({
    item: tabFaviconItem,
    schema: z.string()
  }),
  playSounds: new Setting({
    item: playSoundsItem,
    schema: z.boolean()
  })
};

export async function loadSettings(): Promise<void> {
  await Promise.all(Object.values(settings).map(setting => setting.load()));
}

/** A setting with its type forgotten, for the code that walks all of them without knowing any. */
export type AnySetting = {
  current: unknown;
  readonly schema: z.ZodType;
  set(value: unknown): Promise<void>;
};

export const allSettings: Record<string, AnySetting> = settings;
