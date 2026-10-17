import { coordinatesSchema } from "./geolocation";
import {
  conditionFor,
  TEMPERATURE_CELSIUS_MAX,
  TEMPERATURE_CELSIUS_MIN,
  weatherReadingSchema,
  WeatherRefusal
} from "./model";
import { nonEmptyTextSchema } from "@/features/companion/model";
import { fetchJson } from "@/lib/fetch";
import { originAccess } from "@/lib/permissions";
import type { GeoLocation } from "@/lib/storage/schema";
import { z } from "@/lib/zod";

/**
 * Bing's weather is MSN's weather: the same service answers bing.com's weather card, msn.com/weather
 * and the Windows widget. Its CORS header is `*.msn.com`, which no extension origin matches, so the
 * read depends on the optional `api.msn.com` grant.
 */

const OVERVIEW_URL = "https://api.msn.com/weatherfalcon/weather/overview";

/** `wxt.config.ts` repeats this origin because the manifest is built before any of this is bundled. */
const BING_WEATHER_ORIGIN = `${new URL(OVERVIEW_URL).origin}/*`;

export const bingWeatherAccess = originAccess(BING_WEATHER_ORIGIN);

/** The key msn.com's own pages ship to every visitor; without it the service answers 401. */
const PUBLIC_API_KEY = "j5i4gDqHL6nGYwx5wi5kRhXjtf2c5qgFX9fzfk0TOo";

/** The service answers in the unit it is told, and `units` in the response repeats which one it used. */
const CELSIUS_REQUEST = "C";
const CELSIUS_SYMBOL = "°C";

/** English, because the condition words matched in `model.ts` are English. */
const LOCALE = "en-US";

const CLIENT_ID = "msftweather";

/** Defaults carry every fixed value, so the only input is the place. */
const overviewQuerySchema = z.object({
  apiKey: z.literal(PUBLIC_API_KEY).default(PUBLIC_API_KEY),
  lat: coordinatesSchema.shape.latitude,
  lon: coordinatesSchema.shape.longitude,
  units: z.literal(CELSIUS_REQUEST).default(CELSIUS_REQUEST),
  locale: z.literal(LOCALE).default(LOCALE),
  ocid: z.literal(CLIENT_ID).default(CLIENT_ID),
  wrapodata: z.literal(false).default(false)
});

/** Loose at every level: the API is undocumented, so fields it adds must not fail the read. */
const overviewSchema = z.looseObject({
  units: z.looseObject({
    temperature: z.literal(CELSIUS_SYMBOL)
  }),
  responses: z.tuple([
    z.looseObject({
      weather: z.tuple([
        z.looseObject({
          current: z.looseObject({
            temp: z.number().min(TEMPERATURE_CELSIUS_MIN).max(TEMPERATURE_CELSIUS_MAX),
            cap: nonEmptyTextSchema
          })
        })
      ], z.unknown())
    })
  ], z.unknown())
});

function overviewUrl(query: z.infer<typeof overviewQuerySchema>) {
  const url = new URL(OVERVIEW_URL);
  for (const [name, value] of Object.entries(query)) {
    url.searchParams.set(name, String(value));
  }

  return url.href;
}

export async function readBingWeather({ latitude, longitude }: GeoLocation) {
  const isAllowed = await bingWeatherAccess.has();
  if (!isAllowed) {
    return WeatherRefusal.noAccess;
  }

  const parsedQuery = overviewQuerySchema.safeParse({
    lat: latitude,
    lon: longitude
  });
  if (!parsedQuery.success) {
    return WeatherRefusal.noPlace;
  }

  const overview = await fetchJson({
    url: overviewUrl(parsedQuery.data),
    schema: overviewSchema
  });
  if (!overview) {
    return WeatherRefusal.unreachable;
  }

  const { temp: temperature, cap: description } = overview.responses[0].weather[0].current;
  const parsedReading = weatherReadingSchema.safeParse({
    temperature: Math.round(temperature),
    condition: conditionFor(description),
    description
  });
  if (!parsedReading.success) {
    return WeatherRefusal.noReading;
  }

  return parsedReading.data;
}
