-- Bell Family Meal Planner — Supabase setup (v2)
-- Matches the existing schema: meals.ingredients is text[] (a Postgres array).
-- Run in the Supabase dashboard: SQL Editor → New query → paste → Run.
-- Idempotent: safe to run more than once.

-- 1. Make sure both tables exist (skipped if they already do).
create table if not exists meals (
  name text not null,
  ingredients text[] not null default '{}'
);

create table if not exists shopping_list (
  key text primary key,
  value jsonb not null
);

-- 2. The app saves recipes with "upsert by name", which needs a unique
-- index on name.
create unique index if not exists meals_name_key on meals (name);

-- 3. Row-level security: the app uses the anon key, so allow it to read and
-- write both tables. (The app itself is the access control — anyone with the
-- link is family. If you ever want real auth, tighten these policies.)
alter table meals enable row level security;
alter table shopping_list enable row level security;

drop policy if exists "family can read meals" on meals;
drop policy if exists "family can write meals" on meals;
drop policy if exists "family can update meals" on meals;
create policy "family can read meals" on meals for select using (true);
create policy "family can write meals" on meals for insert with check (true);
create policy "family can update meals" on meals for update using (true);

drop policy if exists "family can read list" on shopping_list;
drop policy if exists "family can write list" on shopping_list;
drop policy if exists "family can update list" on shopping_list;
create policy "family can read list" on shopping_list for select using (true);
create policy "family can write list" on shopping_list for insert with check (true);
create policy "family can update list" on shopping_list for update using (true);

-- 4. A few starter favorites for meals you don't have recipes for yet.
-- Skips any name that already exists. Edit freely.
insert into meals (name, ingredients) values
  ('Tacos', array['ground beef','taco seasoning','tortillas','shredded cheese','lettuce','tomatoes','sour cream','salsa']),
  ('Crispy chicken', array['chicken breasts','panko','eggs','flour','vegetable oil']),
  ('Mac n cheese', array['macaroni','cheddar','milk','butter','flour']),
  ('Pasta & sausage', array['penne','italian sausage','marinara','parmesan']),
  ('Grilled chicken & salad', array['chicken breasts','lettuce','cucumber','tomatoes','salad dressing']),
  ('Shrimp risotto', array['shrimp','arborio rice','chicken broth','parmesan','white wine','shallot'])
on conflict (name) do nothing;
