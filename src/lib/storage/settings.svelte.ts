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
  playSoundsItem,
  promptTargetItem,
  scanLinesModeItem,
  tabFaviconItem,
  tabTitleItem,
  temperatureUnitItem,
  userNameItem,
  weatherLocationItem,
  weatherSourceItem,
  widgetOrderItem,
  widgetsItem
} from "./items";
import type { StorageItem } from "./items";
import type { Widget } from "./schema";
import {
  backgroundBrightnessSchema,
  BackgroundMediaType,
  bookmarkSchema,
  ColorTheme,
  displayPreferencesSchema,
  geoLocationSchema,
  ScanLinesMode,
  widgetSchema
} from "./schema";
import { PromptTargetId, withShippedPromptTarget } from "@/features/companion/prompt-target";
import { WeatherSourceId, withShippedWeatherSource } from "@/features/weather/sources";
import { z } from "@/lib/zod";

/**
 * One setting: where it is kept, what shape it may take, and how a stored answer is brought up to
 * date with what this build ships. The schema is what a settings file is checked against, so the
 * shape a setting accepts is named once and both the compiler and an import obey it.
 *
 * Storage is read through it too, not only a settings file. What is in there was written by builds
 * that described these shapes more loosely, and it outlives every one of them, so a stored value is
 * a claim rather than a value until the shape has agreed with it.
 */
class Setting<TValue> {
  readonly #item: StorageItem<TValue>;
  readonly schema: z.ZodType<TValue>;
  readonly #entrySchema: z.ZodType | null;
  readonly #normalize: (stored: TValue) => TValue;
  #value: TValue = $state()!;

  constructor({ item, schema, entrySchema, normalize }: {
    item: StorageItem<TValue>;
    schema: z.ZodType<TValue>;
    /** Named by a list, so one entry that no longer reads does not cost the reader the rest. */
    entrySchema?: z.ZodType;
    normalize?: (stored: TValue) => TValue;
  }) {
    this.#item = item;
    this.schema = schema;
    this.#entrySchema = entrySchema ?? null;
    this.#normalize = normalize ?? (stored => stored);
    this.#value = item.fallback;
  }

  get current() {
    return this.#value;
  }

  set current(value: TValue) {
    void this.set(value);
  }

  /** The write behind `current`, for a caller that cannot move on until storage has the value. */
  async set(value: TValue) {
    this.#value = value;
    await this.#item.setValue(value);
  }

  /**
   * Reading is a parse. Nothing is written back afterwards - the repair stands for this page's life
   * and the reader's own next edit is what persists it, so a shape this build cannot read is still
   * there for a later one that can.
   */
  async load() {
    const stored: unknown = await this.#item.getValue();
    const parsed = this.schema.safeParse(stored);

    this.#value = this.#normalize(parsed.success ? parsed.data : this.#repaired(stored));
  }

  /**
   * One entry that no longer reads costs the reader that entry rather than the list it was in: a
   * single `javascript:` bookmark saved before the address was pinned would otherwise take every
   * other bookmark down with it. Whatever is left is read through the setting's own shape again,
   * because a list of survivors is still only a claim until it has been.
   *
   * Anything else - a scalar, a list that is not a list at all - is past salvaging, and the fallback
   * is what a setting means by no answer.
   */
  #repaired(stored: unknown) {
    const entrySchema = this.#entrySchema;
    const parsedList = z.array(z.unknown()).safeParse(stored);
    if (!entrySchema || !parsedList.success) {
      return this.#item.fallback;
    }

    const kept = parsedList.data.filter(entry => entrySchema.safeParse(entry).success);
    const parsedKept = this.schema.safeParse(kept);

    return parsedKept.success ? parsedKept.data : this.#item.fallback;
  }
}

/**
 * A setting that is a list. The array is built from the entry's own shape here, so what one entry
 * looks like is written once and the list cannot come to disagree with the entries in it.
 */
class ListSetting<TItem> extends Setting<TItem[]> {
  constructor({ item, entrySchema, normalize }: {
    item: StorageItem<TItem[]>;
    entrySchema: z.ZodType<TItem>;
    normalize?: (stored: TItem[]) => TItem[];
  }) {
    super({
      item,
      schema: z.array(entrySchema),
      entrySchema,
      normalize
    });
  }
}

/**
 * The stored list is reconciled with the shipped one on every read: widgets added since the user
 * last saved are appended, and ones that have since been retired are dropped rather than left as
 * empty slots in the panel.
 */
function withShippedWidgets(stored: Widget[]) {
  const shipped = stored.filter(widget => DEFAULT_WIDGETS.some(({ id }) => id === widget.id));

  return [...shipped, ...DEFAULT_WIDGETS.filter(({ id }) => !shipped.some(widget => widget.id === id))];
}

function withShippedWidgetIds(stored: string[]) {
  const shipped = stored.filter(id => DEFAULT_WIDGET_ORDER.includes(id));

  return [...shipped, ...DEFAULT_WIDGET_ORDER.filter(id => !shipped.includes(id))];
}

export const settings = {
  bookmarks: new ListSetting({
    item: bookmarksItem,
    entrySchema: bookmarkSchema
  }),
  categoryOrder: new ListSetting({
    item: categoryOrderItem,
    entrySchema: z.string()
  }),
  collapsedCategories: new Setting({
    item: collapsedCategoriesItem,
    schema: z.record(z.string(), z.boolean())
  }),
  customCategories: new ListSetting({
    item: customCategoriesItem,
    entrySchema: z.string()
  }),
  promptTarget: new Setting({
    item: promptTargetItem,
    schema: z.enum(PromptTargetId).nullable(),
    normalize: withShippedPromptTarget
  }),
  activeSearchEngine: new Setting({
    item: activeSearchEngineItem,
    schema: z.string()
  }),
  weatherLocation: new Setting({
    item: weatherLocationItem,
    schema: geoLocationSchema
  }),
  weatherSource: new Setting({
    item: weatherSourceItem,
    schema: z.enum(WeatherSourceId),
    normalize: withShippedWeatherSource
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
    schema: displayPreferencesSchema
  }),
  background: new Setting({
    item: backgroundItem,
    schema: z.string()
  }),
  backgroundBrightness: new Setting({
    item: backgroundBrightnessItem,
    schema: backgroundBrightnessSchema
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
  widgets: new ListSetting({
    item: widgetsItem,
    entrySchema: widgetSchema,
    normalize: withShippedWidgets
  }),
  widgetOrder: new ListSetting({
    item: widgetOrderItem,
    entrySchema: z.string(),
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

export async function loadSettings() {
  await Promise.all(Object.values(settings).map(setting => setting.load()));
}

/** A setting with its type forgotten, for the code that walks all of them without knowing any. */
type AnySetting = {
  current: unknown;
  readonly schema: z.ZodType;
  set(value: unknown): Promise<void>;
};

export const allSettings: Record<string, AnySetting> = settings;
