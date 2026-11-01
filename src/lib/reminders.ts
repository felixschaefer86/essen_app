// src/lib/reminders.ts
//
// Export des Wochenplans für die iOS-Erinnerungen-App.
// Die Erinnerungen-App hat keine Web-Schnittstelle zum direkten Anlegen von
// Einträgen. Beim Einfügen von mehrzeiligem Text in eine Erinnerungen-Liste
// legt iOS aber pro Zeile eine eigene Erinnerung (Checkbox) an. Deshalb wird
// der Plan als einfacher Text mit einer Zeile pro Tag erzeugt und in die
// Zwischenablage kopiert (Fallback: Teilen-Dialog).

export type PlanEntry = { day: string; date: Date; recipeTitle: string };

export type ReminderExportResult = "copied" | "shared" | "empty" | "failed";

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

  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    // Zwischenablage nicht verfügbar (z. B. unsicherer Kontext) -> Teilen-Dialog versuchen
  }

  try {
    if (typeof navigator.share === "function") {
      await navigator.share({ text });
      return "shared";
    }
  } catch {
    // Teilen abgebrochen oder fehlgeschlagen
  }

  return "failed";
}
