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
 * A reading's two halves that are decided together and never separately: what the sky is doing and
 * what to call it. A source works this pair out from one answer of its own - a WMO code, a district
 * of Night City - so keeping them in one type is what stops an icon drifting from the words beside
 * it.
 */
export type WeatherSky = Pick<WeatherReading, "condition" | "description">;

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

/**
 * What each refusal says on the widget, in its own register - one line, no full stop.
 *
 * `siteWithheld` is deliberately absent, and that absence is the rule: the widget is not where a
 * permission is discussed. A reader who has not handed the site over would otherwise be told to on
 * every new tab they open, by a card that cannot even ask - and the asking is what makes the
 * sentence worth reading. That conversation belongs to the location panel alone, where a press puts
 * the question and a refusal is answered on the spot.
 *
 * A refusal with nothing to say here leaves the fallback's own line, exactly as before.
 */
export const WEATHER_REFUSAL_WORDING: Partial<Record<WeatherRefusal, string>> = {
  [WeatherRefusal.noPlace]: "Nowhere to read the sky over yet",
  [WeatherRefusal.unreachable]: "Couldn't reach Google",
  /*
   * Not "for here", which is what this said first and what made it wrong: a reading and its city
   * fall back together, so by the time the line is read the card says Night City - and Night City is
   * the one place Google is never asked about. The sentence pointed at the fiction and blamed Google
   * for it. None of these three may name or imply a place for that reason.
   */
  [WeatherRefusal.noReading]: "Google wouldn't say"
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
