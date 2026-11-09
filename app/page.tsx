"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../src/lib/supabase";
import { collectTags, filterRecipes, normalizeTag, normalizeTags } from "../src/lib/tags";

type Recipe = {
  id: number;
  title: string;
  tags: string[] | null;
  image_url: string;
};

const MAX_TAGS_ON_CARD = 2;

export default function Home() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Formular-Zustände für neues Rezept
  const [newTitle, setNewTitle] = useState("");
  const [newTags, setNewTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);

  // Suche und Filter auf der Übersicht
  const [searchText, setSearchText] = useState("");
  const [tagFilter, setTagFilter] = useState("");

  const [ingredients, setIngredients] = useState<{ name: string; amount: string }[]>([
    { name: "", amount: "" },
  ]);
  const [saving, setSaving] = useState(false);

  const router = useRouter();

  // Liefert die Rezepte oder null, wenn auf /login umgeleitet wurde.
  const loadRecipes = useCallback(async (): Promise<Recipe[] | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push("/login");
      return null;
    }

    const { data, error } = await supabase.from("recipes").select("*").order("id", { ascending: false });
    if (error) {
      console.error("Fehler beim Laden:", error);
      return [];
    }
    return data ?? [];
  }, [router]);

  useEffect(() => {
    loadRecipes().then((data) => {
      if (data === null) return;
      setRecipes(data);
      setLoading(false);
    });
  }, [loadRecipes]);

  const allTags = useMemo(() => collectTags(recipes), [recipes]);
  const visibleRecipes = useMemo(
    () => filterRecipes(recipes, searchText, tagFilter),
    [recipes, searchText, tagFilter]
  );
  const filterActive = searchText.trim() !== "" || tagFilter !== "";

  // Tags im Formular verwalten (Enter oder Komma fügt hinzu)
  const addTag = (raw: string) => {
    const merged = normalizeTags([...newTags, raw]);
    setNewTags(merged);
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    setNewTags(newTags.filter((t) => t !== tag));
  };

  const toggleSelect = (id: number) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  // Zutaten-Formular-Zeilen verwalten
  const handleIngredientChange = (index: number, field: "name" | "amount", value: string) => {
    const updated = [...ingredients];
    updated[index][field] = value;
    setIngredients(updated);
  };

  const addIngredientField = () => {
    setIngredients([...ingredients, { name: "", amount: "" }]);
  };

  const removeIngredientField = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  // Rezept + Zutaten in Supabase speichern
  const handleSaveRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle) return;
    setSaving(true);

    let finalImageUrl = "https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=500"; // Fallback

    // Wenn ein Bild ausgewählt/fotografiert wurde, hochladen:
    if (imageFile) {
      // Leerzeichen, Umlaute etc. im Dateinamen würden den Storage-Upload scheitern lassen
      const safeName = imageFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const fileName = `${Date.now()}-${safeName}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("recipe-images")
        .upload(fileName, imageFile);

      if (uploadError) {
        console.error("Fehler beim Bild-Upload:", uploadError);
      } else if (uploadData) {
        // Öffentliche URL des Bildes abrufen
        const { data: publicUrlData } = supabase.storage
          .from("recipe-images")
          .getPublicUrl(uploadData.path);
        
        finalImageUrl = publicUrlData.publicUrl;
      }
    }

    // 3. Rezept mit der echten Bild-URL in Supabase speichern
    const { data: recipeData, error: recipeError } = await supabase
      .from("recipes")
      .insert([
        {
          title: newTitle,
          // Ein noch nicht mit Enter bestätigter Tag im Eingabefeld zählt mit
          tags: normalizeTags([...newTags, tagInput]),
          image_url: finalImageUrl,
        },
      ])
      .select();

    if (recipeError || !recipeData) {
      console.error("Fehler beim Erstellen des Rezepts:", recipeError);
      setSaving(false);
      return;
    }

    const createdRecipeId = recipeData[0].id;

    // Zutaten speichern (bleibt wie gehabt)...
    const validIngredients = ingredients
      .filter((ing) => ing.name.trim() !== "")
      .map((ing) => ({
        recipe_id: createdRecipeId,
        name: ing.name.trim(),
        amount: ing.amount.trim() || null,
      }));

    if (validIngredients.length > 0) {
      await supabase.from("recipe_ingredients").insert(validIngredients);
    }

    // Zurücksetzen
    setNewTitle("");
    setNewTags([]);
    setTagInput("");
    setImageFile(null);
    setIngredients([{ name: "", amount: "" }]);
    setIsModalOpen(false);
    setSaving(false);

    const data = await loadRecipes();
    if (data) setRecipes(data);
  };

  return (
    <main className="min-h-screen w-full bg-slate-50 p-4 md:p-8 max-w-4xl mx-auto font-sans pb-28">
      {/* Header */}
      <header className="mb-8 flex justify-between items-center gap-3">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold text-slate-800">Speiseplan</h1>
          <p className="text-slate-500 mt-1 text-sm">
            Plane für Woche
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="shrink-0 whitespace-nowrap bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-all shadow-sm"
        >
          + Neues Rezept
        </button>
      </header>

      {/* Suche und Tag-Filter */}
      {!loading && recipes.length > 0 && (
        <div className="mb-5 flex flex-col sm:flex-row gap-2">
          <input
            type="search"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Rezept oder Tag suchen"
            aria-label="Rezepte durchsuchen"
            className="flex-1 p-2.5 rounded-xl border border-slate-200 bg-white text-base text-slate-700 focus:outline-none focus:border-green-500"
          />
          {allTags.length > 0 && (
            <select
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              aria-label="Nach Tag filtern"
              className="sm:w-48 p-2.5 rounded-xl border border-slate-200 bg-white text-base text-slate-700 focus:outline-none focus:border-green-500"
            >
              <option value="">Alle Tags</option>
              {allTags.map((tag) => (
                <option key={tag} value={tag}>
                  #{tag}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Grid mit Rezept-Kacheln */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">Lade Rezepte...</div>
      ) : filterActive && visibleRecipes.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <p>Keine Rezepte gefunden.</p>
          <button
            onClick={() => {
              setSearchText("");
              setTagFilter("");
            }}
            className="mt-2 text-sm font-semibold text-green-600 hover:text-green-700"
          >
            Filter zurücksetzen
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {visibleRecipes.map((recipe) => {
            const isSelected = selectedIds.includes(recipe.id);
            const tags = recipe.tags ?? [];

            return (
              <div
                key={recipe.id}
                onClick={() => toggleSelect(recipe.id)}
                className={`relative cursor-pointer rounded-2xl overflow-hidden shadow-sm transition-all duration-200 select-none border-4 ${
                  isSelected
                    ? "border-green-500 scale-[0.98] shadow-md"
                    : "border-transparent hover:scale-[1.02]"
                }`}
              >
                <div className="h-36 w-full bg-slate-200 relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={recipe.image_url}
                    alt={recipe.title}
                    className="w-full h-full object-cover"
                  />
                  {isSelected && (
                    <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                      <div className="bg-green-500 text-white p-2 rounded-full shadow-lg">
                        ✓
                      </div>
                    </div>
                  )}
                </div>
                <div className="p-3 bg-white">
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-1">
                      {tags.slice(0, MAX_TAGS_ON_CARD).map((tag) => (
                        <span
                          key={tag}
                          className="text-[10px] font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full max-w-full truncate"
                        >
                          #{tag}
                        </span>
                      ))}
                      {tags.length > MAX_TAGS_ON_CARD && (
                        <span className="text-[10px] font-semibold text-slate-400 px-1 py-0.5">
                          +{tags.length - MAX_TAGS_ON_CARD}
                        </span>
                      )}
                    </div>
                  )}
                  <h3 className="text-sm font-medium text-slate-800 leading-snug line-clamp-2">
                    {recipe.title}
                  </h3>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Neues Rezept erstellen */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-100">
            <h2 className="text-xl font-bold text-slate-800 mb-4">Neues Rezept anlegen</h2>

            <form onSubmit={handleSaveRecipe} className="space-y-4">
              <div>
                <label className="block text-base font-semibold text-slate-600 mb-1">Name des Gerichts</label>
                <input
                  type="text"
                  required
                  placeholder="z. B. Lasagne"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-green-500"
                />
              </div>

              <div>
                <label className="block text-base font-semibold text-slate-600 mb-1">Tags</label>
                <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-xl border border-slate-200 bg-white focus-within:border-green-500">
                  {newTags.map((tag) => (
                    <span
                      key={tag}
                      className="flex items-center gap-1 text-sm font-medium text-green-700 bg-green-50 pl-2.5 pr-1.5 py-0.5 rounded-full"
                    >
                      #{tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        aria-label={`Tag ${tag} entfernen`}
                        className="text-green-600 hover:text-green-800 px-1"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                  <input
                    type="text"
                    list="known-tags"
                    value={tagInput}
                    placeholder={newTags.length === 0 ? "z. B. Fleisch, Vorspeise" : "Weiterer Tag"}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Komma schließt den Tag ab, auch beim Einfügen mehrerer Tags auf einmal
                      if (value.includes(",")) {
                        const parts = value.split(",");
                        const last = parts.pop() ?? "";
                        setNewTags(normalizeTags([...newTags, ...parts]));
                        setTagInput(last.replace(/^\s+/, ""));
                      } else {
                        setTagInput(value);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        // Enter im Tag-Feld soll nicht das ganze Formular abschicken
                        e.preventDefault();
                        if (normalizeTag(tagInput)) addTag(tagInput);
                      } else if (e.key === "Backspace" && tagInput === "" && newTags.length > 0) {
                        setNewTags(newTags.slice(0, -1));
                      }
                    }}
                    onBlur={() => {
                      if (normalizeTag(tagInput)) addTag(tagInput);
                    }}
                    className="flex-1 min-w-[8rem] p-1 text-base bg-transparent focus:outline-none"
                  />
                  <datalist id="known-tags">
                    {allTags
                      .filter((tag) => !newTags.some((t) => t.toLowerCase() === tag.toLowerCase()))
                      .map((tag) => (
                        <option key={tag} value={tag} />
                      ))}
                  </datalist>
                </div>
                <p className="mt-1 text-xs text-slate-400">Mit Enter oder Komma bestätigen.</p>
              </div>

              <div>
                <label className="block text-base font-semibold text-slate-600 mb-1">Foto vom Gericht</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setImageFile(e.target.files[0]);
                    }
                  }}
                  className="w-full p-2 rounded-xl border border-slate-200 text-base bg-white text-slate-600 file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-base file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                />
              </div>

              {/* Zutaten dynamisch hinzufügen */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2">Zutaten</label>
                <div className="space-y-2">
                  {ingredients.map((ing, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Zutat (z. B. Nudeln)"
                        value={ing.name}
                        onChange={(e) => handleIngredientChange(idx, "name", e.target.value)}
                        className="flex-2 w-full p-2 rounded-xl border border-slate-200 text-base focus:outline-none"
                      />
                      <input
                        type="text"
                        placeholder="Menge (z. B. 500g)"
                        value={ing.amount}
                        onChange={(e) => handleIngredientChange(idx, "amount", e.target.value)}
                        className="w-28 p-2 rounded-xl border border-slate-200 text-base focus:outline-none"
                      />
                      {ingredients.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeIngredientField(idx)}
                          className="text-red-500 text-base font-bold px-2 py-1"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addIngredientField}
                  className="mt-2 text-base font-semibold text-green-600 hover:text-green-700"
                >
                  + Weitere Zutat hinzufügen
                </button>
              </div>

              {/* Modal Buttons */}
              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-base font-semibold text-slate-500 bg-slate-100"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-xl text-base font-semibold text-white bg-green-600 hover:bg-green-700 disabled:bg-slate-300"
                >
                  {saving ? "Speichere..." : "Rezept speichern"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Aktions-Bar unten */}
      <footer className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-md bg-white p-4 rounded-2xl shadow-xl border border-slate-100 flex items-center justify-between z-40">
        <div>
          <span className="text-xs text-slate-400 block">Ausgewählt</span>
          <span className="text-lg font-bold text-slate-800">
            {selectedIds.length} Gerichte
          </span>
        </div>
        <button
          disabled={selectedIds.length === 0}
          onClick={() => {
            const query = selectedIds.join(",");
            router.push(`/plan?ids=${query}`);
          }}
          className="bg-green-600 hover:bg-green-700 disabled:bg-slate-300 text-white px-5 py-2.5 rounded-xl font-medium transition-colors"
        >
          Plan erstellen →
        </button>
      </footer>
    </main>
  );
}