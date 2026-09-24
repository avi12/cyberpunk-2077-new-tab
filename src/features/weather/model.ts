import iconCloudLightning from "@/assets/icons/cloud-lightning.svg?raw";
import iconCloudRain from "@/assets/icons/cloud-rain.svg?raw";
import iconCloudSnow from "@/assets/icons/cloud-snow.svg?raw";
import iconCloud from "@/assets/icons/cloud.svg?raw";
import iconSun from "@/assets/icons/sun.svg?raw";
import iconWind from "@/assets/icons/wind.svg?raw";
import { nonEmptyTextSchema } from "@/features/companion/model";
import { z } from "@/lib/zod";

/**
 * What a reading is.
 *
 * Google describes the sky in English words and the widget reads none of them directly: the phrase
 * is bucketed into one of six conditions, which is what the icon is chosen by, and Google's own
 * words travel beside it as the line the reader sees. The temperature is always Celsius, so the unit
 * the reader asked for is the only conversion left to make.
 */

export enum WeatherCondition {
  clear = "clear",
  cloudy = "cloudy",
  rain = "rain",
  snow = "snow",
  thunderstorm = "thunderstorm",
  severe = "severe"
}

export const weatherReadingSchema = z.object({
  temperature: z.number(),
  condition: z.enum(WeatherCondition),
  description: nonEmptyTextSchema
});

export type WeatherReading = z.infer<typeof weatherReadingSchema>;

/**
 * What the widget says when Google has nothing to say: the site was never handed over, the place has
 * no name Google can find, or the search came back without its weather block.
 *
 * Invented rather than measured, and it has to look invented - this is the one reading on the page
 * that is not weather. A real city's number under a sky nobody asked about would be a lie; Night
 * City's is the shipped fiction the widget already falls back to for a location, so the sky it gets
 * is the same fiction. It never changes, which is the other half of saying so.
 *
 * It travels with `DEFAULT_WEATHER_LOCATION` and only with it - the widget draws the pair or neither,
 * so this never appears under the reader's own city.
 */
export const NIGHT_CITY_WEATHER: WeatherReading = {
  temperature: 31,
  condition: WeatherCondition.rain,
  description: "Acid rain over Watson"
};

/**
 * Why there is no reading, because the four reasons want four different sentences and the widget
 * used to give them all the same one: Night City's invented sky, with nothing to say it was a
 * stand-in. A reader who had simply never handed the site over saw the same thing as one Google had
 * refused, and neither could tell that anything had gone wrong at all.
 *
 * Only `siteWithheld` is the reader's to fix, which is the whole reason for telling them apart.
 */
export enum WeatherRefusal {
  noPlace = "no-place",
  siteWithheld = "site-withheld",
  unreachable = "unreachable",
  noReading = "no-reading"
}

/** What each refusal says, in the widget's own register - one line, no full stop. */
export const WEATHER_REFUSAL_WORDING: Record<WeatherRefusal, string> = {
  [WeatherRefusal.noPlace]: "Nowhere to read the sky over yet",
  [WeatherRefusal.siteWithheld]: "Allow google.com for a real forecast",
  [WeatherRefusal.unreachable]: "Couldn't reach Google",
  [WeatherRefusal.noReading]: "Google had no forecast for here"
};

/** A reading is an object and a refusal is a word, which is the whole of the test. */
export function isWeatherRefusal(answer: WeatherReading | WeatherRefusal): answer is WeatherRefusal {
  return typeof answer === "string";
}

export const WEATHER_REFRESH_MS = Temporal.Duration.from({ minutes: 15 }).total("milliseconds");

/**
 * The six glyphs the widget draws, one per condition. The set is deliberately coarse - a source with
 * a hundred words for rain is rounded into the nearest of these rather than given a seventh.
 */
export const WEATHER_ICONS: Record<WeatherCondition, {
  svg: string;
  color: string;
}> = {
  [WeatherCondition.clear]: {
    svg: iconSun,
    color: "var(--cp-accent)"
  },
  [WeatherCondition.cloudy]: {
    svg: iconCloud,
    color: "var(--cp-text-dimmer)"
  },
  [WeatherCondition.rain]: {
    svg: iconCloudRain,
    color: "var(--cp-primary)"
  },
  [WeatherCondition.snow]: {
    svg: iconCloudSnow,
    color: "var(--cp-text)"
  },
  [WeatherCondition.thunderstorm]: {
    svg: iconCloudLightning,
    color: "var(--cp-secondary)"
  },
  [WeatherCondition.severe]: {
    svg: iconWind,
    color: "var(--cp-text-dim)"
  }
};

/**
 * The one conversion. The number the widget prints and the arithmetic Google's page is read by are
 * the same scale, so they are the same function.
 */
export function toFahrenheit(celsius: number) {
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

function temperatureFormat(isCelsius: boolean) {
  if (isCelsius) {
    return TEMPERATURE_FORMATS.celsius;
  }

  return TEMPERATURE_FORMATS.fahrenheit;
}

export function formatTemperature({ celsius, isCelsius }: {
  celsius: number;
  isCelsius: boolean;
}) {
  return temperatureFormat(isCelsius).format(isCelsius ? celsius : toFahrenheit(celsius));
}

/** The unit on its own, for the placeholder shown while the first reading is still in flight. */
export function temperatureUnit(isCelsius: boolean) {
  return temperatureFormat(isCelsius)
    .formatToParts(0)
    .filter(part => part.type === "unit")
    .map(part => part.value)
    .join("");
}
