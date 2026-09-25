import type { WeatherSky } from "./model";
import { WEATHER_REFRESH_MS, WeatherCondition } from "./model";

/**
 * The shipped fiction, kept away from the model that describes real readings.
 *
 * Everything here is invented and has to look it. It is drawn only over `DEFAULT_WEATHER_LOCATION`
 * and never over a place this machine actually found, so nothing in this file can be mistaken for a
 * measurement.
 */

/** Every one names a district and a kind of weather no real forecast would ever file. */
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

/** Night City is hot and getting hotter, and a range is what makes a number read as a reading. */
const NIGHT_CITY_TEMPERATURE_MIN = 24;
const NIGHT_CITY_TEMPERATURE_MAX = 38;

/** Knuth's multiplicative hash, which is what stops consecutive turns marching down the list. */
const TURN_HASH_FACTOR = 2_654_435_761;
const TURN_HASH_RANGE = 2 ** 32;

/** The same turn asked twice, so the sky and its temperature are not drawn from one number. */
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

/**
 * Night City's weather right now: invented, and no longer frozen.
 *
 * One reading that never moved read as a card that had stopped rather than as a joke, so the sky
 * drifts. A function of the clock and not of chance, which is what makes it safe to call during a
 * render: the same turn always gives the same answer, so nothing flickers between two renders a
 * second apart, and it turns over on the beat a real forecast would be re-read on.
 */
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
