import {
  DEFAULT_BACKGROUND,
  DEFAULT_BACKGROUND_BRIGHTNESS,
  DEFAULT_BOOKMARKS,
  DEFAULT_CATEGORY_ORDER,
  DEFAULT_COLOR_THEME,
  DEFAULT_DISPLAY_PREFERENCES,
  DEFAULT_PLAY_SOUNDS,
  DEFAULT_SCAN_LINES_MODE,
  DEFAULT_TAB_FAVICON,
  DEFAULT_TAB_TITLE,
  DEFAULT_TEMPERATURE_UNIT,
  DEFAULT_USER_NAME,
  DEFAULT_WEATHER_LOCATION,
  DEFAULT_WIDGET_ORDER,
  DEFAULT_WIDGETS
} from "./defaults";
import type {
  Bookmark,
  ColorTheme,
  DisplayPreferences,
  GeoLocation,
  ScanLinesMode,
  Widget
} from "./schema";
import { BackgroundMediaType, SearchEngineId } from "./schema";
import type { PromptTargetId } from "@/features/companion/prompt-target";
import type { ComposeSiteId } from "@/features/compose/sites";
import { DEFAULT_WEATHER_SOURCE, type WeatherSourceId } from "@/features/weather/sources";
import { storage } from "#imports";
import type { WxtStorageItem } from "wxt/utils/storage";

/** One stored value as `defineItem` hands it back, for the code that is given one to read or write. */
export type StorageItem<TValue> = WxtStorageItem<TValue, Record<string, unknown>>;

export const bookmarksItem = storage.defineItem<Bookmark[]>("local:bookmarks", { fallback: DEFAULT_BOOKMARKS });

export const categoryOrderItem = storage.defineItem<string[]>("local:categoryOrder", { fallback: DEFAULT_CATEGORY_ORDER });

export const collapsedCategoriesItem = storage.defineItem<Record<string, boolean>>("local:collapsedCategories", {
  fallback: {}
});

export const customCategoriesItem = storage.defineItem<string[]>("local:customCategories", { fallback: [] });

export const activeSearchEngineItem = storage.defineItem<string>("local:activeSearchEngine", { fallback: SearchEngineId.browserDefault });

export const weatherLocationItem = storage.defineItem<GeoLocation>("local:weatherLocation", { fallback: DEFAULT_WEATHER_LOCATION });

export const weatherSourceItem = storage.defineItem<WeatherSourceId>("local:weatherSource", { fallback: DEFAULT_WEATHER_SOURCE });

export const temperatureUnitItem = storage.defineItem<boolean>("local:temperatureUnit", { fallback: DEFAULT_TEMPERATURE_UNIT });

export const colorThemeItem = storage.defineItem<ColorTheme>("local:colorTheme", { fallback: DEFAULT_COLOR_THEME });

export const displayPreferencesItem = storage.defineItem<DisplayPreferences>("local:displayPreferences", { fallback: DEFAULT_DISPLAY_PREFERENCES });

export const backgroundItem = storage.defineItem<string>("local:background", { fallback: DEFAULT_BACKGROUND });

export const backgroundBrightnessItem = storage.defineItem<number>("local:backgroundBrightness", { fallback: DEFAULT_BACKGROUND_BRIGHTNESS });

export const backgroundMediaTypeItem = storage.defineItem<BackgroundMediaType>("local:backgroundMediaType", { fallback: BackgroundMediaType.none });

export const backgroundMediaVersionItem = storage.defineItem<number>("local:backgroundMediaVersion", { fallback: 0 });

export const userNameItem = storage.defineItem<string>("local:userName", { fallback: DEFAULT_USER_NAME });

export const widgetsItem = storage.defineItem<Widget[]>("local:widgets", { fallback: DEFAULT_WIDGETS });

export const widgetOrderItem = storage.defineItem<string[]>("local:widgetOrder", { fallback: DEFAULT_WIDGET_ORDER });

export const scanLinesModeItem = storage.defineItem<ScanLinesMode>("local:scanLinesMode", { fallback: DEFAULT_SCAN_LINES_MODE });

export const tabTitleItem = storage.defineItem<string>("local:tabTitle", { fallback: DEFAULT_TAB_TITLE });

export const tabFaviconItem = storage.defineItem<string>("local:tabFavicon", { fallback: DEFAULT_TAB_FAVICON });

export const playSoundsItem = storage.defineItem<boolean>("local:playSounds", { fallback: DEFAULT_PLAY_SOUNDS });

/**
 * Nothing stored means the destination follows the engine the reader searches with, rather than a
 * second setting that can disagree with the first. Only an explicit pick is ever written here.
 */
export const promptTargetItem = storage.defineItem<PromptTargetId | null>("local:promptTarget", { fallback: null });

export const bookmarksSeededItem = storage.defineItem<boolean>("local:bookmarksSeeded", { fallback: false });

/**
 * Not a setting: the last answer the companion app gave about one family of cards. Reading journeys
 * afresh means snapshotting a database that runs to tens of megabytes and takes a quarter of a
 * second, which is long enough to see, so the answer outlives the browser session - otherwise the
 * first new tab after every restart is the slow one. It holds the app's words verbatim; the cards
 * are rebuilt and revalidated on every read, so an expired journey never comes back from here and
 * the three tips on show move on with the day.
 */
export type CompanionSnapshot = {
  fetchedAtMs: number;
  raw: unknown[];
};

export const journeysSnapshotItem = storage.defineItem<CompanionSnapshot | null>("local:journeysSnapshot", {
  fallback: null
});

export const tipsSnapshotItem = storage.defineItem<CompanionSnapshot | null>("local:tipsSnapshot", {
  fallback: null
});

/**
 * The sites a browser has refused to let the compose script into at all - Edge answers "the
 * extensions gallery cannot be scripted" for Copilot however the permission was come by, including
 * from a real toolbar click. Local rather than session, because Firefox has no session area and this
 * ships there too; the background empties it on `runtime.onStartup` instead, so a browser that stops
 * refusing is believed again after a restart. It is not one of the `settings`, and an export and a
 * browser-account backup carry only those, so the answer never travels to a machine it is not true
 * on.
 */
export const composeRefusalsItem = storage.defineItem<ComposeSiteId[]>("local:composeRefusals", { fallback: [] });

/**
 * How far round the tip rotation this browser run has got. Edge holds the same count in memory and
 * starts somewhere new every run, so a reader who restarts does not get the same three tips they
 * closed the browser on. A page cannot hold it - the next new tab is a different page - so it lives
 * here.
 */
export const tipsTurnItem = storage.defineItem<number>("local:tipsTurn", { fallback: 0 });

/** Far enough round the catalogue that two runs rarely open on the same three. */
const TIPS_SHUFFLE_RANGE = 10_000;

export async function reshuffleTips() {
  await tipsTurnItem.setValue(Math.floor(Math.random() * TIPS_SHUFFLE_RANGE));
}

/** A refusal is only ever true of the browser run that found it out, so a new run starts with none. */
export async function forgetComposeRefusals() {
  await composeRefusalsItem.removeValue();
}

/** Written by the background, which is the only side that finds out, and only ever adds to the set. */
export async function rememberComposeRefusal(siteId: ComposeSiteId) {
  const refused = await composeRefusalsItem.getValue();
  if (refused.includes(siteId)) {
    return;
  }

  await composeRefusalsItem.setValue([...refused, siteId]);
}
