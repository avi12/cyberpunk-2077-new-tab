import { conditionFor, toFahrenheit, weatherReadingSchema } from "./model";
import { nonEmptyTextSchema } from "@/features/companion/model";
import { fetchDocument } from "@/lib/fetch";
import type { AccessRequest } from "@/lib/permissions";
import { hasAccess, requestAccess } from "@/lib/permissions";
import type { GeoLocation } from "@/lib/storage/schema";
import { z } from "@/lib/zod";

/**
 * Google's weather, scraped from the search page HTML (measured: the block is in the returned markup).
 * It only appears when the request carries the signed-in browser's cookies - hence the optional
 * google.com grant and `credentials: "include"` - and only for an aged Google cookie jar.
 *
 * Chromium only, ahead of open-meteo: Firefox never sends the Google cookie jar from an extension
 * page. Every failure answers null so the widget falls back to open-meteo.
 */

/** `wxt.config.ts` repeats this origin because the manifest is built before any of this is bundled. */
const SEARCH_URL = "https://www.google.com/search";

export const GOOGLE_WEATHER_ORIGIN = `${new URL(SEARCH_URL).origin}/*`;

const GOOGLE_WEATHER_ACCESS: AccessRequest = {
  origins: [GOOGLE_WEATHER_ORIGIN]
};

export async function hasGoogleWeatherAccess() {
  return hasAccess(GOOGLE_WEATHER_ACCESS);
}

/** Call straight from a click: a permission prompt needs the user gesture. */
export async function requestGoogleWeatherAccess() {
  return requestAccess(GOOGLE_WEATHER_ACCESS);
}

const REQUEST_TIMEOUT_MS = 8000;

const WEATHER_QUERY = "weather in";

const SEARCH_LANGUAGE = "en";

/**
 * Searched by place name: coordinates answer with ordinary web results (measured). `hl` pins English
 * because the condition words matched below are English.
 */
function weatherSearchUrl(placeName: string) {
  const url = new URL(SEARCH_URL);
  url.searchParams.set("q", `${WEATHER_QUERY} ${placeName}`);
  url.searchParams.set("hl", SEARCH_LANGUAGE);

  return url.href;
}

const WEATHER_BLOCK_IDS = {
  displayed: "wob_tm",
  alternate: "wob_ttm",
  description: "wob_dc"
};

/** Some locales draw a Unicode minus sign rather than a hyphen. */
const TEMPERATURE_TEXT = /^[-−]?\d+(\.\d+)?$/;

const UNICODE_MINUS = /−/;

const temperatureTextSchema = z
  .string()
  .regex(TEMPERATURE_TEXT)
  .transform(text => Number(text.replace(UNICODE_MINUS, "-")));

/**
 * Both values are rounded from one reading, so they disagree by up to about 1.5 degrees (Google showed
 * 29 beside 85). The wrong pairing is off by far more.
 */
const CONVERSION_SLACK = 2;

function isFahrenheitOf({ celsius, fahrenheit }: {
  celsius: number;
  fahrenheit: number;
}) {
  return Math.abs(toFahrenheit(celsius) - fahrenheit) <= CONVERSION_SLACK;
}

/**
 * The locale decides which value is Celsius, so it is the one whose pairing satisfies
 * f = c * 9 / 5 + 32. Null when neither does.
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

const googleBlockSchema = z.object({
  displayed: temperatureTextSchema,
  alternate: temperatureTextSchema,
  description: nonEmptyTextSchema
});

function readingFromPage(page: Document) {
  function textOf(id: string) {
    return page.getElementById(id)?.textContent?.trim();
  }

  const parsedBlock = googleBlockSchema.safeParse({
    displayed: textOf(WEATHER_BLOCK_IDS.displayed),
    alternate: textOf(WEATHER_BLOCK_IDS.alternate),
    description: textOf(WEATHER_BLOCK_IDS.description)
  });
  if (!parsedBlock.success) {
    return null;
  }

  const { description } = parsedBlock.data;
  const parsedReading = weatherReadingSchema.safeParse({
    temperature: celsiusOf(parsedBlock.data),
    condition: conditionFor(description),
    description
  });
  if (!parsedReading.success) {
    return null;
  }

  return parsedReading.data;
}

export async function readGoogleWeather(location: GeoLocation) {
  const placeName = location.name.trim();
  const isAskable = placeName !== "" && await hasGoogleWeatherAccess();
  if (!isAskable) {
    return null;
  }

  const page = await fetchDocument({
    url: weatherSearchUrl(placeName),
    init: {
      credentials: "include"
    },
    timeoutMs: REQUEST_TIMEOUT_MS
  });
  if (!page) {
    return null;
  }

  return readingFromPage(page);
}
