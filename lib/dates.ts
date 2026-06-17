// Shared date helpers for the rolling 7-day view.
//
// Meals/notes are keyed by calendar date (YYYY-MM-DD) so the plan can roll
// forward day-by-day and keep history forever. Keys are computed from *local*
// date parts — never via toISOString(), which is UTC and would roll a day
// early on PT evenings.

export function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export type RollingDay = {
  key: string; // "2026-06-17"
  date: Date; // local midnight of that day
  weekday: string; // "Tuesday"
  label: string; // "Tue, Jun 17"
  isToday: boolean;
};

// today (index 0) through today+(count-1), as local calendar days.
export function rollingWindow(count = 7): RollingDay[] {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const days: RollingDay[] = [];
  for (let i = 0; i < count; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    days.push({
      key: localDateKey(date),
      date,
      weekday: WEEKDAYS[date.getDay()],
      label: date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      }),
      isToday: i === 0,
    });
  }
  return days;
}

export function todayKey(): string {
  return localDateKey(new Date());
}
