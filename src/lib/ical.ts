// src/lib/ical.ts

export function generateICS(weeklyPlan: { day: string; date: Date; recipeTitle: string }[]) {
  let icsContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Familien Speiseplan//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  weeklyPlan.forEach((item) => {
    if (!item.recipeTitle) return;

    const year = item.date.getFullYear();
    const month = String(item.date.getMonth() + 1).padStart(2, "0");
    const day = String(item.date.getDate()).padStart(2, "0");
    
    // Ohne TZID direkt als lokale Zeit oder sauberes UTC, um Apple-Parsing-Fehler zu vermeiden
    const dtStart = `${year}${month}${day}T180000`;
    const dtEnd = `${year}${month}${day}T190000`;
    const uid = `${year}${month}${day}-${Math.random().toString(36).substring(2, 9)}@speiseplan.app`;
    const dtStamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

    icsContent.push(
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${dtStamp}`,
      `DTSTART:${dtStart}`, // Ohne TZID-Param, wird als lokale Zeit interpretiert
      `DTEND:${dtEnd}`,
      `SUMMARY:Abendessen: ${item.recipeTitle}`,
      `DESCRIPTION:Geplantes Gericht aus dem Familien-Speiseplan: ${item.recipeTitle}`,
      "END:VEVENT"
    );
  });

  icsContent.push("END:VCALENDAR");

  // Wichtig: \r\n für jeden Zeilenumbruch im iCal-Standard!
  const blob = new Blob([icsContent.join("\r\n")], { type: "text/calendar;charset=utf-8" });
  const url = window.URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `Speiseplan-${new Date().toISOString().slice(0, 10)}.ics`);
  
  // Für Safari im DOM kurz einhängen, anklicken und aufräumen
  document.body.appendChild(link);
  link.click();
  
  setTimeout(() => {
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }, 100);
}