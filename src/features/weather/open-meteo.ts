import { coordinatesSchema } from "./geolocation";
import type { WeatherSky } from "./model";
import {
  TEMPERATURE_CELSIUS_MAX,
  TEMPERATURE_CELSIUS_MIN,
  WeatherCondition,
  weatherReadingSchema,
  WeatherRefusal
} from "./model";
import { fetchJson } from "@/lib/fetch";
import type { GeoLocation } from "@/lib/storage/schema";
import { z } from "@/lib/zod";

/**
 * The source that asks for nothing: an open API, no key, no host permission, answered by coordinate.
 *
 * It was here before and was removed in `8148afb`, for sitting underneath Google as a silent
 * fallback - the widget could not say which source had answered, and the panel advertised a second
 * one. That objection was about having *two* sources rather than about this one, and it is gone:
 * this is the only source now, on every engine.
 *
 * What it fixes, measured rather than hoped for. Google draws its weather block with its own script
 * and answers a browser it does not recognise with a shell carrying `enablejs` - so a scraped
 * reading needs an aged Google cookie jar, which a fresh profile, cleared cookies, a container tab
 * or any Firefox never has. This is a JSON API that answers every reader the same way, and it
 * refuses `credentials` outright, so nothing identifying can be attached even by accident.
 *
 * It is asked by **coordinate**, which is the other thing Google could not do: a search is by place
 * name, so bare coordinates typed into the panel were named after themselves and had no forecast at
 * all. Every place the panel can produce has coordinates, so every place now has a sky.
 */

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

/**
 * WMO present-weather codes are two digits, and the table below covers every one of them. A code
 * outside that range is not a sky this can describe, so the schema refuses it rather than letting it
 * fall off the end of the table and be drawn as severe weather.
 */
const WMO_CODE_MIN = 0;
const WMO_CODE_MAX = 99;

/**
 * What a WMO code means, in one table rather than two ladders.
 *
 * It was two: one walking the codes for the words and another walking them again for the icon, with
 * boundaries that did not line up - and they had drifted apart in exactly the way separate ladders
 * over one input do. Fog drew a rain icon and rain showers drew a thunderstorm, each contradicting
 * the sentence printed beside it. One row per bucket cannot disagree with itself.
 *
 * The buckets stay wider than the standard code table, which is deliberate: the widget shows one
 * icon and one short line, and narrowing them would only invent distinctions a reader cannot see.
 */
const SEVERE_SKY: WeatherSky = {
  condition: WeatherCondition.severe,
  description: "Severe weather"
};

const WEATHER_CODE_BUCKETS: {
  /** The highest code this row answers for; rows are read in order, so each starts after the last. */
  maxCode: number;
  sky: WeatherSky;
}[] = [
  {
    maxCode: 0,
    sky: {
      condition: WeatherCondition.clear,
      description: "Clear sky"
    }
  },
  {
    maxCode: 1,
    sky: {
      condition: WeatherCondition.clear,
      description: "Mainly clear"
    }
  },
  {
    maxCode: 2,
    sky: {
      condition: WeatherCondition.cloudy,
      description: "Partly cloudy"
    }
  },
  {
    maxCode: 3,
    sky: {
      condition: WeatherCondition.cloudy,
      description: "Overcast"
    }
  },
  {
    /* A cloud rather than rain, which is what a reader sees when they look up into fog. */
    maxCode: 49,
    sky: {
      condition: WeatherCondition.cloudy,
      description: "Foggy"
    }
  },
  {
    maxCode: 59,
    sky: {
      condition: WeatherCondition.rain,
      description: "Light drizzle"
    }
  },
  {
    maxCode: 69,
    sky: {
      condition: WeatherCondition.rain,
      description: "Rain"
    }
  },
  {
    maxCode: 79,
    sky: {
      condition: WeatherCondition.snow,
      description: "Snow"
    }
  },
  {
    maxCode: 84,
    sky: {
      condition: WeatherCondition.rain,
      description: "Rain showers"
    }
  },
  {
    maxCode: 94,
    sky: {
      condition: WeatherCondition.thunderstorm,
      description: "Thunderstorm"
    }
  },
  {
    maxCode: WMO_CODE_MAX,
    sky: SEVERE_SKY
  }
];

/** The first row the code falls inside. Severe is both the last bucket and the answer to a surprise. */
function skyForCode(code: number) {
  return WEATHER_CODE_BUCKETS.find(({ maxCode }) => code <= maxCode)?.sky ?? SEVERE_SKY;
}

const CURRENT_FIELDS = "temperature_2m,weather_code";

/**
 * What comes back, and only what is read - the answer carries a dozen more fields (the coordinates
 * it snapped to, elevation, timezone, units) and none of them are consulted, so none are described.
 * Both values are bounded rather than merely typed: they arrive from a service this page does not
 * own and end up drawn over a real town.
 */
const forecastSchema = z.object({
  current: z.object({
    temperature_2m: z.number().min(TEMPERATURE_CELSIUS_MIN).max(TEMPERATURE_CELSIUS_MAX),
    weather_code: z.number().int().min(WMO_CODE_MIN).max(WMO_CODE_MAX)
  })
});

function forecastUrl({ latitude, longitude }: z.infer<typeof coordinatesSchema>) {
  const url = new URL(FORECAST_URL);
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set("current", CURRENT_FIELDS);

  return url.href;
}

/**
 * A reading, or which way it came up empty. Never throws: turning the sky on can only add to a card
 * that already knows how to say it has nothing.
 */
export async function readOpenMeteoWeather(location: GeoLocation) {
  /*
   * Checked on the way out as well as on the way back. These two numbers are about to be put in a
   * URL and sent to somebody else's server, and they reached this page through a device API, a
   * third party's JSON or a text field - so the one schema that says what a coordinate may be says
   * it here too, rather than trusting that whoever built the location already asked.
   */
  const parsedLocation = coordinatesSchema.safeParse(location);
  if (!parsedLocation.success) {
    return WeatherRefusal.noPlace;
  }

  const forecast = await fetchJson({
    url: forecastUrl(parsedLocation.data),
    schema: forecastSchema
  });
  if (!forecast) {
    return WeatherRefusal.unreachable;
  }

  const { temperature_2m: temperature, weather_code: weatherCode } = forecast.current;
  const parsedReading = weatherReadingSchema.safeParse({
    temperature: Math.round(temperature),
    ...skyForCode(weatherCode)
  });
  if (!parsedReading.success) {
    return WeatherRefusal.noReading;
  }

  return parsedReading.data;
}
