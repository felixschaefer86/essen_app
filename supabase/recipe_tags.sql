-- Tags statt Kategorie: jedes Rezept kann beliebig viele Tags haben.
-- Im Supabase-Dashboard unter "SQL Editor" einmal ausführen, BEVOR die neue App-Version genutzt wird.

-- 1. Neue Spalte für die Tags (Textliste, ohne "#")
alter table public.recipes
  add column if not exists tags text[] not null default '{}';

-- 2. Bisherige Kategorie als erster Tag übernehmen (nur wo noch keine Tags stehen)
update public.recipes
set tags = array[category]
where category is not null
  and btrim(category) <> ''
  and cardinality(tags) = 0;

-- 3. Neue Rezepte werden ohne Kategorie angelegt, deshalb darf die Spalte leer sein.
--    Die Spalte bleibt als Sicherung erhalten und kann später gelöscht werden.
alter table public.recipes
  alter column category drop not null;
