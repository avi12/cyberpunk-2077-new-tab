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
 * Open API: no key, no host permission, no cookies, asked by coordinate so every place has a sky.
 * The only source on Firefox, and the Chromium fallback when Google is not granted or answers without
 * its weather block - see `google.ts`.
 */

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

/** Out-of-range codes are refused by the schema rather than falling through to severe. */
const WMO_CODE_MIN = 0;
const WMO_CODE_MAX = 99;

const SEVERE_SKY: WeatherSky = {
  condition: WeatherCondition.severe,
  description: "Severe weather"
};

/** Deliberately wider than the WMO table: the widget shows one icon and one short line. */
const WEATHER_CODE_BUCKETS: {
  /** Rows are read in order, so each starts after the previous row's maxCode. */
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
    /* Fog draws a cloud rather than rain, which is what it looks like. */
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

function skyForCode(code: number) {
  return WEATHER_CODE_BUCKETS.find(({ maxCode }) => code <= maxCode)?.sky ?? SEVERE_SKY;
}

const CURRENT_FIELDS = "temperature_2m,weather_code";

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

export async function readOpenMeteoWeather(location: GeoLocation) {
  /* Re-validated before the coordinates go into a third party's URL, whatever built the location. */
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
