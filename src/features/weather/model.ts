import iconCloudLightning from "@/assets/icons/cloud-lightning.svg?raw";
import iconCloudRain from "@/assets/icons/cloud-rain.svg?raw";
import iconCloudSnow from "@/assets/icons/cloud-snow.svg?raw";
import iconCloud from "@/assets/icons/cloud.svg?raw";
import iconSun from "@/assets/icons/sun.svg?raw";
import iconWind from "@/assets/icons/wind.svg?raw";
import { nonEmptyTextSchema } from "@/features/companion/model";
import { z } from "@/lib/zod";

/**
 * What a reading is, whichever source answered.
 *
 * Each source describes the sky in a vocabulary of its own - open-meteo in WMO codes, Google in
 * English words - and the widget reads neither. Both are translated into one of six conditions,
 * which is what the icon is chosen by, and the source's own words travel beside it as the line the
 * reader sees. The temperature is always Celsius, so the unit the reader asked for is the only
 * conversion left to make.
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
