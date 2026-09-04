import { ComposeSiteId } from "../compose/sites";
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
 * `default` defers to the browser's own configured engine via `chrome.search`; the rest are form
 * targets the page posts to.
 *
 * Each is named the way the product names itself, rather than trimmed to a width. The original
 * padded two of these with trailing spaces to keep the dropdown steady, which HTML collapsed away
 * anyway - the picker sizes itself now.
 */
export const DEFAULT_SEARCH_ENGINES: [SearchEngine, ...SearchEngine[]] = [
  {
    id: SearchEngineId.browserDefault,
    name: "Default",
    action: "",
    queryParam: "q",
    placeholder: "Search with default engine..."
  },
  {
    id: SearchEngineId.google,
    name: "Google",
    action: "https://www.google.com/search",
    queryParam: "q",
    aiEngineId: SearchEngineId.googleAiMode,
    placeholder: "Search the Net..."
  },
  {
    id: SearchEngineId.googleAiMode,
    name: "Google AI Mode",
    action: "https://www.google.com/search",
    queryParam: "q",
    /* The mode is a parameter on ordinary search rather than a page of its own. */
    params: {
      udm: "50"
    },
    placeholder: "Search with an AI..."
  },
  {
    id: SearchEngineId.bing,
    name: "Bing",
    action: "https://www.bing.com/search",
    queryParam: "q",
    placeholder: "Search the Net..."
  },
  {
    id: SearchEngineId.duckDuckGo,
    name: "DuckDuckGo",
    action: "https://duckduckgo.com/",
    queryParam: "q",
    placeholder: "Search the Net securely..."
  },
  {
    id: SearchEngineId.chatGpt,
    name: "ChatGPT",
    action: "https://chatgpt.com/",
    queryParam: "q",
    placeholder: "Query an AI..."
  },
  {
    id: SearchEngineId.claude,
    name: "Claude",
    action: "https://claude.ai/new",
    queryParam: "q",
    /* Reads the prompt out of the URL and puts it in the box, but leaves the sending to whoever asked. */
    composeSiteId: ComposeSiteId.claude,
    placeholder: "Think it through with an AI..."
  },
  {
    id: SearchEngineId.perplexity,
    name: "Perplexity",
    action: "https://www.perplexity.ai/search",
    queryParam: "q",
    placeholder: "Initiate neural search..."
  },
  {
    id: SearchEngineId.brave,
    name: "Brave Search",
    action: "https://search.brave.com/search",
    queryParam: "q",
    aiEngineId: SearchEngineId.braveAi,
    placeholder: "Search the Net securely..."
  },
  {
    id: SearchEngineId.braveAi,
    name: "Ask Brave",
    action: "https://search.brave.com/ask",
    queryParam: "q",
    placeholder: "Query an AI privately..."
  },
  {
    id: SearchEngineId.braveResearch,
    name: "Brave Deep Research",
    action: "https://search.brave.com/ask",
    queryParam: "q",
    params: {
      enable_research: "true"
    },
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
