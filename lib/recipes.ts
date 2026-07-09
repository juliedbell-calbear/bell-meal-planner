import { aiParseRecipe, aiCleanIngredients, ParsedRecipe } from "./ai";

// Recipe extraction: structured data first (most recipe sites publish
// schema.org/Recipe JSON-LD), Claude as the cleanup/fallback layer, and
// plain-text heuristics when no API key is configured.

type JsonLdRecipe = { name?: string; recipeIngredient?: string[] };

function findRecipeNode(node: unknown): JsonLdRecipe | null {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findRecipeNode(child);
      if (found) return found;
    }
    return null;
  }
  const obj = node as Record<string, unknown>;
  const type = obj["@type"];
  const types = Array.isArray(type) ? type : [type];
  if (types.includes("Recipe") && Array.isArray(obj.recipeIngredient)) {
    return obj as JsonLdRecipe;
  }
  if (obj["@graph"]) return findRecipeNode(obj["@graph"]);
  return null;
}

function extractJsonLd(html: string): JsonLdRecipe | null {
  const scripts = Array.from(
    html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
  );
  for (const match of scripts) {
    try {
      const parsed = JSON.parse(match[1].trim());
      const recipe = findRecipeNode(parsed);
      if (recipe) return recipe;
    } catch {
      // malformed JSON-LD block — keep looking
    }
  }
  return null;
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#?\w+;/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

// No-AI fallback: strip leading quantities/units from an ingredient line.
const UNITS =
  "cups?|cup|tbsp|tablespoons?|tsp|teaspoons?|oz|ounces?|lbs?|pounds?|grams?|g|kg|ml|l|liters?|cloves?|cans?|jars?|packages?|pkgs?|sticks?|slices?|pinch(?:es)?|dash(?:es)?|bunch(?:es)?|heads?|pieces?|large|medium|small";

const PREP_WORDS =
  /^(chopped|diced|minced|sliced|cut|divided|softened|melted|grated|shredded|peeled|trimmed|crushed|julienned|cubed|halved|quartered|rinsed|drained|thawed|beaten|whisked|at room temperature|room temperature|to taste|optional|plus more|for serving|for garnish|thinly|finely|roughly|freshly)/i;

export function heuristicCleanIngredient(line: string): string {
  let s = line.trim();
  s = s.replace(/\(.*?\)/g, ""); // parentheticals
  s = s.replace(/\*+/g, ""); // footnote markers
  s = s.replace(/^[-•*\d\s\/.,¼½¾⅓⅔⅛+]+/, ""); // leading bullets/quantities
  s = s.replace(new RegExp(`^(${UNITS})\\b\\.?\\s+(of\\s+)?`, "i"), "");
  s = s.replace(new RegExp(`^(${UNITS})\\b\\.?\\s+(of\\s+)?`, "i"), ""); // "2 large cloves garlic"
  // Drop comma-suffixes only when they're prep notes ("chicken, sliced"),
  // not part of the name ("boneless, skinless chicken breast").
  const parts = s.split(",").map((p) => p.trim());
  const kept = [parts[0], ...parts.slice(1).filter((p) => p && !PREP_WORDS.test(p))];
  return kept.join(" ").replace(/\s+/g, " ").trim();
}

// Things nobody needs on a shopping list.
const SKIP_ITEMS =
  /^(water|ice water|salt|kosher salt|sea salt|table salt|pepper|black pepper|ground black pepper|freshly ground black pepper|freshly cracked black pepper|salt and pepper( to taste)?|salt & pepper)$/i;

// Pull a recipe name from the opening text: first non-empty line, trimmed at
// an "Ingredients" marker or the first sentence break ("Chicken Fajitas.
// Ingredients: ..." -> "Chicken Fajitas").
function heuristicName(text: string): string {
  const firstLine = text.split("\n").map((l) => l.trim()).find(Boolean) || "";
  const name = firstLine
    .split(/ingredients?\b\s*:?/i)[0]
    .split(/[.•|]/)[0]
    .trim()
    .slice(0, 80);
  return name || "New recipe";
}

// Break the ingredient region into candidate items: one per line, and for a
// run-on comma list on a single line ("1 lb x, 2 y, z") split that too.
function splitCandidates(region: string): string[] {
  const out: string[] = [];
  for (const rawLine of region.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const commaCount = (line.match(/,/g) || []).length;
    if (line.length > 60 && commaCount >= 2) {
      for (const part of line.split(/[,;•]/)) {
        const p = part.trim();
        if (p) out.push(p);
      }
    } else {
      out.push(line);
    }
  }
  return out;
}

// A candidate looks like an ingredient if it's bulleted/quantified or a short
// noun phrase — filters out prose/instruction sentences.
function looksLikeIngredient(line: string): boolean {
  return /^[-•*\d¼½¾⅓⅔⅛]/.test(line) || (line.length < 60 && line.split(/\s+/).length <= 7);
}

function heuristicParseText(text: string): ParsedRecipe {
  const norm = text.replace(/\r/g, "").trim();
  const name = heuristicName(norm);

  // Prefer an explicit "Ingredients" section (stopping before the instructions)
  // so a pasted full recipe doesn't drag the cooking steps into the list.
  let region: string;
  const marker = norm.match(/ingredients?\b\s*:?/i);
  if (marker) {
    region = norm.slice(marker.index! + marker[0].length);
    const stop = region.match(/\b(instructions?|directions?|method|steps|preparation|procedure)\b/i);
    if (stop) region = region.slice(0, stop.index);
  } else {
    // No label — use everything after the first line (the title).
    const nl = norm.indexOf("\n");
    region = nl >= 0 ? norm.slice(nl + 1) : "";
  }

  const ingredients: string[] = [];
  for (const candidate of splitCandidates(region)) {
    if (!looksLikeIngredient(candidate)) continue;
    const cleaned = heuristicCleanIngredient(candidate);
    if (
      cleaned &&
      cleaned.length > 1 &&
      cleaned.length < 60 &&
      !ingredients.some((x) => x.toLowerCase() === cleaned.toLowerCase())
    ) {
      ingredients.push(cleaned);
    }
  }
  return { name, ingredients: ingredients.slice(0, 40) };
}

export async function parseRecipeFromUrl(url: string): Promise<ParsedRecipe & { via: string }> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
  });
  if (!res.ok) {
    throw new Error(
      `That site wouldn't share the page (HTTP ${res.status}) — try copying & pasting the recipe text instead`
    );
  }
  const html = await res.text();

  const ld = extractJsonLd(html);
  if (ld?.recipeIngredient?.length) {
    const name = (ld.name || "New recipe").trim();
    const raw = ld.recipeIngredient.map(String);
    const cleaned = (await aiCleanIngredients(name, raw)) ?? raw.map(heuristicCleanIngredient);
    return { name, ingredients: dedupe(cleaned), via: "structured-data" };
  }

  // No structured data — hand the page text to Claude, or heuristics.
  const text = htmlToText(html);
  const ai = await aiParseRecipe(text);
  if (ai) return { ...ai, ingredients: dedupe(ai.ingredients), via: "ai" };
  const h = heuristicParseText(text);
  return { ...h, ingredients: dedupe(h.ingredients), via: "heuristic" };
}

export async function parseRecipeFromText(text: string): Promise<ParsedRecipe & { via: string }> {
  const ai = await aiParseRecipe(text);
  if (ai) return { ...ai, ingredients: dedupe(ai.ingredients), via: "ai" };
  const h = heuristicParseText(text);
  return { ...h, ingredients: dedupe(h.ingredients), via: "heuristic" };
}

function dedupe(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const trimmed = item.trim();
    const key = trimmed.toLowerCase();
    if (SKIP_ITEMS.test(trimmed)) continue;
    if (trimmed && !seen.has(key)) {
      seen.add(key);
      out.push(trimmed);
    }
  }
  return out;
}
