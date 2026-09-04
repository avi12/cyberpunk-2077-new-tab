import type { IconName } from "../icons/choices";
import type { Bookmark, GeoLocation, SearchEngine, Widget } from "./schema";
import {
  BookmarkCategory,
  ColorTheme,
  displayPreferencesSchema,
  ScanLinesMode,
  SearchEngineId,
  WidgetType
} from "./schema";

/**
 * What every setting starts at, and the fixed lists the panels pick from. The shapes themselves live
 * in `schema.ts` - this file only ever names a value one of them can take.
 */

export type SelectOption<TValue extends string> = {
  value: TValue;
  label: string;
};

export const DEFAULT_CATEGORY_ORDER: string[] = [
  BookmarkCategory.daily,
  BookmarkCategory.work,
  BookmarkCategory.entertainment,
  BookmarkCategory.social,
  BookmarkCategory.other
];

export const SEEDED_CATEGORY = BookmarkCategory.daily;

export const DEFAULT_BOOKMARKS: Bookmark[] = [];

/**
 * `default` defers to the browser's own configured engine via `chrome.search`; the rest are plain
 * query-string redirects. Two names carry trailing non-breaking spaces because the original used
 * them to pad the dropdown to a consistent width.
 */
export const DEFAULT_SEARCH_ENGINES: [SearchEngine, ...SearchEngine[]] = [
  {
    id: SearchEngineId.browserDefault,
    name: "Default",
    url: "chrome-extension-search://",
    placeholder: "Search with default engine..."
  },
  {
    id: SearchEngineId.google,
    name: "Google",
    url: "https://www.google.com/search?q=",
    placeholder: "Search the Net..."
  },
  {
    id: SearchEngineId.bing,
    name: "Bing  ",
    url: "https://www.bing.com/search?q=",
    placeholder: "Search the Net..."
  },
  {
    id: SearchEngineId.duckDuckGo,
    name: "DuckDuck",
    url: "https://duckduckgo.com/?q=",
    placeholder: "Search the Net securely..."
  },
  {
    id: SearchEngineId.chatGpt,
    name: "ChatGPT",
    url: "https://www.chatgpt.com/?q=",
    placeholder: "Query an AI..."
  },
  {
    id: SearchEngineId.perplexity,
    name: "Perplex",
    url: "https://www.perplexity.ai/search?q=",
    placeholder: "Initiate neural search..."
  },
  {
    id: SearchEngineId.brave,
    name: "Brave ",
    url: "https://search.brave.com/search?q=",
    placeholder: "Search the Net securely..."
  },
  {
    id: SearchEngineId.braveAi,
    name: "BraveAI",
    url: "https://search.brave.com/ask?q=",
    placeholder: "Query an AI privately..."
  },
  {
    id: SearchEngineId.braveResearch,
    name: "Research",
    url: "https://search.brave.com/ask?enable_research=true&q=",
    placeholder: "Research with an AI..."
  }
];

export const DEFAULT_WEATHER_LOCATION: GeoLocation = {
  name: "Night City",
  latitude: 37.7749,
  longitude: -122.4194
};

export const DEFAULT_WIDGETS: Widget[] = [
  {
    id: "weather-1",
    type: WidgetType.weather,
    enabled: true,
    config: {
      temperatureUnit: true
    }
  },
  {
    id: "scratchpad-1",
    type: WidgetType.scratchPad,
    enabled: false,
    config: {
      content: ""
    }
  },
  {
    id: "tasklist-1",
    type: WidgetType.taskList,
    enabled: false,
    config: {
      tasks: []
    }
  },
  {
    id: "rss-1",
    type: WidgetType.rss,
    enabled: false,
    config: {
      feedUrl: "",
      maxItems: 10
    }
  }
];

export const DEFAULT_WIDGET_ORDER = DEFAULT_WIDGETS.map(widget => widget.id);

/** Each element's default is the one the schema fills a missing answer with. */
export const DEFAULT_DISPLAY_PREFERENCES = displayPreferencesSchema.parse({});

/* What the page paints under an image or a video, so a solid colour is in effect either way. */
export const BASE_BACKGROUND_COLOR = "#000c14";

export const BACKGROUND_COLORS: SelectOption<string>[] = [
  {
    value: BASE_BACKGROUND_COLOR,
    label: "Dark"
  },
  {
    value: "#2d0a22",
    label: "Cyber Pink"
  },
  {
    value: "#0a1a2d",
    label: "Neo Blue"
  },
  {
    value: "#0a2d0a",
    label: "Matrix Green"
  }
];

export const DEFAULT_BACKGROUND =
  "https://images.pexels.com/photos/3052361/pexels-photo-3052361.jpeg?auto=compress&cs=tinysrgb&w=1600";

export const BACKGROUND_IMAGES: SelectOption<string>[] = [
  {
    value: "https://images.pexels.com/photos/1470405/pexels-photo-1470405.jpeg?auto=compress&cs=tinysrgb&w=1600",
    label: "City Night"
  },
  {
    value: DEFAULT_BACKGROUND,
    label: "Neon City"
  },
  {
    value: "https://images.pexels.com/photos/3075993/pexels-photo-3075993.jpeg?auto=compress&cs=tinysrgb&w=1600",
    label: "Cyber District"
  },
  {
    value: "https://images.pexels.com/photos/325229/pexels-photo-325229.jpeg?auto=compress&cs=tinysrgb&w=1600",
    label: "Data Center"
  }
];

export const COLOR_THEMES: SelectOption<ColorTheme>[] = [
  {
    value: ColorTheme.cyberpunk2077,
    label: "Cyberpunk 2077"
  },
  {
    value: ColorTheme.edgerunners,
    label: "Edgerunners"
  },
  {
    value: ColorTheme.cyberNinja,
    label: "Cyber Ninja"
  }
];

export const SCAN_LINES_MODES: SelectOption<ScanLinesMode>[] = [
  {
    value: ScanLinesMode.default,
    label: "Default"
  },
  {
    value: ScanLinesMode.belowUi,
    label: "Below UI"
  },
  {
    value: ScanLinesMode.none,
    label: "None"
  }
];

export const DEFAULT_USER_NAME = "V";
export const DEFAULT_COLOR_THEME = ColorTheme.cyberpunk2077;
export const DEFAULT_SCAN_LINES_MODE = ScanLinesMode.default;
export const DEFAULT_TAB_TITLE = "Cyberpunk 2077";
export const DEFAULT_TAB_FAVICON: IconName = "Terminal";
export const DEFAULT_PLAY_SOUNDS = true;
export const DEFAULT_BACKGROUND_BRIGHTNESS = 100;

/** `true` means the metric reading, matching the original's boolean. */
export const DEFAULT_TEMPERATURE_UNIT = true;
