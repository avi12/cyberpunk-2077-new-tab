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
import { definePlainItem } from "./plain-item";
import type {
  Bookmark,
  ColorTheme,
  DisplayPreferences,
  GeoLocation,
  HourCycle,
  ScanLinesMode,
  Widget
} from "./schema";
import { BackgroundMediaType, SearchEngineId } from "./schema";
import type { PromptTargetId } from "@/features/companion/prompt-target";
import type { ComposeSiteId } from "@/features/compose/sites";
import type { IconName } from "@/features/netlinks/icons/choices";
import type { WxtStorageItem } from "wxt/utils/storage";

export type StorageItem<TValue> = WxtStorageItem<TValue, Record<string, unknown>>;

export const bookmarksItem = definePlainItem<Bookmark[]>("local:bookmarks", { fallback: DEFAULT_BOOKMARKS });

export const categoryOrderItem = definePlainItem<string[]>("local:categoryOrder", { fallback: DEFAULT_CATEGORY_ORDER });

export const collapsedCategoriesItem = definePlainItem<Record<string, boolean>>("local:collapsedCategories", {
  fallback: {}
});

export const customCategoriesItem = definePlainItem<string[]>("local:customCategories", { fallback: [] });

export const activeSearchEngineItem = definePlainItem<SearchEngineId>("local:activeSearchEngine", { fallback: SearchEngineId.browserDefault });

export const weatherLocationItem = definePlainItem<GeoLocation>("local:weatherLocation", { fallback: DEFAULT_WEATHER_LOCATION });

export const temperatureUnitItem = definePlainItem<boolean>("local:temperatureUnit", { fallback: DEFAULT_TEMPERATURE_UNIT });

export const colorThemeItem = definePlainItem<ColorTheme>("local:colorTheme", { fallback: DEFAULT_COLOR_THEME });

export const displayPreferencesItem = definePlainItem<DisplayPreferences>("local:displayPreferences", { fallback: DEFAULT_DISPLAY_PREFERENCES });

export const backgroundItem = definePlainItem<string>("local:background", { fallback: DEFAULT_BACKGROUND });

export const backgroundBrightnessItem = definePlainItem<number>("local:backgroundBrightness", { fallback: DEFAULT_BACKGROUND_BRIGHTNESS });

export const backgroundMediaTypeItem = definePlainItem<BackgroundMediaType>("local:backgroundMediaType", { fallback: BackgroundMediaType.none });

export const backgroundMediaVersionItem = definePlainItem<number>("local:backgroundMediaVersion", { fallback: 0 });

export const userNameItem = definePlainItem<string>("local:userName", { fallback: DEFAULT_USER_NAME });

export const widgetsItem = definePlainItem<Widget[]>("local:widgets", { fallback: DEFAULT_WIDGETS });

export const widgetOrderItem = definePlainItem<string[]>("local:widgetOrder", { fallback: DEFAULT_WIDGET_ORDER });

export const scanLinesModeItem = definePlainItem<ScanLinesMode>("local:scanLinesMode", { fallback: DEFAULT_SCAN_LINES_MODE });

export const tabTitleItem = definePlainItem<string>("local:tabTitle", { fallback: DEFAULT_TAB_TITLE });

export const tabFaviconItem = definePlainItem<IconName>("local:tabFavicon", { fallback: DEFAULT_TAB_FAVICON });

export const playSoundsItem = definePlainItem<boolean>("local:playSounds", { fallback: DEFAULT_PLAY_SOUNDS });

/** Absent means the locale decides. Only a press on the clock writes here. */
export const hourCycleItem = definePlainItem<HourCycle | null>("local:hourCycle", { fallback: null });

/** Absent means Copilot, the automatic mode. Only an explicit pick is written here. */
export const promptTargetItem = definePlainItem<PromptTargetId | null>("local:promptTarget", { fallback: null });

export const bookmarksSeededItem = definePlainItem<boolean>("local:bookmarksSeeded", { fallback: false });

/**
 * The app is a separate paid download, so its native host is never contacted until the reader starts
 * setup. The `nativeMessaging` permission is the real authority; this is only read where that is
 * absent, so the two never disagree - see `readCompanion`.
 */
export const companionSetupStartedItem = definePlainItem<boolean>("local:companionSetupStarted", { fallback: false });

/**
 * Durable proof the reader has the paid app, so the panel stops selling it. Written whenever the app
 * answers, even to say it is stopped.
 *
 * Not derivable from the snapshots: tips are filled from Microsoft's public endpoint without the app,
 * and journeys stay empty on an Edge that has not mapped one yet.
 */
export const companionAnsweredItem = definePlainItem<boolean>("local:companionAnswered", { fallback: false });

/**
 * The app's last answer, verbatim. Kept across sessions because a fresh journeys read snapshots a
 * database of tens of megabytes - a visible quarter second. Cards are rebuilt and revalidated on
 * every read, so nothing expired comes back from here.
 */
export type CompanionSnapshot = {
  fetchedAtMs: number;
  raw: unknown[];
};

export const journeysSnapshotItem = definePlainItem<CompanionSnapshot | null>("local:journeysSnapshot", {
  fallback: null
});

export const tipsSnapshotItem = definePlainItem<CompanionSnapshot | null>("local:tipsSnapshot", {
  fallback: null
});

/**
 * Sites a browser or policy refuses the compose script whatever the permission says. `local:` since
 * Firefox has no session area, so the background empties it on `runtime.onStartup` instead. Not one
 * of the `settings`, so it never travels in an export or backup to a machine it is not true on.
 */
export const composeRefusalsItem = definePlainItem<ComposeSiteId[]>("local:composeRefusals", { fallback: [] });

/** Mirrors Edge's in-memory rotation, which starts somewhere new every browser run. */
export const tipsTurnItem = definePlainItem<number>("local:tipsTurn", { fallback: 0 });

/** Far enough round the catalogue that two runs rarely open on the same three. */
const TIPS_SHUFFLE_RANGE = 10_000;

export async function reshuffleTips() {
  await tipsTurnItem.setValue(Math.floor(Math.random() * TIPS_SHUFFLE_RANGE));
}

export async function forgetComposeRefusals() {
  await composeRefusalsItem.removeValue();
}

export async function rememberComposeRefusal(siteId: ComposeSiteId) {
  const refused = await composeRefusalsItem.getValue();
  if (refused.includes(siteId)) {
    return;
  }

  await composeRefusalsItem.setValue([...refused, siteId]);
}

/** `local:` rather than `sync:`: an install is this machine, not the browser account. */
export const analyticsClientIdItem = definePlainItem<string | null>("local:analyticsClientId", {
  fallback: null
});

export const analyticsSessionItem = definePlainItem<{
  sessionId: string;
  atMs: number;
} | null>(
  "local:analyticsSession",
  { fallback: null }
);

/** Absent is consent. */
export const analyticsOptOutItem = definePlainItem<boolean>("local:analyticsOptOut", { fallback: false });
