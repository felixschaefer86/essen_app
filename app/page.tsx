"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../src/lib/supabase";

type Recipe = {
  id: number;
  title: string;
  category: string;
  image_url: string;
};

export default function Home() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Formular-Zustände für neues Rezept
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("Hauptgericht");
  const [newImageUrl, setNewImageUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);

  const [ingredients, setIngredients] = useState<{ name: string; amount: string }[]>([
    { name: "", amount: "" },
  ]);
  const [saving, setSaving] = useState(false);

  const router = useRouter();

  const fetchRecipes = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push("/login");
      return;
    }

    const { data, error } = await supabase.from("recipes").select("*").order("id", { ascending: false });
    if (error) {
      console.error("Fehler beim Laden:", error);
    } else if (data) {
      setRecipes(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRecipes();
  }, [router]);

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
      const fileName = `${Date.now()}-${imageFile.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("recipe-images")
        .upload(fileName, imageFile);

      if (!uploadError && uploadData) {
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
          category: newCategory,
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
    setImageFile(null);
    setIngredients([{ name: "", amount: "" }]);
    setIsModalOpen(false);
    setSaving(false);
    fetchRecipes();
  };

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8 max-w-4xl mx-auto font-sans pb-28">
      {/* Header */}
      <header className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Familien-Speiseplan 🍕</h1>
          <p className="text-slate-500 mt-1 text-sm">
            Tippe auf ein Gericht, um es für die Woche auszuwählen.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-all shadow-sm"
        >
          + Neues Rezept
        </button>
      </header>

      {/* Grid mit Rezept-Kacheln */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">Lade Rezepte...</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {recipes.map((recipe) => {
            const isSelected = selectedIds.includes(recipe.id);

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
                  <span className="text-[10px] font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full inline-block mb-1">
                    {recipe.category}
                  </span>
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
                <label className="block text-xs font-semibold text-slate-600 mb-1">Name des Gerichts</label>
                <input
                  type="text"
                  required
                  placeholder="z. B. Lasagne"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-green-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Kategorie</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none"
                  >
                    <option value="Hauptgericht">Hauptgericht</option>
                    <option value="Schnell & Einfach">Schnell & Einfach</option>
                    <option value="Vegetarisch">Vegetarisch</option>
                    <option value="Dessert">Dessert</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Foto vom Gericht (Kamera / Mediathek)</label>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment" // Öffnet auf dem iPhone direkt die Kamera!
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setImageFile(e.target.files[0]);
                      }
                    }}
                    className="w-full p-2 rounded-xl border border-slate-200 text-xs bg-white text-slate-600 file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                  />
                </div>
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
                        className="flex-2 w-full p-2 rounded-xl border border-slate-200 text-xs focus:outline-none"
                      />
                      <input
                        type="text"
                        placeholder="Menge (z. B. 500g)"
                        value={ing.amount}
                        onChange={(e) => handleIngredientChange(idx, "amount", e.target.value)}
                        className="w-28 p-2 rounded-xl border border-slate-200 text-xs focus:outline-none"
                      />
                      {ingredients.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeIngredientField(idx)}
                          className="text-red-500 text-xs font-bold px-2 py-1"
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
                  className="mt-2 text-xs font-semibold text-green-600 hover:text-green-700"
                >
                  + Weitere Zutat hinzufügen
                </button>
              </div>

              {/* Modal Buttons */}
              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 bg-slate-100"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-green-600 hover:bg-green-700 disabled:bg-slate-300"
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