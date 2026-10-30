import type { Lang } from "@/i18n/dictionary";

// Opening hours as stored on the shop (voice setup and My shop write them):
// per day, up to two [open, close] pairs in 24-hour "HH:MM"; empty = closed.
export const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type Day = (typeof DAYS)[number];
export type Hours = Record<Day, Array<[string, string]>>;

export const EMPTY_HOURS: Hours = { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] };

// Accepts whatever is stored (possibly partial or null) as a full week.
export function asHours(value: unknown): Hours {
  const hours: Hours = { ...EMPTY_HOURS };
  if (!value || typeof value !== "object") return hours;
  for (const day of DAYS) {
    const slots = (value as Record<string, unknown>)[day];
    if (Array.isArray(slots)) {
      hours[day] = slots.filter(
        (s): s is [string, string] => Array.isArray(s) && s.length === 2 && s.every((t) => typeof t === "string"),
      );
    }
  }
  return hours;
}

export const hasHours = (hours: Hours) => DAYS.some((d) => hours[d].length > 0);

const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

// The shop's own clock (doc 06 OpenNowBadge): weekday and minutes since midnight.
export function shopClock(now: Date, timeZone: string): { day: Day; minute: number } {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const day = get("weekday").toLowerCase().slice(0, 3) as Day;
  return { day, minute: Number(get("hour")) * 60 + Number(get("minute")) };
}

export type OpenStatus =
  | { open: true; closesAt: string }
  | { open: false; opensAt: string | null; opensDay: Day | null }; // null: no hours set

// "Open now" or "Closed, opens 7 AM", from the hours in the shop's time zone.
export function openStatus(hours: Hours, now: Date, timeZone = "Asia/Kolkata"): OpenStatus {
  const { day, minute } = shopClock(now, timeZone);
  for (const [open, close] of hours[day]) {
    if (minute >= minutes(open) && minute < minutes(close)) return { open: true, closesAt: close };
  }
  // The next opening: later today, else the next day with hours.
  const later = hours[day].map(([open]) => open).filter((open) => minutes(open) > minute).sort();
  if (later.length) return { open: false, opensAt: later[0], opensDay: day };
  const start = DAYS.indexOf(day);
  for (let i = 1; i <= 7; i++) {
    const next = DAYS[(start + i) % 7];
    if (hours[next].length) return { open: false, opensAt: [...hours[next]].sort((a, b) => a[0].localeCompare(b[0]))[0][0], opensDay: next };
  }
  return { open: false, opensAt: null, opensDay: null };
}

export function formatTime(hhmm: string, lang: Lang): string {
  const date = new Date(Date.UTC(2026, 0, 1, Number(hhmm.slice(0, 2)), Number(hhmm.slice(3, 5))));
  return new Intl.DateTimeFormat(lang === "hi" ? "hi-IN" : "en-IN", { hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(date);
}

export function dayName(day: Day, lang: Lang, width: "short" | "long" = "short"): string {
  // 2026-01-05 was a Monday.
  const date = new Date(Date.UTC(2026, 0, 5 + DAYS.indexOf(day)));
  return new Intl.DateTimeFormat(lang === "hi" ? "hi-IN" : "en-IN", { weekday: width, timeZone: "UTC" }).format(date);
}

// Runs of days with the same hours, for one compact line each:
// "Mon–Sat 7:00 am – 10:00 pm", "Sun Closed".
export function hourRuns(hours: Hours): Array<{ from: Day; to: Day; slots: Array<[string, string]> }> {
  const runs: Array<{ from: Day; to: Day; slots: Array<[string, string]> }> = [];
  for (const day of DAYS) {
    const last = runs.at(-1);
    if (last && JSON.stringify(last.slots) === JSON.stringify(hours[day])) last.to = day;
    else runs.push({ from: day, to: day, slots: hours[day] });
  }
  return runs;
}
