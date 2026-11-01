"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { supabase } from "../../src/lib/supabase";
import {
  exportDayToReminder,
  exportShoppingList,
  type PlanEntry,
  type ReminderExportResult,
} from "../../src/lib/reminders";

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

// Lokales Datum als "YYYY-MM-DD" (toISOString würde wegen UTC um einen Tag verrutschen).
function toDateString(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
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
  const [syncError, setSyncError] = useState("");

  const updateShoppingList = useCallback(async (plan: DayPlan[]) => {
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
  }, []);

  // Lädt Rezepte und den gemeinsam gespeicherten Plan der aktuellen Woche.
  // Liefert null, wenn auf /login umgeleitet wurde.
  const loadWeek = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      router.push("/login");
      return null;
    }

    const week = buildWeek();
    const days = week.map((day) => toDateString(day.date));

    const { data: planRows, error: planError } = await supabase
      .from("meal_plan")
      .select("day_date, recipe_id")
      .in("day_date", days);
    const savedPlan = planError || !planRows ? [] : (planRows as { day_date: string; recipe_id: number }[]);

    // IDs aus der URL (z.B. ?ids=1,2) plus alle Gerichte, die schon im gemeinsamen Plan stehen
    const idsParam = searchParams.get("ids");
    let query = supabase.from("recipes").select("*");
    if (idsParam) {
      const urlIds = idsParam
        .split(",")
        .map(Number)
        .filter((id) => Number.isInteger(id));
      const wanted = Array.from(new Set([...urlIds, ...savedPlan.map((row) => row.recipe_id)]));
      query = query.in("id", wanted);
    }
    const { data: recipeData, error: recipeError } = await query;
    const recipeList = recipeError || !recipeData ? [] : (recipeData as Recipe[]);

    const plan = week.map((day) => {
      const row = savedPlan.find((entry) => entry.day_date === toDateString(day.date));
      const recipe = row ? recipeList.find((r) => r.id === row.recipe_id) ?? null : null;
      return { ...day, recipeId: recipe ? recipe.id : null, recipe };
    });

    return {
      recipes: recipeList,
      plan,
      error: planError ? "Der gemeinsame Plan konnte nicht geladen werden." : "",
    };
  }, [router, searchParams]);

  useEffect(() => {
    const applyLoaded = (result: Awaited<ReturnType<typeof loadWeek>>) => {
      if (!result) return;
      setRecipes(result.recipes);
      setWeeklyPlan(result.plan);
      setSyncError(result.error);
      updateShoppingList(result.plan);
    };

    loadWeek().then(applyLoaded);

    // Wenn jemand nach einer Weile zurück zum Tab kommt, den aktuellen gemeinsamen Stand holen
    const handleVisible = () => {
      if (document.visibilityState === "visible") loadWeek().then(applyLoaded);
    };
    document.addEventListener("visibilitychange", handleVisible);
    return () => document.removeEventListener("visibilitychange", handleVisible);
  }, [loadWeek, updateShoppingList]);

  const handleAssignRecipe = async (dayName: string, value: string) => {
    const recipeId = value === "" ? null : Number(value);
    const selectedRecipe = recipes.find((r) => r.id === recipeId) || null;
    const changedDay = weeklyPlan.find((day) => day.dayName === dayName);
    if (!changedDay) return;

    const updated = weeklyPlan.map((day) =>
      day.dayName === dayName ? { ...day, recipeId, recipe: selectedRecipe } : day
    );

    setWeeklyPlan(updated);
    updateShoppingList(updated);

    // Für alle gemeinsam speichern
    const dayDate = toDateString(changedDay.date);
    const { error } =
      recipeId === null
        ? await supabase.from("meal_plan").delete().eq("day_date", dayDate)
        : await supabase
            .from("meal_plan")
            .upsert(
              { day_date: dayDate, recipe_id: recipeId, updated_at: new Date().toISOString() },
              { onConflict: "day_date" }
            );

    setSyncError(error ? "Speichern fehlgeschlagen – die Änderung ist nur auf diesem Gerät sichtbar." : "");
  };

  const toPlanEntry = (day: DayPlan): PlanEntry => ({
    day: day.dayName,
    date: day.date,
    recipeTitle: day.recipe ? day.recipe.title : "",
  });

  const showExportResult = (result: ReminderExportResult, emptyMessage: string) => {
    switch (result) {
      case "copied":
        setExportMessage(
          "Teilen ist hier nicht verfügbar, der Text wurde stattdessen kopiert. In Erinnerungen landet er beim Einfügen allerdings in einer einzigen Zeile."
        );
        break;
      case "shared":
        setExportMessage("");
        break;
      case "cancelled":
        break;
      case "empty":
        setExportMessage(emptyMessage);
        break;
      default:
        setExportMessage("Export hat nicht geklappt – Zwischenablage und Teilen sind nicht verfügbar.");
    }
  };

  const handleExportDay = async (day: DayPlan) =>
    showExportResult(await exportDayToReminder(toPlanEntry(day)), "Für diesen Tag ist kein Gericht gewählt.");

  const handleExportShopping = async () =>
    showExportResult(await exportShoppingList(shoppingList), "Die Einkaufsliste ist leer.");

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

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <h1 className="text-2xl font-bold text-slate-800">Wochenplan</h1>
        <p className="text-sm text-slate-500">Plane deine Gerichte und erhalte automatisch deine Einkaufsliste.</p>
      </div>

      {syncError && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl p-3">{syncError}</p>
      )}

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
                  <div className="text-xs flex-1 min-w-0">
                    <p className="font-semibold text-green-900">{day.recipe.title}</p>
                    <p className="text-green-700">{day.recipe.category}</p>
                  </div>
                  <button
                    onClick={() => handleExportDay(day)}
                    aria-label={`${day.dayName} in Erinnerungen teilen`}
                    className="shrink-0 px-2 py-1 text-xs font-medium text-green-700 hover:text-green-900 hover:bg-green-100 rounded-lg transition-colors"
                  >
                    ↗ Teilen
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Einkaufsliste */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-800">🛒 Einkaufsliste</h2>
          {shoppingList.length > 0 && (
            <button
              onClick={handleExportShopping}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors"
            >
              ↗ Teilen
            </button>
          )}
        </div>
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
