"use type"; // Falls Next.js 15+ Server Components Standard sind, ansonsten als Client Component markieren:
"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "../../src/lib/supabase"; // Passe den Pfad zu deinem Supabase-Client an falls nötig
import { generateICS } from "../../src/lib/ical";

interface Recipe {
  id: string;
  title: string;
  category: string;
  image_url: string;
}

interface Ingredient {
  name: string;
  amount: string | null;
}

interface DayPlan {
  dayName: string;
  date: Date;
  recipeId: string | null;
  recipe: Recipe | null;
}

function PlanContent() {
  const searchParams = useSearchParams();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [weeklyPlan, setWeeklyPlan] = useState<DayPlan[]>([]);
  const [shoppingList, setShoppingList] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);

  // Wochentage initialisieren (startet mit dem aktuellen Montag oder der aktuellen Woche)
  useEffect(() => {
    fetchRecipes();
    initWeekDays();
  }, []);

  const fetchRecipes = async () => {
    const { data, error } = await supabase.from("recipes").select("*");
    if (!error && data) {
      setRecipes(data);
    }
  };

  const initWeekDays = () => {
    const today = new Date();
    const currentDayOfWeek = today.getDay(); // 0 = Sonntag, 1 = Montag, etc.
    const distanceToMonday = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek;
    
    const monday = new Date(today);
    monday.setDate(today.getDate() + distanceToMonday);

    const days = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
    
    const initialPlan: DayPlan[] = days.map((name, index) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + index);
      return {
        dayName: name,
        date,
        recipeId: null,
        recipe: null,
      };
    });

    setWeeklyPlan(initialPlan);
    setLoading(false);
  };

  // Gericht einem Tag zuweisen
  const handleAssignRecipe = (dayName: string, recipeId: string) => {
    const selectedRecipe = recipes.find((r) => r.id === recipeId) || null;
    
    const updated = weeklyPlan.map((day) => {
      if (day.dayName === dayName) {
        return { ...day, recipeId, recipe: selectedRecipe };
      }
      return day;
    });

    setWeeklyPlan(updated);
    generateShoppingList(updated);
  };

  // Einkaufsliste automatisch aus den zugewiesenen Rezepten generieren
  const generateShoppingList = async (plan: DayPlan[]) => {
    const recipeIds = plan.filter((d) => d.recipeId !== null).map((d) => d.recipeId as string);
    
    if (recipeIds.length === 0) {
      setShoppingList([]);
      return;
    }

    const { data, error } = await supabase
      .from("recipe_ingredients")
      .select("name, amount")
      .in("recipe_id", recipeIds);

    if (!error && data) {
      setShoppingList(data);
    }
  };

  // iCal Export auslösen
  const handleExportCalendar = () => {
    const exportData = weeklyPlan.map((day) => ({
      day: day.dayName,
      date: day.date,
      recipeTitle: day.recipe ? day.recipe.title : "",
    }));

    generateICS(exportData);
  };

  if (loading) {
    return <div className="p-6 text-center text-slate-500">Lade Wochenplan...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-8 pb-24">
      {/* Kopfbereich & Export */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Wochenplan & Einkaufsliste</h1>
          <p className="text-sm text-slate-500">Plane deine Gerichte und erhalte automatisch deine Einkaufsliste.</p>
        </div>
        <button
          onClick={handleExportCalendar}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-xl transition-all shadow-sm"
        >
          📅 In Kalender exportieren (iCal)
        </button>
      </div>

      {/* Wochentage Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {weeklyPlan.map((day) => (
          <div key={day.dayName} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
            <div className="flex justify-between items-center mb-3">
              <span className="font-semibold text-slate-700">{day.dayName}</span>
              <span className="text-xs text-slate-400">
                {day.date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}
              </span>
            </div>

            <div className="space-y-3">
              <select
                value={day.recipeId || ""}
                onChange={(e) => handleAssignRecipe(day.dayName, e.target.value)}
                className="w-full p-2.5 text-base rounded-xl border border-slate-200 bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">-- Gericht wählen --</option>
                {recipes.map((recipe) => (
                  <option key={recipe.id} value={recipe.id}>
                    {recipe.title}
                  </option>
                ))}
              </select>

              {day.recipe && (
                <div className="flex items-center gap-3 p-2 bg-green-50 rounded-xl border border-green-100">
                  <img
                    src={day.recipe.image_url}
                    alt={day.recipe.title}
                    className="w-12 h-12 rounded-lg object-cover"
                  />
                  <div className="text-xs">
                    <p className="font-semibold text-green-900">{day.recipe.title}</p>
                    <p className="text-green-700">{day.recipe.category}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Einkaufsliste */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <h2 className="text-lg font-bold text-slate-800 mb-4">🛒 Einkaufsliste</h2>
        {shoppingList.length === 0 ? (
          <p className="text-sm text-slate-400">Wähle oben Gerichte für die Woche aus, um die Einkaufsliste zu generieren.</p>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {shoppingList.map((item, index) => (
              <li key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 text-sm">
                <span className="font-medium text-slate-700">{item.name}</span>
                {item.amount && <span className="text-xs text-slate-500 bg-white px-2 py-1 rounded-md border border-slate-200">{item.amount}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// Hauptkomponente mit Suspense-Wrapper wegen useSearchParams
export default function PlanPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center text-slate-500">Lade Seite...</div>}>
      <PlanContent />
    </Suspense>
  );
}