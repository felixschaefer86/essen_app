// src/lib/tags.ts
//
// Tags für Rezepte (z. B. #Fleisch, #Fisch, #Vorspeise).
// Gespeichert werden sie ohne "#" als Textliste (Spalte recipes.tags), angezeigt mit "#".

export type Taggable = { title: string; tags?: string[] | null };

/** "  #Vor  speise " -> "Vor speise"; leere Eingaben ergeben "". */
export function normalizeTag(raw: string): string {
  return raw.trim().replace(/^#+\s*/, "").replace(/\s+/g, " ").trim();
}

/** Bereinigt eine Tag-Liste: leere entfernen, Duplikate (ohne Groß-/Kleinschreibung) nur einmal. */
export function normalizeTags(raw: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const entry of raw) {
    const tag = normalizeTag(entry);
    const key = tag.toLowerCase();
    if (tag && !seen.has(key)) {
      seen.add(key);
      result.push(tag);
    }
  }
  return result;
}

/** Alle vorkommenden Tags, alphabetisch, ohne Duplikate (Schreibweise des ersten Vorkommens). */
export function collectTags(items: Taggable[]): string[] {
  return normalizeTags(items.flatMap((item) => item.tags ?? [])).sort((a, b) =>
    a.localeCompare(b, "de")
  );
}

/**
 * Filtert nach Freitext und/oder einem Tag.
 * - Freitext: jedes Suchwort muss im Titel oder in einem Tag vorkommen.
 * - Tag: das Rezept muss genau diesen Tag haben (ohne Beachtung von Groß-/Kleinschreibung).
 */
export function filterRecipes<T extends Taggable>(items: T[], query: string, tag: string): T[] {
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.replace(/^#+/, ""))
    .filter(Boolean);
  const wantedTag = tag.toLowerCase();

  return items.filter((item) => {
    const tags = (item.tags ?? []).map((t) => t.toLowerCase());
    if (wantedTag && !tags.includes(wantedTag)) return false;

    const haystack = [item.title.toLowerCase(), ...tags];
    return words.every((word) => haystack.some((text) => text.includes(word)));
  });
}
