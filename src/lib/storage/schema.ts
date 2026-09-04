import type { ComposeSiteId } from "../compose/sites";
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
  googleAiMode = "google-ai",
  bing = "bing",
  duckDuckGo = "duck",
  chatGpt = "ai",
  claude = "claude",
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

/**
 * Not a zod schema, unlike everything else here: an engine is shipped with the extension and never
 * arrives from anywhere, so there is no payload to validate - only a shape to hold the authors to.
 */
export type SearchEngine = {
  id: string;
  name: string;
  /** Where the search form posts. Empty for the browser's own engine, which is asked over a message. */
  action: string;
  /** The field the query is written into, since not every engine calls it `q`. */
  queryParam: string;
  /** Anything the engine needs alongside the query, carried as hidden fields. */
  params?: Record<string, string>;
  /**
   * Named only by an engine that fills its box on arrival and then waits to be told to send it. It
   * is what turns a submit into a question about the site, so the last press can be made for the
   * reader rather than left to them.
   */
  composeSiteId?: ComposeSiteId;
  placeholder: string;
};

/**
 * A bound belongs to the shape, not to the control that happens to edit it: the input is one way in,
 * a settings file is another, and only what is written here is checked on both. The controls import
 * these rather than restating them, so a range cannot mean one thing in the markup and another in
 * storage.
 */
export const LATITUDE_MIN = -90;
export const LATITUDE_MAX = 90;
export const LONGITUDE_MIN = -180;
export const LONGITUDE_MAX = 180;

export const geoLocationSchema = z.object({
  name: z.string(),
  latitude: z.number().min(LATITUDE_MIN).max(LATITUDE_MAX),
  longitude: z.number().min(LONGITUDE_MIN).max(LONGITUDE_MAX)
});

export type GeoLocation = z.infer<typeof geoLocationSchema>;

export const BACKGROUND_BRIGHTNESS_MIN = 0;
export const BACKGROUND_BRIGHTNESS_MAX = 200;

export const backgroundBrightnessSchema = z.number().min(BACKGROUND_BRIGHTNESS_MIN).max(BACKGROUND_BRIGHTNESS_MAX);

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
  showCopilot: z.boolean().default(true),
  showNetlinks: z.boolean().default(true),
  showWidgets: z.boolean().default(true)
});

export type DisplayPreferences = z.infer<typeof displayPreferencesSchema>;
