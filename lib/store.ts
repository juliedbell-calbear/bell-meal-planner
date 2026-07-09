import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Tiny key-value layer over the Supabase `shopping_list` table
// (columns: key text primary key, value jsonb).
//
// If Supabase is unreachable or not configured, we fall back to an
// in-process memory store so the app keeps working on one device
// (useful for local dev; on Vercel it means "degraded, not dead").

// Pinned to globalThis so all route bundles share one fallback store.
const g = globalThis as typeof globalThis & { __bellMemory?: Map<string, unknown> };
const memory = (g.__bellMemory ??= new Map<string, unknown>());
let lastDbOk = false;

function getClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  // Route every Supabase request through fetch with `no-store`. Next.js
  // otherwise caches these GETs in its Data Cache (even on force-dynamic
  // routes), so a freshly-saved row — e.g. a new favorite recipe — could be
  // missing from reads until the cache was evicted. That made "add to
  // favorites" look broken: the recipe saved, but never showed up.
  return createClient(url, key, {
    global: {
      fetch: (input: RequestInfo | URL, init?: RequestInit) =>
        fetch(input, { ...init, cache: "no-store" }),
    },
  });
}

export function dbOk() {
  return lastDbOk;
}

export async function kvGet<T>(key: string): Promise<T | null> {
  const supabase = getClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("shopping_list")
        .select("value")
        .eq("key", key)
        .maybeSingle();
      if (!error) {
        lastDbOk = true;
        return (data?.value as T) ?? null;
      }
      console.error(`[store] kvGet(${key}) error:`, error.message);
    } catch (e) {
      console.error(`[store] kvGet(${key}) failed:`, e);
    }
  }
  lastDbOk = false;
  return (memory.get(key) as T) ?? null;
}

export async function kvSet(key: string, value: unknown): Promise<boolean> {
  memory.set(key, value); // always keep the local fallback current
  const supabase = getClient();
  if (supabase) {
    try {
      const { error } = await supabase
        .from("shopping_list")
        .upsert({ key, value }, { onConflict: "key" });
      if (!error) {
        lastDbOk = true;
        return true;
      }
      console.error(`[store] kvSet(${key}) error:`, error.message);
    } catch (e) {
      console.error(`[store] kvSet(${key}) failed:`, e);
    }
  }
  lastDbOk = false;
  return false;
}

// ---- Meals (favorites/recipes) table ----

export type MealRecord = { name: string; ingredients: string[] };

export async function getMeals(): Promise<MealRecord[]> {
  const supabase = getClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("meals")
        .select("name, ingredients")
        .order("name");
      if (!error) {
        lastDbOk = true;
        return (data ?? []).map((m) => ({
          name: m.name,
          ingredients: Array.isArray(m.ingredients) ? m.ingredients : [],
        }));
      }
      console.error("[store] getMeals error:", error.message);
    } catch (e) {
      console.error("[store] getMeals failed:", e);
    }
  }
  lastDbOk = false;
  return ((memory.get("__meals") as MealRecord[]) ?? []).slice();
}

export async function saveMeal(meal: MealRecord): Promise<{ ok: boolean; error?: string }> {
  const local = ((memory.get("__meals") as MealRecord[]) ?? []).filter(
    (m) => m.name.toLowerCase() !== meal.name.toLowerCase()
  );
  local.push(meal);
  memory.set("__meals", local);

  const supabase = getClient();
  if (!supabase) return { ok: false, error: "Supabase not configured" };
  try {
    const { error } = await supabase
      .from("meals")
      .upsert({ name: meal.name, ingredients: meal.ingredients }, { onConflict: "name" });
    if (error) {
      console.error("[store] saveMeal error:", error.message);
      return { ok: false, error: error.message };
    }
    lastDbOk = true;
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
