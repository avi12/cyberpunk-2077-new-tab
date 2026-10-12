import type { WeatherSky } from "./model";
import { WEATHER_REFRESH_MS, WeatherCondition } from "./model";

/** Invented weather, drawn only over `DEFAULT_WEATHER_LOCATION` and never over a real place. */

const NIGHT_CITY_SKIES: [WeatherSky, ...WeatherSky[]] = [
  {
    condition: WeatherCondition.rain,
    description: "Acid rain over Watson"
  },
  {
    condition: WeatherCondition.cloudy,
    description: "Smog haze over Heywood"
  },
  {
    condition: WeatherCondition.thunderstorm,
    description: "Static storm off the coast"
  },
  {
    condition: WeatherCondition.severe,
    description: "Dust in from the Badlands"
  },
  {
    condition: WeatherCondition.clear,
    description: "Hard sun on Corpo Plaza"
  },
  {
    condition: WeatherCondition.cloudy,
    description: "Low cloud over Pacifica"
  },
  {
    condition: WeatherCondition.rain,
    description: "Drizzle in Japantown"
  },
  {
    condition: WeatherCondition.snow,
    description: "Ash falling on Santo Domingo"
  }
];

const NIGHT_CITY_TEMPERATURE_MIN = 24;
const NIGHT_CITY_TEMPERATURE_MAX = 38;

/** Knuth's multiplicative hash, so consecutive turns don't walk down the list in order. */
const TURN_HASH_FACTOR = 2_654_435_761;
const TURN_HASH_RANGE = 2 ** 32;

/** Hashes the same turn differently, so the sky and its temperature are not drawn from one number. */
const TEMPERATURE_TURN_OFFSET = 40_503;

function fractionOf(turn: number) {
  return (Math.imul(turn, TURN_HASH_FACTOR) >>> 0) / TURN_HASH_RANGE;
}

function pickedFrom<TItem>({ items, fraction }: {
  items: [TItem, ...TItem[]];
  fraction: number;
}) {
  return items[Math.floor(fraction * items.length)] ?? items[0];
}

/** Derived from the clock rather than chance, so it is stable across renders and changes once per refresh. */
export function nightCitySky() {
  const turn = Math.floor(Temporal.Now.instant().epochMilliseconds / WEATHER_REFRESH_MS);
  const degreesOfRoom = NIGHT_CITY_TEMPERATURE_MAX - NIGHT_CITY_TEMPERATURE_MIN;

  return {
    ...pickedFrom({
      items: NIGHT_CITY_SKIES,
      fraction: fractionOf(turn)
    }),
    temperature: NIGHT_CITY_TEMPERATURE_MIN + Math.round(fractionOf(turn + TEMPERATURE_TURN_OFFSET) * degreesOfRoom)
  };
}
