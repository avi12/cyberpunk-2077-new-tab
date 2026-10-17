import iconCloudLightning from "@/assets/icons/cloud-lightning.svg?raw";
import iconCloudRain from "@/assets/icons/cloud-rain.svg?raw";
import iconCloudSnow from "@/assets/icons/cloud-snow.svg?raw";
import iconCloud from "@/assets/icons/cloud.svg?raw";
import iconSun from "@/assets/icons/sun.svg?raw";
import iconWind from "@/assets/icons/wind.svg?raw";
import { nonEmptyTextSchema } from "@/features/companion/model";
import { z } from "@/lib/zod";

export enum WeatherCondition {
  clear = "clear",
  cloudy = "cloudy",
  rain = "rain",
  snow = "snow",
  thunderstorm = "thunderstorm",
  severe = "severe"
}

/**
 * Records are -89.2 and 56.7, with room either side. Readings come from third parties, so an unbounded
 * number like 1e308 would otherwise reach the card.
 */
export const TEMPERATURE_CELSIUS_MIN = -100;
export const TEMPERATURE_CELSIUS_MAX = 70;

export const weatherReadingSchema = z.object({
  temperature: z.number().min(TEMPERATURE_CELSIUS_MIN).max(TEMPERATURE_CELSIUS_MAX),
  condition: z.enum(WeatherCondition),
  description: nonEmptyTextSchema
});

/**
 * Neither Google nor Bing publishes a list of its phrases, so a keyword decides the icon. Order matters: freezing
 * rain is snow before it is rain, and a dust storm is severe before anything else.
 */
const CONDITION_WORDS: {
  condition: WeatherCondition;
  words: string[];
}[] = [
  {
    condition: WeatherCondition.thunderstorm,
    words: ["thunder", "lightning", "hail"]
  },
  {
    condition: WeatherCondition.snow,
    words: ["snow", "sleet", "blizzard", "flurr", "wintry", "freezing", "ice", "icy"]
  },
  {
    condition: WeatherCondition.rain,
    words: ["rain", "drizzle", "shower", "sprinkle"]
  },
  {
    condition: WeatherCondition.severe,
    words: ["tornado", "cyclone", "hurricane", "squall", "wind", "blustery", "dust", "sand", "smoke", "ash"]
  },
  {
    condition: WeatherCondition.clear,
    words: ["sunny", "clear", "sun"]
  },
  {
    condition: WeatherCondition.cloudy,
    words: ["cloud", "overcast", "fog", "mist", "haze", "dreary"]
  }
];

const UNKNOWN_CONDITION = WeatherCondition.cloudy;

export function conditionFor(description: string) {
  const phrase = description.toLowerCase();
  for (const { condition, words } of CONDITION_WORDS) {
    if (words.some(word => phrase.includes(word))) {
      return condition;
    }
  }

  return UNKNOWN_CONDITION;
}

export type WeatherReading = z.infer<typeof weatherReadingSchema>;

/** Decided together from one source answer, so an icon never drifts from the words beside it. */
export type WeatherSky = Pick<WeatherReading, "condition" | "description">;

export enum WeatherRefusal {
  noPlace = "no-place",
  unreachable = "unreachable",
  noReading = "no-reading"
}

/** None may imply a place: a reading and its city fall back together, so the card may say Night City. */
export const WEATHER_REFUSAL_WORDING: Record<WeatherRefusal, string> = {
  [WeatherRefusal.noPlace]: "Nowhere to read the sky over yet",
  [WeatherRefusal.unreachable]: "Couldn't reach the sky",
  [WeatherRefusal.noReading]: "Nothing came back"
};

export function isWeatherRefusal(answer: WeatherReading | WeatherRefusal): answer is WeatherRefusal {
  return typeof answer === "string";
}

export const WEATHER_REFRESH_MS = Temporal.Duration.from({ minutes: 15 }).total("milliseconds");

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

export function toFahrenheit(celsius: number) {
  return Math.round((celsius * 9) / 5 + 32);
}

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

export function temperatureUnit(isCelsius: boolean) {
  return temperatureFormat(isCelsius)
    .formatToParts(0)
    .filter(part => part.type === "unit")
    .map(part => part.value)
    .join("");
}
