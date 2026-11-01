// src/lib/reminders.ts
//
// Export für die iOS-Erinnerungen-App.
// Die Erinnerungen-App hat keine Web-Schnittstelle zum direkten Anlegen von
// Einträgen, und Einfügen aus der Zwischenablage legt nur eine einzige Erinnerung an.
// Deshalb wird Text mit einer Zeile pro Eintrag über das Teilen-Menü weitergegeben:
// - Ein einzelner Tag lässt sich direkt an Erinnerungen teilen (eine Erinnerung).
// - Für ganze Listen (Wochenplan, Einkaufsliste) teilt ein Kurzbefehl (siehe Hinweis
//   auf der Planseite) den Text an den Zeilenumbrüchen auf und legt pro Zeile eine
//   Erinnerung (Checkbox) an.
// Ohne Teilen-Unterstützung wird der Text in die Zwischenablage kopiert.

export type PlanEntry = { day: string; date: Date; recipeTitle: string };

export type ShoppingEntry = { name: string; amounts: string[]; count: number };

export type ReminderExportResult = "shared" | "copied" | "cancelled" | "empty" | "failed";

/** Eine Zeile für einen Tag, z. B. "Montag 26.10.: Lasagne". */
export function buildDayLine(item: PlanEntry): string {
  const date = item.date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
  return `${item.day} ${date}: ${item.recipeTitle}`;
}

/** Eine Zeile pro Tag mit Gericht. Tage ohne Gericht entfallen. */
export function buildReminderLines(plan: PlanEntry[]): string[] {
  return plan.filter((item) => item.recipeTitle).map(buildDayLine);
}

/**
 * Eine Zeile pro Zutat. Mengen werden nicht addiert, sondern einzeln aufgeführt;
 * mehrfach benötigte Zutaten bekommen "(2×)", z. B. "Zwiebeln (2×): 2 Stk, 1 Stk".
 */
export function buildShoppingLines(items: ShoppingEntry[]): string[] {
  return items.map((item) => {
    const name = item.count > 1 ? `${item.name} (${item.count}×)` : item.name;
    return item.amounts.length > 0 ? `${name}: ${item.amounts.join(", ")}` : name;
  });
}

async function shareText(text: string): Promise<ReminderExportResult> {
  // 1. Teilen-Menü (nur der Text, damit ein Kurzbefehl ihn sauber als Eingabe bekommt)
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ text });
      return "shared";
    } catch (error) {
      // Wer das Menü selbst schließt, soll weder Fehler noch Zwischenablage-Kopie bekommen
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
    }
  }

  // 2. Fallback: Zwischenablage
  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    return "failed";
  }
}

async function shareLines(lines: string[]): Promise<ReminderExportResult> {
  if (lines.length === 0) return "empty";
  return shareText(lines.join("\n"));
}

/** Ganzer Wochenplan, eine Zeile pro Tag. */
export function exportToReminders(plan: PlanEntry[]): Promise<ReminderExportResult> {
  return shareLines(buildReminderLines(plan));
}

/** Ein einzelner Tag. */
export function exportDayToReminder(item: PlanEntry): Promise<ReminderExportResult> {
  return shareLines(item.recipeTitle ? [buildDayLine(item)] : []);
}

/** Die ganze Einkaufsliste, eine Zeile pro Zutat. */
export function exportShoppingList(items: ShoppingEntry[]): Promise<ReminderExportResult> {
  return shareLines(buildShoppingLines(items));
}
