const EAT_TIMEZONE = "Africa/Nairobi";

export interface EatClock {
  time: string;
  date: string;
  iso: string;
}

/** East Africa Time (Nairobi) — correct regardless of browser local timezone. */
export function formatEatClock(now = new Date()): EatClock {
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: EAT_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(now);

  const date = new Intl.DateTimeFormat("en-GB", {
    timeZone: EAT_TIMEZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(now);

  const iso = new Intl.DateTimeFormat("en-CA", {
    timeZone: EAT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  return { time: `${time} EAT`, date, iso };
}

export function formatTimelineEat(ms: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: EAT_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(ms);
}
