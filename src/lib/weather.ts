import {
  Cloud,
  CloudLightning,
  CloudRain,
  CloudSnow,
  Sun,
  Wind
} from "./icons/nodes";
import type { IconNode } from "./icons/types";
import type { GeoLocation } from "./storage/defaults";
import { z } from "./zod";

export type WeatherReading = {
  temperature: number;
  weatherCode: number;
  description: string;
};

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

export const WEATHER_REFRESH_MS = 900_000;

/**
 * WMO weather codes, bucketed exactly as the original did: the buckets are wider than the standard
 * code table, and narrowing them would change what the widget says.
 */
function describeWeatherCode(code: number): string {
  if (code === 0) {
    return "Clear sky";
  }

  if (code === 1) {
    return "Mainly clear";
  }

  if (code === 2) {
    return "Partly cloudy";
  }

  if (code === 3) {
    return "Overcast";
  }

  if (code <= 49) {
    return "Foggy";
  }

  if (code <= 59) {
    return "Light drizzle";
  }

  if (code <= 69) {
    return "Rain";
  }

  if (code <= 79) {
    return "Snow";
  }

  if (code <= 84) {
    return "Rain showers";
  }

  if (code <= 94) {
    return "Thunderstorm";
  }

  return "Severe weather";
}

/** The icon buckets do not line up with the description buckets - that is the original's shape. */
export function weatherIcon(code: number): {
  node: IconNode;
  color: string;
} {
  if (code <= 1) {
    return {
      node: Sun,
      color: "var(--cp-accent)"
    };
  }

  if (code <= 3) {
    return {
      node: Cloud,
      color: "var(--cp-text-dimmer)"
    };
  }

  if (code <= 69) {
    return {
      node: CloudRain,
      color: "var(--cp-primary)"
    };
  }

  if (code <= 79) {
    return {
      node: CloudSnow,
      color: "var(--cp-text)"
    };
  }

  if (code <= 94) {
    return {
      node: CloudLightning,
      color: "var(--cp-secondary)"
    };
  }

  return {
    node: Wind,
    color: "var(--cp-text-dim)"
  };
}

function toFahrenheit(celsius: number): number {
  return Math.round((celsius * 9) / 5 + 32);
}

/** Intl writes the degree sign and the unit, in the order and spacing the locale uses. */
const TEMPERATURE_FORMATS = {
  celsius: new Intl.NumberFormat(undefined, {
    style: "unit",
    unit: "celsius",
    maximumFractionDigits: 0
  }),
  fahrenheit: new Intl.NumberFormat(undefined, {
    style: "unit",
    unit: "fahrenheit",
    maximumFractionDigits: 0
  })
};

function temperatureFormat(isCelsius: boolean): Intl.NumberFormat {
  if (isCelsius) {
    return TEMPERATURE_FORMATS.celsius;
  }

  return TEMPERATURE_FORMATS.fahrenheit;
}

export function formatTemperature({ celsius, isCelsius }: {
  celsius: number;
  isCelsius: boolean;
}): string {
  if (isCelsius) {
    return TEMPERATURE_FORMATS.celsius.format(celsius);
  }

  return TEMPERATURE_FORMATS.fahrenheit.format(toFahrenheit(celsius));
}

/** The unit on its own, for the placeholder shown while the first reading is still in flight. */
export function temperatureUnit(isCelsius: boolean): string {
  return temperatureFormat(isCelsius)
    .formatToParts(0)
    .filter(part => part.type === "unit")
    .map(part => part.value)
    .join("");
}

const forecastSchema = z.object({
  current: z.object({
    temperature_2m: z.number(),
    weather_code: z.number()
  })
});

export async function fetchWeather(location: GeoLocation): Promise<WeatherReading> {
  const url = `${FORECAST_URL}?latitude=${location.latitude}&longitude=${location.longitude}&current=temperature_2m,weather_code`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Weather API error");
  }

  const parsed = forecastSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new Error("Weather API error");
  }

  const { temperature_2m: temperature, weather_code: weatherCode } = parsed.data.current;

  return {
    temperature: Math.round(temperature),
    weatherCode,
    description: describeWeatherCode(weatherCode)
  };
}
