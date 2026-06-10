import { NextResponse } from "next/server";
import { kvGet, kvSet } from "@/lib/store";
import { syncWithMealPlan, currentWeekKey } from "@/lib/shopping";

export const dynamic = "force-dynamic";

const ROW_KEY = "plan";

type Plan = {
  meals?: Record<string, string>;
  notes?: Record<string, string>;
  weekKey?: string;
};

export async function GET() {
  const plan = (await kvGet<Plan>(ROW_KEY)) ?? {};
  return NextResponse.json(plan, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const value: Plan = await request.json();
  const ok = await kvSet(ROW_KEY, value);

  // Keep the shopping list in step with the plan: add ingredients for
  // planned meals, drop auto-added ones for meals taken off the plan.
  if (value.weekKey === currentWeekKey() && value.meals) {
    try {
      await syncWithMealPlan(Object.values(value.meals));
    } catch (e) {
      console.error("[meals] shopping sync failed:", e);
    }
  }

  return NextResponse.json({ ok });
}
