import { bingWeatherAccess } from "./bing";
import { googleWeatherAccess, IS_GOOGLE_READABLE } from "./google";

/**
 * Every site the weather can be read through, as the panel ticks them and the widget listens for
 * them. A source is listed only where its browser can read it.
 */
export const WEATHER_SOURCES = [
  {
    label: "Allow api.msn.com",
    isOffered: true,
    access: bingWeatherAccess
  },
  {
    label: "Allow google.com",
    isOffered: IS_GOOGLE_READABLE,
    access: googleWeatherAccess
  }
].filter(source => source.isOffered);
