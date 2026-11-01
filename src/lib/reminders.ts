// src/lib/reminders.ts
//
// Export des Wochenplans für die iOS-Erinnerungen-App.
// Die Erinnerungen-App hat keine Web-Schnittstelle zum direkten Anlegen von
// Einträgen, und Einfügen aus der Zwischenablage legt nur eine einzige Erinnerung an.
// Deshalb wird der Plan als Text mit einer Zeile pro Tag über das Teilen-Menü
// weitergegeben. Ein Kurzbefehl (siehe Hinweis auf der Planseite) teilt den Text
// an den Zeilenumbrüchen auf und legt pro Zeile eine Erinnerung (Checkbox) an.
// Ohne Teilen-Unterstützung wird der Text in die Zwischenablage kopiert.

export type PlanEntry = { day: string; date: Date; recipeTitle: string };

export type ReminderExportResult = "shared" | "copied" | "cancelled" | "empty" | "failed";

/** Eine Zeile pro Tag mit Gericht, z. B. "Montag 26.10.: Lasagne". Tage ohne Gericht entfallen. */
export function buildReminderLines(plan: PlanEntry[]): string[] {
  return plan
    .filter((item) => item.recipeTitle)
    .map((item) => {
      const date = item.date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
      return `${item.day} ${date}: ${item.recipeTitle}`;
    });
}

export async function exportToReminders(plan: PlanEntry[]): Promise<ReminderExportResult> {
  const lines = buildReminderLines(plan);
  if (lines.length === 0) return "empty";

  const text = lines.join("\n");

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
