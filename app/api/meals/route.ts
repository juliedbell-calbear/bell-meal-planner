import { NextResponse } from "next/server";
import { kvGet, kvSet } from "@/lib/store";
import { syncWithMealPlan } from "@/lib/shopping";

export const dynamic = "force-dynamic";

const ROW_KEY = "plan";

// Meals/notes are keyed by calendar date (YYYY-MM-DD), accumulating every day
// so past selections are kept forever. (Older plans were keyed by weekday name
// for a single overwritten week — see migratePlan.)
// A lunch entry: who it's for ("Everyone" or a family member) and what it is.
type LunchEntry = { who: string; what: string };

type Plan = {
  // A day's dinner is one or more dishes (mains + sides). Legacy plans stored a
  // single string per day; both shapes are read (see dishesOf / client).
  meals?: Record<string, string | string[]>;
  notes?: Record<string, string>;
  // Lunches are keyed by date, each day holding a list so different people can
  // have different lunches. Added after dinners, so no migration is needed.
  lunches?: Record<string, LunchEntry[]>;
  weekKey?: string; // legacy, only read during migration
};

const WEEKDAY_ORDER = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

function isWeekdayKeyed(map: Record<string, unknown> | undefined): boolean {
  if (!map) return false;
  return Object.keys(map).some((k) => WEEKDAY_ORDER.includes(k));
}

// One-time conversion of a legacy weekday-keyed plan to date keys, using the
// stored weekKey (the Monday's ISO date) as the anchor: Monday→+0d … Sunday→+6d.
// Returns { plan, migrated } so the caller can persist only when something changed.
function migratePlan(plan: Plan): { plan: Plan; migrated: boolean } {
  if (!plan.weekKey || (!isWeekdayKeyed(plan.meals) && !isWeekdayKeyed(plan.notes))) {
    return { plan, migrated: false };
  }

  const monday = new Date(`${plan.weekKey}T12:00:00`); // noon avoids TZ edge cases
  const dateFor = (weekday: string): string => {
    const offset = WEEKDAY_ORDER.indexOf(weekday);
    const d = new Date(monday);
    d.setDate(monday.getDate() + offset);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
  };

  const convert = <T,>(map: Record<string, T> = {}): Record<string, T> => {
    const out: Record<string, T> = {};
    for (const [k, v] of Object.entries(map)) {
      if (WEEKDAY_ORDER.includes(k)) {
        if (v) out[dateFor(k)] = v; // drop empty placeholders (legacy weekday keys)
      } else {
        out[k] = v; // already a date key — keep
      }
    }
    return out;
  };

  return {
    plan: { ...plan, meals: convert(plan.meals), notes: convert(plan.notes) },
    migrated: true,
  };
}

export async function GET() {
  const stored = (await kvGet<Plan>(ROW_KEY)) ?? {};
  const { plan, migrated } = migratePlan(stored);
  if (migrated) {
    await kvSet(ROW_KEY, plan);
  }
  return NextResponse.json(plan, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const body: Plan & { windowKeys?: string[] } = await request.json();
  const value: Plan = {
    meals: body.meals ?? {},
    notes: body.notes ?? {},
    lunches: body.lunches ?? {},
  };
  const ok = await kvSet(ROW_KEY, value);

  // Keep the shopping list in step with the rolling window: add ingredients for
  // meals planned within today→+6, drop auto-added ones for meals that rolled
  // off. The client sends windowKeys so we don't need server-side TZ logic.
  const windowKeys = Array.isArray(body.windowKeys) ? body.windowKeys : [];
  if (windowKeys.length && value.meals) {
    try {
      // Flatten each day's dish(es) — string or string[] — into one name list.
      const windowMeals = windowKeys.flatMap((k) => {
        const v = value.meals?.[k];
        if (Array.isArray(v)) return v.filter(Boolean);
        return v ? [v] : [];
      });
      await syncWithMealPlan(windowMeals);
    } catch (e) {
      console.error("[meals] shopping sync failed:", e);
    }
  }

  return NextResponse.json({ ok });
}
