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
  hourCycleItem,
  playSoundsItem,
  promptTargetItem,
  scanLinesModeItem,
  tabFaviconItem,
  tabTitleItem,
  temperatureUnitItem,
  userNameItem,
  weatherLocationItem,
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
  HourCycle,
  ScanLinesMode,
  SearchEngineId,
  widgetSchema
} from "./schema";
import { PromptTargetId, withShippedPromptTarget } from "@/features/companion/prompt-target";
import { ICON_NAMES } from "@/features/netlinks/icons/choices";
import { plainCopy } from "@/lib/plain";
import { z } from "@/lib/zod";

/** Storage is parsed like an imported file: older builds wrote looser shapes, and their values outlive them. */
class Setting<TValue> {
  readonly #item: StorageItem<TValue>;
  readonly schema: z.ZodType<TValue>;
  readonly #entrySchema: z.ZodType | null;
  readonly #normalize: (stored: TValue) => TValue;
  #value: TValue = $state()!;

  constructor({ item, schema, entrySchema, normalize }: {
    item: StorageItem<TValue>;
    schema: z.ZodType<TValue>;
    /** For a list, so one entry that no longer reads does not cost the rest. */
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

  /**
   * The copy is for memory, not the write (`definePlainItem` guards that): a caller usually hands back
   * something derived from `current`, and holding their proxy would let them change it underneath.
   */
  async set(value: TValue) {
    const stored = plainCopy(value);
    this.#value = stored;
    await this.#item.setValue(stored);
  }

  /** The repair is not written back, so a shape this build cannot read is kept for a later one that can. */
  async load() {
    const stored: unknown = await this.#item.getValue();
    const parsed = this.schema.safeParse(stored);

    this.#value = this.#normalize(parsed.success ? parsed.data : this.#repaired(stored));
  }

  /**
   * Drops only the unreadable entries of a list: one `javascript:` bookmark saved before urls were
   * pinned would otherwise take every other bookmark down with it.
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

/** Appends widgets shipped since the last save and drops retired ones. */
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
    schema: z.enum(SearchEngineId)
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
    schema: z.enum(ICON_NAMES)
  }),
  playSounds: new Setting({
    item: playSoundsItem,
    schema: z.boolean()
  }),
  hourCycle: new Setting({
    item: hourCycleItem,
    schema: z.enum(HourCycle).nullable()
  })
};

export async function loadSettings() {
  await Promise.all(Object.values(settings).map(setting => setting.load()));
}

/** Type-erased, for code that walks every setting. */
type AnySetting = {
  current: unknown;
  readonly schema: z.ZodType;
  set(value: unknown): Promise<void>;
};

export const allSettings: Record<keyof typeof settings, AnySetting> = settings;
