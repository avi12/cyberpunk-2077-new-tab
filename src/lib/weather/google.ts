import type { WeatherReading } from "./model";
import { toFahrenheit, WeatherCondition, weatherReadingSchema } from "./model";
import { nonEmptyTextSchema } from "@/lib/companion/model";
import type { AccessRequest } from "@/lib/permissions";
import { hasAccess, requestAccess } from "@/lib/permissions";
import type { GeoLocation } from "@/lib/storage/schema";
import { z } from "@/lib/zod";

/**
 * Google's own weather, read off the search page that draws it.
 *
 * There is no API here: the reading is scraped out of the HTML the search returns, which is why this
 * is the source a reader has to hand a site over for. Two measured facts are what make it work at
 * all. The block is only in the page when the request goes out as the signed-in browser, so the
 * fetch has to carry cookies - a cross-origin fetch from an extension page sends none unless it is
 * told to, and telling it to is what the host permission buys. And the block is in the returned
 * markup rather than filled in by script afterwards, so parsing the response is enough; nothing has
 * to run the page.
 *
 * Every way this can fail answers null, never a throw. Turning Google on can only add a source.
 */

/**
 * The origin is spelt once and the permission derived from it, so the address that is fetched and
 * the host that is asked for cannot come apart. `wxt.config.ts` names it a third time and
 * unavoidably: the manifest is built by Node before any of this is bundled.
 */
const SEARCH_URL = "https://www.google.com/search";

const GOOGLE_WEATHER_ACCESS: AccessRequest = {
  origins: [`${new URL(SEARCH_URL).origin}/*`]
};

async function hasGoogleWeatherAccess(): Promise<boolean> {
  return hasAccess(GOOGLE_WEATHER_ACCESS);
}

/** Only ever called straight out of a click: a permission prompt needs the gesture that asked for it. */
export async function requestGoogleWeatherAccess(): Promise<boolean> {
  return requestAccess(GOOGLE_WEATHER_ACCESS);
}

const REQUEST_TIMEOUT_MS = 8000;

const WEATHER_QUERY = "weather in";

const SEARCH_LANGUAGE = "en";

/**
 * The block only appears for a place Google can name. Coordinates are searched as text and answer
 * with ordinary web results - measured, both bare and spelt out as a query - so the query is the
 * location's name. A name Google cannot place, the shipped "Night City" among them, simply has no
 * reading here, and open-meteo, which is asked by coordinate, goes on answering for it.
 *
 * `hl` pins the answer to English, because the condition arrives as words and the words matched
 * below are English ones.
 */
function weatherSearchUrl(placeName: string): string {
  const url = new URL(SEARCH_URL);
  url.searchParams.set("q", `${WEATHER_QUERY} ${placeName}`);
  url.searchParams.set("hl", SEARCH_LANGUAGE);

  return url.href;
}

/**
 * The three ids the reading is taken from. Google draws humidity, wind and precipitation beside
 * them, and none of those are read: the widget shows a temperature and a line of words.
 */
const WEATHER_BLOCK_IDS = {
  displayed: "wob_tm",
  alternate: "wob_ttm",
  description: "wob_dc"
};

/** Google draws a real minus sign in some locales, and it is not the one on the keyboard. */
const TEMPERATURE_TEXT = /^[-−]?\d+(\.\d+)?$/;

const UNICODE_MINUS = /−/;

const temperatureTextSchema = z
  .string()
  .regex(TEMPERATURE_TEXT)
  .transform(text => Number(text.replace(UNICODE_MINUS, "-")));

/**
 * Both numbers are whole degrees rounded from one underlying reading, so the conversion holds only
 * to about a degree and a half - Google showed 29 beside 85, not beside 84. A couple of degrees of
 * slack covers that and is nowhere near enough to let the wrong assignment through: that one is out
 * by the width of the scale.
 */
const CONVERSION_SLACK = 2;

function isFahrenheitOf({ celsius, fahrenheit }: {
  celsius: number;
  fahrenheit: number;
}) {
  return Math.abs(toFahrenheit(celsius) - fahrenheit) <= CONVERSION_SLACK;
}

