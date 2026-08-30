/**
 * Intl decides how a time reads - whether there is an AM/PM at all, what it is called, and where it
 * sits - so nothing here spells out a day period or pads an hour by hand. The two formatters are
 * built once because the clock reformats every second.
 */
const TIME_FORMATS = {
  h23: new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hourCycle: "h23"
  }),
  h12: new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hourCycle: "h12"
  })
};

const DATE_FORMAT = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric"
});

/** What the locale itself does, and so what the clock starts on before anyone touches the toggle. */
export function prefers24Hour(): boolean {
  return !new Intl.DateTimeFormat(undefined, { hour: "numeric" }).resolvedOptions().hour12;
}

export function currentTime(use24Hour: boolean): string {
  if (use24Hour) {
    return TIME_FORMATS.h23.format(new Date());
  }

  return TIME_FORMATS.h12.format(new Date());
}

export function currentDate(): string {
  return DATE_FORMAT.format(new Date());
}

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}

export function currentDateIso(): string {
  const now = new Date();

  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** `<time datetime>` is a machine format, so it stays 24-hour whatever the locale reads like. */
export function currentTimeIso(): string {
  const now = new Date();

  return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

export function greeting(userName: string): string {
  const hours = new Date().getHours();
  if (hours >= 5 && hours < 12) {
    return `Morning, ${userName}`;
  }

  if (hours >= 12 && hours < 17) {
    return `Afternoon, ${userName}`;
  }

  if (hours >= 17 && hours < 21) {
    return `Evening, ${userName}`;
  }

  return `Night, ${userName}`;
}
