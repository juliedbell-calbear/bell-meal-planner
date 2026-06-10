import { NextResponse } from "next/server";
import { parseRecipeFromUrl, parseRecipeFromText } from "@/lib/recipes";
import { saveMeal } from "@/lib/store";
import { aiAvailable } from "@/lib/ai";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // recipe pages + Claude can take a moment

// POST { url } or { text }       -> parse, return { name, ingredients, via } for preview
// POST { save: { name, ingredients } } -> save to the favorites (meals) table
export async function POST(request: Request) {
  const body = await request.json();

  if (body.save) {
    const name = String(body.save.name || "").trim();
    const ingredients = (Array.isArray(body.save.ingredients) ? body.save.ingredients : [])
      .map((i: unknown) => String(i).trim())
      .filter(Boolean);
    if (!name) {
      return NextResponse.json({ ok: false, error: "Recipe needs a name" }, { status: 400 });
    }
    const result = await saveMeal({ name, ingredients });
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error || "Couldn't save to the database" },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true });
  }

  try {
    if (body.url) {
      const url = String(body.url).trim();
      if (!/^https?:\/\//i.test(url)) {
        return NextResponse.json(
          { ok: false, error: "That doesn't look like a link" },
          { status: 400 }
        );
      }
      const recipe = await parseRecipeFromUrl(url);
      return NextResponse.json({ ok: true, ...recipe, aiUsed: aiAvailable() });
    }
    if (body.text) {
      const recipe = await parseRecipeFromText(String(body.text));
      return NextResponse.json({ ok: true, ...recipe, aiUsed: aiAvailable() });
    }
  } catch (e) {
    console.error("[recipes] parse failed:", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Couldn't read that recipe" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: false, error: "Send a url or text" }, { status: 400 });
}