/**
 * Which of the pair is Celsius is the locale's decision rather than a fixed one, so it is worked out
 * instead of assumed: of the two ways round, only one satisfies f = c * 9 / 5 + 32, and that
 * arithmetic is therefore the whole check. Null when neither does, which is not a page this reads.
 */
function celsiusOf({ displayed, alternate }: {
  displayed: number;
  alternate: number;
}) {
  if (isFahrenheitOf({
    celsius: displayed,
    fahrenheit: alternate
  })) {
    return displayed;
  }

  if (isFahrenheitOf({
    celsius: alternate,
    fahrenheit: displayed
  })) {
    return alternate;
  }

  return null;
}

/**
 * Google answers in words and publishes no list of them, so the match is on the word that decides
 * the icon rather than on the whole phrase: "Scattered showers" and "Light rain" are both rain. The
 * order is part of the mapping - freezing rain is snow before it is rain, and a dust storm is severe
 * before it is anything else.
 *
 * The words are bucketed on their own terms rather than borrowed from the WMO table: fog is a cloud
 * here, which is what it looks like, while open-meteo's own wider buckets stay exactly as they were.
 */
const CONDITION_WORDS: {
  condition: WeatherCondition;
  words: string[];
}[] = [
  {
    condition: WeatherCondition.thunderstorm,
    words: ["thunder", "lightning", "hail"]
  },
  {
    condition: WeatherCondition.snow,
    words: ["snow", "sleet", "blizzard", "flurr", "wintry", "freezing", "ice", "icy"]
  },
  {
    condition: WeatherCondition.rain,
    words: ["rain", "drizzle", "shower", "sprinkle"]
  },
  {
    condition: WeatherCondition.severe,
    words: ["tornado", "cyclone", "hurricane", "squall", "wind", "blustery", "dust", "sand", "smoke", "ash"]
  },
  {
    condition: WeatherCondition.clear,
    words: ["sunny", "clear", "sun"]
  },
  {
    condition: WeatherCondition.cloudy,
    words: ["cloud", "overcast", "fog", "mist", "haze", "dreary"]
  }
];

/**
 * The tail is long and Google owns it, so an unrecognised phrase draws the neutral glyph rather than
 * nothing at all. The reader still reads Google's own words underneath - only the icon is a guess.
 */
const UNKNOWN_CONDITION = WeatherCondition.cloudy;

function conditionFor(description: string): WeatherCondition {
  const phrase = description.toLowerCase();
  for (const { condition, words } of CONDITION_WORDS) {
    if (words.some(word => phrase.includes(word))) {
      return condition;
    }
  }

  return UNKNOWN_CONDITION;
}

const googleBlockSchema = z.object({
  displayed: temperatureTextSchema,
  alternate: temperatureTextSchema,
  description: nonEmptyTextSchema
});

/**
 * A stranger's HTML, so nothing in it is taken on trust. The two temperatures have to read as
 * numbers, they have to be each other's conversion, and what they make has to satisfy the shape
 * every source answers with - the same schema the widget's own reading is typed from.
 */
function readReading(page: Document) {
  function textOf(id: string) {
    return page.getElementById(id)?.textContent?.trim();
  }

  const block = googleBlockSchema.safeParse({
    displayed: textOf(WEATHER_BLOCK_IDS.displayed),
    alternate: textOf(WEATHER_BLOCK_IDS.alternate),
    description: textOf(WEATHER_BLOCK_IDS.description)
  });
  if (!block.success) {
    return null;
  }

  const { description } = block.data;
  const reading = weatherReadingSchema.safeParse({
    temperature: celsiusOf(block.data),
    condition: conditionFor(description),
    description
  });
  if (!reading.success) {
    return null;
  }

  return reading.data;
}

export async function readGoogleWeather(location: GeoLocation): Promise<WeatherReading | null> {
  const placeName = location.name.trim();
  if (!placeName) {
    return null;
  }

  if (!await hasGoogleWeatherAccess()) {
    return null;
  }

  const response = await fetch(weatherSearchUrl(placeName), {
    credentials: "include",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  }).catch(() => null);
  if (!response?.ok) {
    return null;
  }

  const html = await response.text().catch(() => "");

  return readReading(new DOMParser().parseFromString(html, "text/html"));
}
