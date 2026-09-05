import { readGoogleWeather } from "./google";
import type { WeatherReading } from "./model";
import { fetchOpenMeteoWeather } from "./open-meteo";
import type { GeoLocation } from "@/lib/storage/schema";

/**
 * Which source answers, and what happens when it cannot.
 *
 * A widget standing on one free API is a widget that goes away the day that API does, so there is
 * more than one. open-meteo needs no permission and is what the page has always read, which makes it
 * both the default and the floor; Google is the one a reader turns on. The reading they hand back is
 * the same shape either way, so nothing downstream knows which of them answered.
 */

export enum WeatherSourceId {
  openMeteo = "open-meteo",
  google = "google"
}

/** The source that asks for nothing, so the widget works the moment it is on the page. */
export const DEFAULT_WEATHER_SOURCE = WeatherSourceId.openMeteo;

/** A source this build no longer offers reads as the default rather than as one that is not there. */
export function withShippedWeatherSource(stored: WeatherSourceId): WeatherSourceId {
  if (Object.values(WeatherSourceId).includes(stored)) {
    return stored;
  }

  return DEFAULT_WEATHER_SOURCE;
}

/**
 * The reading, from the source the reader chose. Google answers null rather than throwing whenever
 * it cannot - the site was never granted, the page came back without its weather block - and
 * open-meteo is asked in its place, so choosing Google can only ever add a source. Only open-meteo
 * failing is a failure the widget shows, exactly as before.
 */
export async function fetchWeather({ location, sourceId }: {
  location: GeoLocation;
  sourceId: WeatherSourceId;
}): Promise<WeatherReading> {
  if (sourceId === WeatherSourceId.google) {
    const reading = await readGoogleWeather(location);
    if (reading) {
      return reading;
    }
  }

  return fetchOpenMeteoWeather(location);
}
