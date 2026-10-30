"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../src/lib/supabase";

type Recipe = {
  id: number;
  title: string;
  category: string;
  image_url: string;
};

type Ingredient = {
  id: string;
  recipe_id: number;
  name: string;
  amount: string | null;
};

const DAYS = [
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
  "Samstag",
  "Sonntag",
];

// Interne Komponente, die useSearchParams nutzt
function PlanContent() {
  const [selectedRecipes, setSelectedRecipes] = useState<Recipe[]>([]);
  const [dayAssignments, setDayAssignments] = useState<{ [key: string]: Recipe | null }>({});
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      const idsParam = searchParams.get("ids");
      if (idsParam) {
        const idsArray = idsParam.split(",").map(Number);

        const { data: recipeData } = await supabase
          .from("recipes")
          .select("*")
          .in("id", idsArray);

        if (recipeData) {
          setSelectedRecipes(recipeData);

          const { data: ingredientData } = await supabase
            .from("recipe_ingredients")
            .select("*")
            .in("recipe_id", idsArray);

          if (ingredientData) {
            setIngredients(ingredientData);
          }
        }
      }
    }

    init();
  }, [router, searchParams]);

  const assignRecipeToDay = (day: string, recipe: Recipe) => {
    setDayAssignments((prev) => ({ ...prev, [day]: recipe }));
  };

  const removeRecipeFromDay = (day: string) => {
    setDayAssignments((prev) => {
      const updated = { ...prev };
      delete updated[day];
      return updated;
    });
  };

  const activeRecipeIds = Object.values(dayAssignments)
    .filter((r): r is Recipe => r !== null)
    .map((r) => r.id);

  const currentShoppingList = ingredients.filter((ing) =>
    activeRecipeIds.includes(ing.recipe_id)
  );

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8 max-w-4xl mx-auto font-sans pb-28">
      <header className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Dein Wochenplan 📅</h1>
          <p className="text-xs text-slate-500">
            Weise deinen Gerichten die Wochentage zu.
          </p>
        </div>
        <button
          onClick={() => router.push("/")}
          className="text-xs font-semibold text-slate-600 bg-slate-200 px-3 py-2 rounded-xl"
        >
          ← Zurück
        </button>
      </header>

      {/* Tage-Liste */}
      <div className="space-y-4 mb-8">
        {DAYS.map((day) => {
          const assignedRecipe = dayAssignments[day];

          return (
            <div
              key={day}
              className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <span className="font-bold text-slate-700 w-28">{day}</span>

              {assignedRecipe ? (
                <div className="flex items-center justify-between flex-1 bg-green-50 p-2 rounded-xl border border-green-200">
                  <div className="flex items-center space-x-3">
                    <img
                      src={assignedRecipe.image_url}
                      alt={assignedRecipe.title}
                      className="w-10 h-10 rounded-lg object-cover"
                    />
                    <div>
                      <h4 className="text-sm font-semibold text-slate-800">
                        {assignedRecipe.title}
                      </h4>
                      <span className="text-[10px] text-green-700 font-medium">
                        {assignedRecipe.category}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => removeRecipeFromDay(day)}
                    className="text-xs text-red-500 font-semibold px-2 py-1 hover:bg-red-50 rounded-lg"
                  >
                    Entfernen
                  </button>
                </div>
              ) : (
                <select
                  onChange={(e) => {
                    const recipe = selectedRecipes.find(
                      (r) => r.id === Number(e.target.value)
                    );
                    if (recipe) assignRecipeToDay(day, recipe);
                  }}
                  defaultValue=""
                  className="flex-1 p-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 bg-slate-50 focus:outline-none"
                >
                  <option value="" disabled>
                    -- Gericht auswählen --
                  </option>
                  {selectedRecipes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title} ({r.category})
                    </option>
                  ))}
                </select>
              )}
            </div>
          );
        })}
      </div>

      {/* Einkaufslisten-Bereich */}
      {activeRecipeIds.length > 0 && (
        <div className="bg-white p-6 rounded-2xl shadow-md border border-slate-100">
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center justify-between">
            <span>🛒 Einkaufsliste</span>
            <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full font-normal">
              {currentShoppingList.length} Zutaten
            </span>
          </h2>
          {currentShoppingList.length === 0 ? (
            <p className="text-xs text-slate-400">Keine Zutaten für die gewählten Gerichte hinterlegt.</p>
          ) : (
            <ul className="space-y-2">
              {currentShoppingList.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 border-b border-slate-50 text-sm"
                >
                  <span className="text-slate-800 font-medium">{item.name}</span>
                  {item.amount && (
                    <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
                      {item.amount}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </main>
  );
}

// Hauptkomponente mit Suspense-Boundary gewickelt
export default function PlanPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-slate-400">Lade Wochenplan...</div>}>
      <PlanContent />
    </Suspense>
  );
}