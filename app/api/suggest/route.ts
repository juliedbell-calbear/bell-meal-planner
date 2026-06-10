import { NextResponse } from "next/server";
import { aiSuggestMeal } from "@/lib/ai";
import { getMeals } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// POST { day, calendarNote, alreadyPlanned } -> { meal, note } or { meal: null }
export async function POST(request: Request) {
  const body = await request.json();
  const favorites = (await getMeals()).map((m) => m.name);
  const suggestion = await aiSuggestMeal(
    String(body.day || ""),
    String(body.calendarNote || ""),
    favorites,
    Array.isArray(body.alreadyPlanned) ? body.alreadyPlanned : []
  );
  return NextResponse.json(suggestion ?? { meal: null });
}
