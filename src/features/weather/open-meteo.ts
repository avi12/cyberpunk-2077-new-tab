import { WeatherCondition } from "./model";
import { fetchJson } from "@/lib/fetch";
import type { GeoLocation } from "@/lib/storage/schema";
import { z } from "@/lib/zod";

/**
 * The source that asks for nothing: an open API, no key, no host permission, answered by coordinate.
 * It is what the widget has always read and what every other source falls back to.
 */

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

const FORECAST_ERROR_MESSAGE = "Weather API error";

/**
 * WMO weather codes, bucketed exactly as the original did: the buckets are wider than the standard
 * code table, and narrowing them would change what the widget says.
 */
function describeWeatherCode(code: number) {
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
function conditionForCode(code: number) {
  if (code <= 1) {
    return WeatherCondition.clear;
  }

  if (code <= 3) {
    return WeatherCondition.cloudy;
  }

  if (code <= 69) {
    return WeatherCondition.rain;
  }

  if (code <= 79) {
    return WeatherCondition.snow;
  }

  if (code <= 94) {
    return WeatherCondition.thunderstorm;
  }

  return WeatherCondition.severe;
}

const forecastSchema = z.object({
  current: z.object({
    temperature_2m: z.number(),
    weather_code: z.number()
  })
});

export async function fetchOpenMeteoWeather(location: GeoLocation) {
  const forecast = await fetchJson({
    url: `${FORECAST_URL}?latitude=${location.latitude}&longitude=${location.longitude}&current=temperature_2m,weather_code`,
    schema: forecastSchema
  });
  if (!forecast) {
    throw new Error(FORECAST_ERROR_MESSAGE);
  }

  const { temperature_2m: temperature, weather_code: weatherCode } = forecast.current;

  return {
    temperature: Math.round(temperature),
    condition: conditionForCode(weatherCode),
    description: describeWeatherCode(weatherCode)
  };
}
