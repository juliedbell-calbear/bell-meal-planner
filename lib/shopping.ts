import { categorize, normalizeItemName, Category } from "./categorize";
import { kvGet, kvSet, getMeals } from "./store";

export type ShoppingItem = {
  id: string;
  name: string;
  category: Category;
  checked: boolean;
  source: "meal" | "manual" | "staple";
  meal?: string; // which dinner added it (for source: "meal")
  addedBy?: string;
};

export type ShoppingList = {
  weekKey: string;
  items: ShoppingItem[];
  // meal-sourced item names the family deleted this week — don't re-add
  removedNames: string[];
};

const LIST_KEY = "list";

// Staples that go on the list every week.
export const ALWAYS_BUY = [
  "garlic",
  "onions",
  "broccoli",
  "green beans",
  "bagels",
  "cream cheese",
  "eggs",
  "butter",
];

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

export function currentWeekKey(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().split("T")[0];
}

function freshList(): ShoppingList {
  return {
    weekKey: currentWeekKey(),
    items: ALWAYS_BUY.map((name) => ({
      id: makeId(),
      name,
      category: categorize(name),
      checked: false,
      source: "staple" as const,
    })),
    removedNames: [],
  };
}

export async function getList(): Promise<ShoppingList> {
  const stored = await kvGet<ShoppingList>(LIST_KEY);
  if (!stored || !Array.isArray(stored.items) || stored.weekKey !== currentWeekKey()) {
    const list = freshList();
    await kvSet(LIST_KEY, list);
    return list;
  }
  return stored;
}

export async function saveList(list: ShoppingList): Promise<void> {
  await kvSet(LIST_KEY, list);
}

export function addItems(
  list: ShoppingList,
  names: string[],
  source: ShoppingItem["source"],
  meta: { meal?: string; addedBy?: string } = {}
): ShoppingList {
  const existing = new Set(list.items.map((i) => normalizeItemName(i.name)));
  for (const raw of names) {
    const name = raw.trim();
    if (!name) continue;
    const norm = normalizeItemName(name);
    if (existing.has(norm)) continue;
    if (source === "meal" && list.removedNames.includes(norm)) continue;
    existing.add(norm);
    list.items.push({
      id: makeId(),
      name,
      category: categorize(name),
      checked: false,
      source,
      ...(meta.meal ? { meal: meta.meal } : {}),
      ...(meta.addedBy ? { addedBy: meta.addedBy } : {}),
    });
  }
  return list;
}

// Reconcile the list with the week's planned meals: add ingredients for
// newly planned meals, drop unchecked auto-added items for meals that were
// taken off the plan.
export async function syncWithMealPlan(plannedMeals: string[]): Promise<ShoppingList> {
  const list = await getList();
  const favorites = await getMeals();
  const byName = new Map(favorites.map((m) => [m.name.toLowerCase(), m]));

  const planned = plannedMeals.filter(Boolean);
  const plannedSet = new Set(planned.map((m) => m.toLowerCase()));

  // Remove unchecked meal-sourced items whose meal is no longer planned.
  list.items = list.items.filter(
    (i) => !(i.source === "meal" && i.meal && !plannedSet.has(i.meal.toLowerCase()) && !i.checked)
  );

  for (const mealName of planned) {
    const fav = byName.get(mealName.toLowerCase());
    if (fav?.ingredients?.length) {
      addItems(list, fav.ingredients, "meal", { meal: fav.name });
    }
  }

  await saveList(list);
  return list;
}
