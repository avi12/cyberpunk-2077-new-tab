import type { WxtStorageItem } from "wxt/utils/storage";

import type { PromptTargetId } from "@/features/companion/prompt-target";
import type { ComposeSiteId } from "@/features/compose/sites";
import type { IconName } from "@/features/netlinks/icons/choices";

import {
  DEFAULT_BACKGROUND,
  DEFAULT_BACKGROUND_BRIGHTNESS,
  DEFAULT_BOOKMARKS,
  DEFAULT_CATEGORY_ORDER,
  DEFAULT_COLOR_THEME,
  DEFAULT_DISPLAY_PREFERENCES,
  DEFAULT_SCAN_LINES_MODE,
  DEFAULT_TAB_FAVICON,
  DEFAULT_TAB_TITLE,
  DEFAULT_USER_NAME,
  DEFAULT_WEATHER_LOCATION,
  DEFAULT_WIDGET_ORDER,
  DEFAULT_WIDGETS,
  IS_METRIC_TEMPERATURE_DEFAULT,
  SHOULD_PLAY_SOUNDS_DEFAULT
} from "./defaults";
import { definePlainItem } from "./plain-item";
import type { Bookmark, ColorTheme, DisplayPreferences, GeoLocation, HourCycle, ScanLinesMode, Widget } from "./schema";
import { BackgroundMediaType, SearchEngineId } from "./schema";

export type StorageItem<TValue> = WxtStorageItem<TValue, Record<string, unknown>>;

export const bookmarksItem = definePlainItem<Bookmark[]>({
  key: "local:bookmarks",
  options: {
    fallback: DEFAULT_BOOKMARKS
  }
});

export const categoryOrderItem = definePlainItem<string[]>({
  key: "local:categoryOrder",
  options: {
    fallback: DEFAULT_CATEGORY_ORDER
  }
});

export const collapsedCategoriesItem = definePlainItem<Record<string, boolean>>({
  key: "local:collapsedCategories",
  options: {
    fallback: {}
  }
});

export const customCategoriesItem = definePlainItem<string[]>({
  key: "local:customCategories",
  options: {
    fallback: []
  }
});

export const activeSearchEngineItem = definePlainItem<SearchEngineId>({
  key: "local:activeSearchEngine",
  options: {
    fallback: SearchEngineId.BROWSER_DEFAULT
  }
});

export const weatherLocationItem = definePlainItem<GeoLocation>({
  key: "local:weatherLocation",
  options: {
    fallback: DEFAULT_WEATHER_LOCATION
  }
});

export const temperatureUnitItem = definePlainItem<boolean>({
  key: "local:temperatureUnit",
  options: {
    fallback: IS_METRIC_TEMPERATURE_DEFAULT
  }
});

export const colorThemeItem = definePlainItem<ColorTheme>({
  key: "local:colorTheme",
  options: {
    fallback: DEFAULT_COLOR_THEME
  }
});

export const displayPreferencesItem = definePlainItem<DisplayPreferences>({
  key: "local:displayPreferences",
  options: {
    fallback: DEFAULT_DISPLAY_PREFERENCES
  }
});

export const backgroundItem = definePlainItem<string>({
  key: "local:background",
  options: {
    fallback: DEFAULT_BACKGROUND
  }
});

export const backgroundBrightnessItem = definePlainItem<number>({
  key: "local:backgroundBrightness",
  options: {
    fallback: DEFAULT_BACKGROUND_BRIGHTNESS
  }
});

export const backgroundMediaTypeItem = definePlainItem<BackgroundMediaType>({
  key: "local:backgroundMediaType",
  options: {
    fallback: BackgroundMediaType.NONE
  }
});

export const backgroundMediaVersionItem = definePlainItem<number>({
  key: "local:backgroundMediaVersion",
  options: {
    fallback: 0
  }
});

export const userNameItem = definePlainItem<string>({
  key: "local:userName",
  options: {
    fallback: DEFAULT_USER_NAME
  }
});

export const widgetsItem = definePlainItem<Widget[]>({
  key: "local:widgets",
  options: {
    fallback: DEFAULT_WIDGETS
  }
});

