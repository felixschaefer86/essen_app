"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { supabase } from "../../src/lib/supabase";
import { exportToReminders } from "../../src/lib/reminders";

interface Recipe {
  id: number;
  title: string;
  category: string;
  image_url: string;
}

interface IngredientRow {
  recipe_id: number;
  name: string;
  amount: string | null;
}

interface ShoppingItem {
  name: string;
  amounts: string[]; // eine Menge pro Verwendung, bewusst nicht addiert
  count: number; // wie oft die Zutat im Plan gebraucht wird
}

interface DayPlan {
  dayName: string;
  date: Date;
  recipeId: number | null;
  recipe: Recipe | null;
}

const DAY_NAMES = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

// Die Woche läuft von Samstag bis Freitag und wechselt von Freitag auf Samstag.
function buildWeek(today: Date = new Date()): DayPlan[] {
  const daysSinceSaturday = (today.getDay() + 1) % 7; // Sa=0, So=1, ... Fr=6
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - daysSinceSaturday);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
    return { dayName: DAY_NAMES[date.getDay()], date, recipeId: null, recipe: null };
  });
}

// Gleiche Zutaten (ohne Beachtung von Groß-/Kleinschreibung) werden zusammengefasst,
// die Mengen bleiben einzeln stehen. Ein Gericht, das an zwei Tagen geplant ist,
// zählt auch zweimal.
function buildShoppingList(plan: DayPlan[], rows: IngredientRow[]): ShoppingItem[] {
  const items = new Map<string, ShoppingItem>();

  plan.forEach((day) => {
    if (day.recipeId === null) return;

    rows
      .filter((row) => row.recipe_id === day.recipeId)
      .forEach((row) => {
        const key = row.name.trim().toLowerCase();
        const item = items.get(key) ?? { name: row.name.trim(), amounts: [], count: 0 };
        item.count += 1;
        if (row.amount) item.amounts.push(row.amount);
        items.set(key, item);
      });
  });

  return Array.from(items.values());
}

function PlanContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [weeklyPlan, setWeeklyPlan] = useState<DayPlan[]>(() => buildWeek());
  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>([]);
  const [exportMessage, setExportMessage] = useState("");

  useEffect(() => {
    const loadRecipes = async () => {
      // Holt die IDs aus der URL (z.B. ?ids=1,2)
      const selectedIdsParam = searchParams.get("ids");

      let query = supabase.from("recipes").select("*");

      // Wenn IDs übergeben wurden, filtern wir die Rezepte direkt
      if (selectedIdsParam) {
        const ids = selectedIdsParam
          .split(",")
          .map(Number)
          .filter((id) => Number.isInteger(id));
        query = query.in("id", ids);
      }

      const { data, error } = await query;
      if (!error && data) {
        setRecipes(data);
      }
    };

    loadRecipes();
  }, [searchParams]);

  const handleAssignRecipe = (dayName: string, value: string) => {
    const recipeId = value === "" ? null : Number(value);
    const selectedRecipe = recipes.find((r) => r.id === recipeId) || null;

    const updated = weeklyPlan.map((day) =>
      day.dayName === dayName ? { ...day, recipeId, recipe: selectedRecipe } : day
    );

    setWeeklyPlan(updated);
    updateShoppingList(updated);
  };

  const updateShoppingList = async (plan: DayPlan[]) => {
    const recipeIds = Array.from(
      new Set(plan.filter((d) => d.recipeId !== null).map((d) => d.recipeId as number))
    );

    if (recipeIds.length === 0) {
      setShoppingList([]);
      return;
    }

    const { data, error } = await supabase
      .from("recipe_ingredients")
      .select("recipe_id, name, amount")
      .in("recipe_id", recipeIds);

    if (!error && data) {
      setShoppingList(buildShoppingList(plan, data as IngredientRow[]));
    }
  };

  const handleExportReminders = async () => {
    const exportData = weeklyPlan.map((day) => ({
      day: day.dayName,
      date: day.date,
      recipeTitle: day.recipe ? day.recipe.title : "",
    }));

    const result = await exportToReminders(exportData);

    switch (result) {
      case "copied":
        setExportMessage(
          "Plan kopiert. Öffne Erinnerungen, lege eine neue Liste an und füge den Text ein – jede Zeile wird eine Checkbox."
        );
        break;
      case "shared":
        setExportMessage("Plan geteilt. Wähle Erinnerungen als Ziel.");
        break;
      case "empty":
        setExportMessage("Wähle zuerst mindestens ein Gericht für die Woche aus.");
        break;
      default:
        setExportMessage("Export hat nicht geklappt – Zwischenablage und Teilen sind nicht verfügbar.");
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6 pb-24">
      {/* Navigation / Zurück-Button & Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-sm rounded-xl transition-all"
        >
          ← Zurück zur Startseite
        </button>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Wochenplan & Einkaufsliste</h1>
          <p className="text-sm text-slate-500">Plane deine Gerichte und erhalte automatisch deine Einkaufsliste.</p>
        </div>
        <button
          onClick={handleExportReminders}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-xl transition-all shadow-sm"
        >
          ✅ In Erinnerungen exportieren
        </button>
      </div>

      {exportMessage && (
        <p className="text-sm text-slate-600 bg-indigo-50 border border-indigo-100 rounded-xl p-3">
          {exportMessage}
        </p>
      )}

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
                value={day.recipeId ?? ""}
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
                  {/* eslint-disable-next-line @next/next/no-img-element */}
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
            {shoppingList.map((item) => (
              <li
                key={item.name.toLowerCase()}
                className={`flex items-center justify-between gap-2 p-3 rounded-xl border text-sm ${
                  item.count > 1 ? "bg-amber-50 border-amber-200" : "bg-slate-50 border-slate-100"
                }`}
              >
                <span className="font-medium text-slate-700">
                  {item.name}
                  {item.count > 1 && (
                    <span className="ml-2 text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                      {item.count}× benötigt
                    </span>
                  )}
                </span>
                {item.amounts.length > 0 && (
                  <span className="flex flex-wrap justify-end gap-1">
                    {item.amounts.map((amount, index) => (
                      <span
                        key={index}
                        className="text-xs text-slate-500 bg-white px-2 py-1 rounded-md border border-slate-200"
                      >
                        {amount}
                      </span>
                    ))}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function PlanPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center text-slate-500">Lade Seite...</div>}>
      <PlanContent />
    </Suspense>
  );
}
