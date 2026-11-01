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
    
    const dtStart = `${year}${month}${day}T180000`;
    const dtEnd = `${year}${month}${day}T190000`;
    const uid = `${year}${month}${day}-${Math.random().toString(36).substring(2, 9)}@speiseplan.app`;

    icsContent.push(
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").split(".")[0]}Z`,
      `DTSTART;TZID=Europe/Berlin:${dtStart}`,
      `DTEND;TZID=Europe/Berlin:${dtEnd}`,
      `SUMMARY:Abendessen: ${item.recipeTitle}`,
      `DESCRIPTION:Geplantes Gericht aus dem Familien-Speiseplan: ${item.recipeTitle}`,
      "END:VEVENT"
    );
  });

  icsContent.push("END:VCALENDAR");

  const fileString = icsContent.join("\r\n");
  const blob = new Blob([fileString], { type: "text/calendar;charset=utf-8" });
  const fileName = `Speiseplan-Woche-${new Date().toISOString().slice(0, 10)}.ics`;

  // Prüfen, ob der Web-Share-Dialog auf Mobilgeräten unterstützt wird (iOS Safari liebt das)
  const file = new File([blob], fileName, { type: "text/calendar" });
  
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    navigator.share({
      files: [file],
      title: "Wochenplan Kalender",
      text: "Dein geplanter Speiseplan als Kalenderdatei",
    }).catch((error) => console.log("Share abgebrochen", error));
  } else {
    // Fallback für normale Browser / Desktop
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}