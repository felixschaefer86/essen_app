-- Gemeinsamer Wochenplan: ein Eintrag pro Kalendertag.
-- Im Supabase-Dashboard unter "SQL Editor" einmal ausführen.

create table if not exists public.meal_plan (
  day_date   date primary key,
  recipe_id  bigint not null references public.recipes (id) on delete cascade,
  updated_at timestamptz not null default now()
);

alter table public.meal_plan enable row level security;

-- Alle angemeldeten Familienmitglieder dürfen den Plan lesen und ändern.
create policy "meal_plan_authenticated_all"
  on public.meal_plan
  for all
  to authenticated
  using (true)
  with check (true);
