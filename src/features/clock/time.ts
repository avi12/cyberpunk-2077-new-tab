import { HourCycle } from "@/lib/storage/schema";

/** Built once because the clock reformats every second. */
const TIME_PARTS: Intl.DateTimeFormatOptions = {
  hour: "numeric",
  minute: "2-digit"
};

const TIME_FORMAT = new Intl.DateTimeFormat(undefined, TIME_PARTS);

/** Only the cycle is overridden, so a 12-hour Hebrew clock still says the Hebrew day period. */
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

export function localeHourCycle() {
  return TIME_FORMAT.resolvedOptions().hour12 ? HourCycle.hour12 : HourCycle.hour24;
}

const DATE_FORMAT = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric"
});

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
