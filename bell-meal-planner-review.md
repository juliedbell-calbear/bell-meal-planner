# Code Review: bell-meal-planner

Review date: 2026-05-11
Reviewer: Collaborator
Repository: github.com/juliedbell-calbear/bell-meal-planner

---

## Priority 1: Critical — Anthropic API Key Exposed Client-Side

**File:** `components/MealPlanner.jsx` (line 207)

The Anthropic API key is embedded in client-side code and sent with every AI suggestion request. The key is visible to anyone who opens browser devtools.

**Fix:** Move the Anthropic call to a server-side API route.

1. Add `ANTHROPIC_API_KEY` to Vercel environment variables (server-only, no `NEXT_PUBLIC_` prefix)
2. Create `app/api/ai-suggestion/route.ts` — a server component that calls Anthropic using `process.env.ANTHROPIC_API_KEY`
3. Client calls `POST /api/ai-suggestion` with the prompt context instead of calling Anthropic directly

```ts
// app/api/ai-suggestion/route.ts
export async function POST(request: Request) {
  const { day, history, calendarEvents } = await request.json();
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ... }),
  });
  return NextResponse.json(await res.json());
}
```

---

## Priority 2: High — TypeScript and ESLint Disabled in Builds

**File:** `next.config.js`

```js
eslint: { ignoreDuringBuilds: true },
typescript: { ignoreBuildErrors: true },
```

These flags silently hide real errors during deployment. The project has TypeScript issues that should be fixed rather than suppressed.

**Fix:** Remove these flags from `next.config.js`. Fix the underlying TypeScript errors, particularly in `components/MealPlanner.jsx` which is a `.js` file using JSX without TypeScript types.

---

## Priority 3: High — No Row Level Security on Supabase Tables

**Context:** `NEXT_PUBLIC_SUPABASE_ANON_KEY` is exposed to the browser. Without RLS, anyone with the anon key can read/write all data in the Supabase project.

**Fix:** Enable RLS on the `meals` and `shopping_list` tables in Supabase. At minimum:

- `meals` table: Allow anyone to read (meal favorites library), restrict writes to authenticated users
- `shopping_list` table: Read/write via anon key is fine for a shared family shopping list, but consider RLS if data should be user-scoped

---

## Priority 4: High — No Database Schema in Repository

The app references a `shopping_list` table (with `key` and `value` columns) and a `meals` table (with `name` and `ingredients` columns), but no migration or schema file exists in the repo.

**Fix:** Add a `supabase/schema.sql` file that documents the expected schema:

```sql
CREATE TABLE meals (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  ingredients TEXT[] DEFAULT '{}'
);

CREATE TABLE shopping_list (
  key TEXT PRIMARY KEY,
  value JSONB
);

-- Enable RLS
ALTER TABLE meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_list ENABLE ROW LEVEL SECURITY;
```

---

## Priority 5: Medium — API Route Naming Is Confusing

| Route | File | Actual table |
|-------|------|-------------|
| `/api/meals` | `app/api/meals/route.ts` | `shopping_list` (stores meal plan + checked state) |
| `/api/meal-list` | `app/api/meal-list/route.ts` | `meals` (stores meal favorites library) |

The route that manages the weekly **meal plan** lives at `/api/meals` but reads/writes the `shopping_list` table. The route that manages the meal **favorites library** is at `/api/meal-list` but reads the `meals` table.

**Fix:** Rename routes to match what they actually do:
- `/api/meals/route.ts` → `/api/meal-plan/route.ts`
- `/api/meal-list/route.ts` → `/api/meals/route.ts`

---

## Priority 6: Medium — Google Calendar Env Vars Undocumented

**File:** `.env.local.example`

The file only documents Supabase variables. The calendar API route requires additional env vars that are not listed:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REFRESH_TOKEN`
- `GOOGLE_CALENDAR_IDS` (optional, defaults to "primary")

**Fix:** Add these to `.env.local.example`:

```
# Google Calendar API
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REFRESH_TOKEN=
GOOGLE_CALENDAR_IDS=primary
```

---

## Priority 7: Medium — Silent Error Handling

Throughout `MealPlanner.jsx`, API calls use `.catch(() => {})` which silently swallows all errors. Network failures and API errors are invisible to users.

**Fix:** At minimum, log errors in development:

```ts
.catch((e) => {
  if (process.env.NODE_ENV === "development") console.error(e);
});
```

---

## Priority 8: Medium — Custom Shopping Items Not Persisted

**File:** `MealPlanner.jsx`

`customItems` state is added in-memory but never saved to Supabase. Refreshing the page clears all custom items.

**Fix:** Add a `custom_items` row to the `shopping_list` table (or a separate `custom_items` table), and persist changes via a new API route or extending the existing `/api/shopping` POST handler.

---

## Priority 9: Medium — Outdated Anthropic Model Name

**File:** `MealPlanner.jsx` (line 207)

```ts
model: "claude-sonnet-4-20250514",
```

This is a dated snapshot model name. Consider using the latest model identifier.

**Fix (after moving to server route):** Update to current model (e.g., `claude-sonnet-4-7-2025` or `claude-4-sonnet`).

---

## Priority 10: Low — No Lockfile Committed

**File:** `.gitignore`

`package-lock.json` is gitignored. If collaborators use npm, there is no lockfile.

**Fix:** Remove `package-lock.json` from `.gitignore` and commit it, or explicitly add a lockfile for the package manager in use.

---

## Priority 11: Low — No Test Coverage

No test files exist in the repository. Critical paths lack coverage:
- Week key generation (`getWeekKey`)
- Shopping list derivation (`useMemo` for `shoppingList`)
- API route responses
- Calendar event detection logic (`detectWho`, `detectIsOut`)

**Fix:** Add tests for key logic, at minimum using Vitest or Jest.
