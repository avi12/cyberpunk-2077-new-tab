/**
 * Intl decides how a time reads - 24-hour or not, whether there is a day period, what it is called
 * and where it sits - from the locale alone, so there is nothing here to spell out or configure.
 * Built once because the clock reformats every second.
 */
const TIME_FORMAT = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit"
});

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
  return TIMESTAMP_FORMAT.format(atMs);
}

export function currentTime() {
  return TIME_FORMAT.format(new Date());
}

export function currentDate() {
  return DATE_FORMAT.format(new Date());
}

function pad(value: number) {
  return value.toString().padStart(2, "0");
}

export function currentDateIso() {
  const now = new Date();

  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** `<time datetime>` is a machine format, so it stays 24-hour whatever the locale reads like. */
export function currentTimeIso() {
  const now = new Date();

  return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
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
  return `${timeOfDay(new Date().getHours())}, ${userName}`;
}
