import { z } from "../zod";

/**
 * The shape of everything this page stores, written once. The types the rest of the app passes
 * around are inferred from these schemas rather than declared beside them, so a setting has exactly
 * one description - and a settings file, which is a stranger's JSON, is checked against the same one
 * the compiler enforces.
 *
 * An enum's string values are the persisted contract, so they live here too.
 */

export enum WidgetType {
  weather = "weather",
  scratchPad = "scratchpad",
  taskList = "tasklist",
  rss = "rss"
}

export enum ColorTheme {
  cyberpunk2077 = "cyberpunk2077",
  edgerunners = "edgerunners",
  cyberNinja = "cyberninja"
}

export enum ScanLinesMode {
  default = "default",
  belowUi = "belowUI",
  none = "none"
}

export enum BackgroundMediaType {
  none = "none",
  image = "image",
  video = "video"
}

export enum SearchEngineId {
  browserDefault = "default",
  google = "google",
  bing = "bing",
  duckDuckGo = "duck",
  chatGpt = "ai",
  perplexity = "ai2",
  brave = "brave",
  braveAi = "brave2",
  braveResearch = "brave3"
}

export enum BookmarkCategory {
  daily = "daily",
  work = "work",
  entertainment = "entertainment",
  social = "social",
  other = "other"
}

/**
 * `category` is a plain string rather than the enum: a reader can add sections of their own, and
 * `icon` names a glyph in the picker, which is free to gain and lose names between builds.
 */
export const bookmarkSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string(),
  category: z.string(),
  icon: z.string()
});

export type Bookmark = z.infer<typeof bookmarkSchema>;

export const searchEngineSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string(),
  placeholder: z.string()
});

export type SearchEngine = z.infer<typeof searchEngineSchema>;

export const geoLocationSchema = z.object({
  name: z.string(),
  latitude: z.number(),
  longitude: z.number()
});

export type GeoLocation = z.infer<typeof geoLocationSchema>;

const taskSchema = z.object({
  id: z.string(),
  text: z.string(),
  completed: z.boolean()
});

export type Task = z.infer<typeof taskSchema>;

/** One bag for every widget's settings, so each widget reads the few keys that are its own. */
const widgetConfigSchema = z.object({
  location: geoLocationSchema.optional(),
  temperatureUnit: z.boolean().optional(),
  showDate: z.boolean().optional(),
  content: z.string().optional(),
  tasks: z.array(taskSchema).optional(),
  feedUrl: z.string().optional(),
  maxItems: z.number().optional()
});

export type WidgetConfig = z.infer<typeof widgetConfigSchema>;

export const widgetSchema = z.object({
  id: z.string(),
  type: z.enum(WidgetType),
  enabled: z.boolean(),
  config: widgetConfigSchema
});

export type Widget = z.infer<typeof widgetSchema>;

/**
 * Every element carries its own default, which is what makes a partial answer readable: preferences
 * written before an element shipped - in storage, or in a settings file exported by an older build -
 * come back with that element on, because an absent answer is not "hidden", it is what the element
 * ships as.
 */
export const displayPreferencesSchema = z.object({
  showGreeting: z.boolean().default(true),
  showTime: z.boolean().default(true),
  showDate: z.boolean().default(true),
  showSearchBar: z.boolean().default(true),
  showQuotes: z.boolean().default(true),
  showJourneys: z.boolean().default(true),
  showNetlinks: z.boolean().default(true),
  showWidgets: z.boolean().default(true)
});

export type DisplayPreferences = z.infer<typeof displayPreferencesSchema>;
