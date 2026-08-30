export function formatTime({ hours, minutes, use24Hour }: {
  hours: number;
  minutes: number;
  use24Hour: boolean;
}): string {
  const paddedMinutes = minutes.toString().padStart(2, "0");
  if (use24Hour) {
    return `${hours.toString().padStart(2, "0")}:${paddedMinutes}`;
  }

  const suffix = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;

  return `${hour12}:${paddedMinutes} ${suffix}`;
}

export function currentTime(use24Hour: boolean): string {
  const now = new Date();

  return formatTime({
    hours: now.getHours(),
    minutes: now.getMinutes(),
    use24Hour
  });
}

export function currentDate(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

export function currentDateIso(): string {
  const now = new Date();

  return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}-${now.getDate().toString().padStart(2, "0")}`;
}

export function currentTimeIso(): string {
  const now = new Date();

  return formatTime({
    hours: now.getHours(),
    minutes: now.getMinutes(),
    use24Hour: true
  });
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
