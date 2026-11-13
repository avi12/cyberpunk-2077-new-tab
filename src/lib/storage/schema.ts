import type { ComposeSiteId } from "@/features/compose/sites";
import { openableUrlSchema } from "@/lib/url";
import { z } from "@/lib/zod";

/**
 * The app's types are inferred from these schemas, so an imported settings file is checked against
 * the same shape the compiler enforces. Enum string values are the persisted contract.
 */

export enum WidgetType {
  WEATHER = "weather",
  SCRATCH_PAD = "scratchpad",
  TASK_LIST = "tasklist",
  RSS = "rss"
}

export enum ColorTheme {
  CYBERPUNK2077 = "cyberpunk2077",
  EDGERUNNERS = "edgerunners",
  CYBER_NINJA = "cyberninja"
}

export enum ScanLinesMode {
  DEFAULT = "default",
  BELOW_UI = "belowUI",
  NONE = "none"
}

export enum HourCycle {
  HOUR12 = "12",
  HOUR24 = "24"
}

export enum BackgroundMediaType {
  NONE = "none",
  IMAGE = "image",
  VIDEO = "video"
}

export enum SearchEngineId {
  BROWSER_DEFAULT = "default",
  GOOGLE = "google",
  GOOGLE_AI_MODE = "google-ai",
  BING = "bing",
  DUCK_DUCK_GO = "duck",
  CHAT_GPT = "ai",
  CLAUDE = "claude",
  PERPLEXITY = "ai2",
  BRAVE = "brave",
  BRAVE_AI = "brave2",
  BRAVE_RESEARCH = "brave3",
  COPILOT = "copilot"
}

export enum BookmarkCategory {
  DAILY = "daily",
  WORK = "work",
  ENTERTAINMENT = "entertainment",
  SOCIAL = "social",
  OTHER = "other"
}

/**
 * `category` is a plain string since a reader can add sections of their own, and `icon` is too since
 * the picker gains and loses names between builds. `url` is what stops an imported `javascript:` bookmark.
 */
export const bookmarkSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: openableUrlSchema,
  category: z.string(),
  icon: z.string()
});

export type Bookmark = z.infer<typeof bookmarkSchema>;

/** Not a zod schema: engines ship with the extension, so there is no payload to validate. */
export interface SearchEngine {
  id: SearchEngineId;
  name: string;
  /** Empty for the browser's own engine, which is asked over a message. */
  action: string;
  queryParam: string;
  /** Sent as hidden fields alongside the query. */
  params?: Record<string, string>;
  /** Set when a script has to finish the engine's box on arrival - fill it, send it, or both. */
  composeSiteId?: ComposeSiteId;
  placeholder: string;
}

/** Bounds belong to the shape so an input and an imported file are held to the same range. */
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

export const taskSchema = z.object({
  id: z.string(),
  text: z.string(),
  completed: z.boolean()
});

export type Task = z.infer<typeof taskSchema>;

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
 * Every element carries its own default, so preferences saved before an element shipped read it as
 * its default rather than hidden. Copilot ships off: its cards need Edge plus a separately downloaded
 * app, and without them the row could only ever explain itself.
 */
export const displayPreferencesSchema = z.object({
  showGreeting: z.boolean().default(true),
  showTime: z.boolean().default(true),
  showDate: z.boolean().default(true),
  showSearchBar: z.boolean().default(true),
  showQuotes: z.boolean().default(true),
  showCopilot: z.boolean().default(false),
  showNetlinks: z.boolean().default(true),
  showWidgets: z.boolean().default(true)
});

export type DisplayPreferences = z.infer<typeof displayPreferencesSchema>;