export const widgetOrderItem = definePlainItem<string[]>({
  key: "local:widgetOrder",
  options: {
    fallback: DEFAULT_WIDGET_ORDER
  }
});

export const scanLinesModeItem = definePlainItem<ScanLinesMode>({
  key: "local:scanLinesMode",
  options: {
    fallback: DEFAULT_SCAN_LINES_MODE
  }
});

export const tabTitleItem = definePlainItem<string>({
  key: "local:tabTitle",
  options: {
    fallback: DEFAULT_TAB_TITLE
  }
});

export const tabFaviconItem = definePlainItem<IconName>({
  key: "local:tabFavicon",
  options: {
    fallback: DEFAULT_TAB_FAVICON
  }
});

export const playSoundsItem = definePlainItem<boolean>({
  key: "local:playSounds",
  options: {
    fallback: SHOULD_PLAY_SOUNDS_DEFAULT
  }
});

/** Absent means the locale decides. Only a press on the clock writes here. */
export const hourCycleItem = definePlainItem<HourCycle | null>({
  key: "local:hourCycle",
  options: {
    fallback: null
  }
});

/** Absent means Copilot, the automatic mode. Only an explicit pick is written here. */
export const promptTargetItem = definePlainItem<PromptTargetId | null>({
  key: "local:promptTarget",
  options: {
    fallback: null
  }
});

export const bookmarksSeededItem = definePlainItem<boolean>({
  key: "local:bookmarksSeeded",
  options: {
    fallback: false
  }
});

/**
 * The app is a separate paid download, so its native host is never contacted until the reader starts
 * setup. The `nativeMessaging` permission is the real authority; this is only read where that is
 * absent, so the two never disagree - see `readCompanion`.
 */
export const companionSetupStartedItem = definePlainItem<boolean>({
  key: "local:companionSetupStarted",
  options: {
    fallback: false
  }
});

/**
 * Durable proof the reader has the paid app, so the panel stops selling it. Written whenever the app
 * answers, even to say it is stopped.
 *
 * Not derivable from the snapshots: tips are filled from Microsoft's public endpoint without the app,
 * and journeys stay empty on an Edge that has not mapped one yet.
 */
export const companionAnsweredItem = definePlainItem<boolean>({
  key: "local:companionAnswered",
  options: {
    fallback: false
  }
});

/**
 * The app's last answer, verbatim. Kept across sessions because a fresh journeys read snapshots a
 * database of tens of megabytes - a visible quarter second. Cards are rebuilt and revalidated on
 * every read, so nothing expired comes back from here.
 */
export interface CompanionSnapshot {
  fetchedAtMs: number;
  raw: unknown[];
}

export const journeysSnapshotItem = definePlainItem<CompanionSnapshot | null>({
  key: "local:journeysSnapshot",
  options: {
    fallback: null
  }
});

export const tipsSnapshotItem = definePlainItem<CompanionSnapshot | null>({
  key: "local:tipsSnapshot",
  options: {
    fallback: null
  }
});

/**
 * Sites a browser or policy refuses the compose script whatever the permission says. `local:` since
 * Firefox has no session area, so the background empties it on `runtime.onStartup` instead. Not one
 * of the `settings`, so it never travels in an export or backup to a machine it is not true on.
 */
export const composeRefusalsItem = definePlainItem<ComposeSiteId[]>({
  key: "local:composeRefusals",
  options: {
    fallback: []
  }
});

/** Mirrors Edge's in-memory rotation, which starts somewhere new every browser run. */
export const tipsTurnItem = definePlainItem<number>({
  key: "local:tipsTurn",
  options: {
    fallback: 0
  }
});

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
export const analyticsClientIdItem = definePlainItem<string | null>({
  key: "local:analyticsClientId",
  options: {
    fallback: null
  }
});

export const analyticsSessionItem = definePlainItem<{
  sessionId: string;
  atMs: number;
} | null>({
  key: "local:analyticsSession",
  options: {
    fallback: null
  }
});

/** Absent is consent. */
export const analyticsOptOutItem = definePlainItem<boolean>({
  key: "local:analyticsOptOut",
  options: {
    fallback: false
  }
});
