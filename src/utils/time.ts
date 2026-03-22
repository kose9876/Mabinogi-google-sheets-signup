const BOT_TIMEZONE = "Asia/Taipei";

export const dayOrder = [
  "day_mon",
  "day_tue",
  "day_wed",
  "day_thu",
  "day_fri",
  "day_sat",
  "day_sun"
] as const;

export type DayKey = (typeof dayOrder)[number];

export const dayLabels: Record<DayKey, string> = {
  day_mon: "周一",
  day_tue: "周二",
  day_wed: "周三",
  day_thu: "周四",
  day_fri: "周五",
  day_sat: "周六",
  day_sun: "周日"
};

const dayOffsets: Record<DayKey, number> = {
  day_mon: 0,
  day_tue: 1,
  day_wed: 2,
  day_thu: 3,
  day_fri: 4,
  day_sat: 5,
  day_sun: 6
};

function formatInTimeZone(date: Date): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: BOT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });

  return formatter.format(date);
}

function parseDateParts(dateText: string): { year: number; month: number; day: number } {
  const [year, month, day] = dateText.split("-").map(Number);
  return { year, month, day };
}

function addDays(dateText: string, days: number): string {
  const { year, month, day } = parseDateParts(dateText);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return formatInTimeZone(date);
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function getSignupWeekKey(baseDate: Date = new Date()): string {
  const localDate = formatInTimeZone(baseDate);
  const { year, month, day } = parseDateParts(localDate);
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = date.getUTCDay() === 0 ? 7 : date.getUTCDay();
  const thisMonday = new Date(date);
  thisMonday.setUTCDate(date.getUTCDate() - (weekday - 1));
  thisMonday.setUTCDate(thisMonday.getUTCDate() + 7);
  return formatInTimeZone(thisMonday);
}

export function getWeekRangeText(weekKey: string): string {
  const start = parseDateParts(weekKey);
  const endText = addDays(weekKey, 6);
  const end = parseDateParts(endText);
  return `${start.month}/${start.day}~${end.month}/${end.day}`;
}

export function getDayDateText(weekKey: string, dayKey: DayKey): string {
  const dateText = addDays(weekKey, dayOffsets[dayKey]);
  const { month, day } = parseDateParts(dateText);
  return `${month}/${day}`;
}
