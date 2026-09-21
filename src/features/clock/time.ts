import { HourCycle } from "@/lib/storage/schema";

/**
 * Intl decides how a time reads - whether there is a day period, what it is called and where it
 * sits, how the hour is padded, what separates it from the minute - so nothing here spells any of
 * that out. Built once because the clock reformats every second.
 */
const TIME_PARTS: Intl.DateTimeFormatOptions = {
  hour: "numeric",
  minute: "2-digit"
};

const TIME_FORMAT = new Intl.DateTimeFormat(undefined, TIME_PARTS);

/**
 * The same format with the clock the reader asked for rather than the one their locale assumes.
 * Only the cycle is overridden: everything else about how the time reads is still the locale's,
 * which is why a 12-hour Hebrew clock still says the Hebrew day period.
 */
const TIME_FORMATS: Record<HourCycle, Intl.DateTimeFormat> = {
  [HourCycle.hour12]: new Intl.DateTimeFormat(undefined, {
    ...TIME_PARTS,
    hourCycle: "h12"
  }),
  [HourCycle.hour24]: new Intl.DateTimeFormat(undefined, {
    ...TIME_PARTS,
    hourCycle: "h23"
  })
};

/** Which of the two the locale reads as, so the first press is the one that visibly changes it. */
export function localeHourCycle() {
  return TIME_FORMAT.resolvedOptions().hour12 ? HourCycle.hour12 : HourCycle.hour24;
}

const DATE_FORMAT = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric"
});

/** A moment that has already passed, spelled out: the reader's locale decides how much of it shows. */
const TIMESTAMP_FORMAT = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short"
});

export function formatTimestamp(atMs: number) {
  return TIMESTAMP_FORMAT.format(Temporal.Instant.fromEpochMilliseconds(atMs));
}

export function currentTime(hourCycle: HourCycle) {
  return TIME_FORMATS[hourCycle].format(Temporal.Now.plainTimeISO());
}

export function currentDate() {
  return DATE_FORMAT.format(Temporal.Now.plainDateISO());
}

export function currentDateIso() {
  return Temporal.Now.plainDateISO().toString();
}

/** `<time datetime>` is a machine format, so it stays 24-hour whatever the locale reads like. */
export function currentTimeIso() {
  return Temporal.Now.plainTimeISO().toString({ smallestUnit: "minute" });
}

const MORNING_START_HOUR = 5;
const AFTERNOON_START_HOUR = 12;
const EVENING_START_HOUR = 17;
const NIGHT_START_HOUR = 21;

function timeOfDay(hours: number) {
  if (hours >= MORNING_START_HOUR && hours < AFTERNOON_START_HOUR) {
    return "Morning";
  }

  if (hours >= AFTERNOON_START_HOUR && hours < EVENING_START_HOUR) {
    return "Afternoon";
  }

  if (hours >= EVENING_START_HOUR && hours < NIGHT_START_HOUR) {
    return "Evening";
  }

  return "Night";
}

export function greeting(userName: string) {
  return `${timeOfDay(Temporal.Now.plainTimeISO().hour)}, ${userName}`;
}
