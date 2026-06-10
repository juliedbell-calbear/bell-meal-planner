import Anthropic from "@anthropic-ai/sdk";

// All Claude calls run server-side and require ANTHROPIC_API_KEY.
// Every caller has a non-AI fallback, so a missing key degrades
// gracefully instead of breaking a feature.

export function aiAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function getClient(): Anthropic | null {
  if (!aiAvailable()) return null;
  return new Anthropic();
}

const MODEL = "claude-opus-4-8";

// Ask Claude for structured JSON and parse the response.
async function structured<T>(prompt: string, schema: Record<string, unknown>): Promise<T | null> {
  const client = getClient();
  if (!client) return null;
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      output_config: { format: { type: "json_schema", schema } },
      messages: [{ role: "user", content: prompt }],
    });
    const text = response.content.find((b) => b.type === "text");
    if (text && text.type === "text") return JSON.parse(text.text) as T;
  } catch (e) {
    console.error("[ai] request failed:", e);
  }
  return null;
}

export type ParsedRecipe = { name: string; ingredients: string[] };

const RECIPE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    name: { type: "string", description: "Short recipe name, e.g. 'Chicken Tikka Masala'" },
    ingredients: {
      type: "array",
      items: { type: "string" },
      description:
        "Grocery-shopping-ready item names: no quantities, no units, no prep instructions. 'boneless chicken thighs', not '2 lbs boneless chicken thighs, trimmed'. Skip water, salt, and black pepper.",
    },
  },
  required: ["name", "ingredients"],
  additionalProperties: false,
};

// Turn raw recipe text (pasted, or extracted from a webpage) into a clean
// recipe name + shopping-ready ingredient list.
export async function aiParseRecipe(rawText: string): Promise<ParsedRecipe | null> {
  const prompt = `Extract the recipe from the text below for a family meal-planning app.

Return the recipe name and a clean ingredient list ready to paste into a grocery shopping list: strip quantities, units, and prep notes ("2 cups chopped fresh basil" -> "fresh basil"). Combine duplicates. Skip water, salt, and black pepper. If the text contains several recipes, use the main one.

<recipe_text>
${rawText.slice(0, 20000)}
</recipe_text>`;
  return structured<ParsedRecipe>(prompt, RECIPE_SCHEMA);
}

// Clean an already-extracted ingredient list (e.g. from a site's structured
// data) into shopping-ready names.
export async function aiCleanIngredients(
  name: string,
  ingredients: string[]
): Promise<string[] | null> {
  const result = await structured<ParsedRecipe>(
    `This ingredient list is from the recipe "${name}". Convert each line into a grocery-shopping-ready item name: strip quantities, units, and prep notes. Combine duplicates. Skip water, salt, and black pepper. Return the same recipe name.

${ingredients.join("\n")}`,
    RECIPE_SCHEMA
  );
  return result?.ingredients ?? null;
}

const SUGGESTION_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    meal: { type: "string" },
    note: { type: "string", description: "One short sentence on why this fits" },
  },
  required: ["meal", "note"],
  additionalProperties: false,
};

export async function aiSuggestMeal(
  day: string,
  calendarNote: string,
  favorites: string[],
  alreadyPlanned: string[]
): Promise<{ meal: string; note: string } | null> {
  const prompt = `Suggest ONE dinner for ${day} for a family of four (two kids, one picky eater who sometimes gets separate food).

Family favorites: ${favorites.join(", ") || "none saved yet"}.
Already planned this week (avoid repeats): ${alreadyPlanned.join(", ") || "nothing yet"}.
Calendar for ${day}: ${calendarNote || "nothing special"}.

Prefer a favorite when it fits. If the evening is busy, suggest something quick.`;
  return structured(prompt, SUGGESTION_SCHEMA);
}
