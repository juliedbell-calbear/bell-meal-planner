import { NextResponse } from "next/server";
import { getMeals, dbOk } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const meals = await getMeals();
  return NextResponse.json(
    { meals, dbOk: dbOk() },
    { headers: { "Cache-Control": "no-store" } }
  );
}
