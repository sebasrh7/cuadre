export interface CalendarEvent {
  uid: string;
  /** Día completo, `YYYY-MM-DD`. */
  date: string;
  summary: string;
  description: string;
  /** Días antes para el recordatorio. */
  remindDaysBefore: number;
}

/**
 * Calendario iCalendar (RFC 5545) para suscribirse desde Google Calendar u
 * otro. Eventos de día completo con un recordatorio a las 9:00 a. m. del día
 * del aviso (hora de Colombia).
 */
export function buildIcs(name: string, events: CalendarEvent[], now: Date): string {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Cuadre//Recordatorios//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escape(name)}`,
    "X-WR-TIMEZONE:America/Bogota",
    "REFRESH-INTERVAL;VALUE=DURATION:PT12H",
    ...events.flatMap((e) => {
      const day = e.date.replace(/-/g, "");
      // Fin exclusivo: el día siguiente.
      const end = new Date(`${e.date}T00:00:00Z`);
      end.setUTCDate(end.getUTCDate() + 1);
      // 9:00 a. m. de Colombia el día del aviso = 15 h antes de la medianoche del evento.
      const triggerHours = e.remindDaysBefore * 24 + 15;
      return [
        "BEGIN:VEVENT",
        `UID:${e.uid}`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${day}`,
        `DTEND;VALUE=DATE:${end.toISOString().slice(0, 10).replace(/-/g, "")}`,
        `SUMMARY:${escape(e.summary)}`,
        `DESCRIPTION:${escape(e.description)}`,
        "TRANSP:TRANSPARENT",
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        `DESCRIPTION:${escape(e.summary)}`,
        `TRIGGER:-PT${triggerHours}H`,
        "END:VALARM",
        "END:VEVENT",
      ];
    }),
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}

function escape(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Líneas de máximo 75 octetos; las siguientes empiezan con un espacio. */
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  for (const char of line) {
    if (new TextEncoder().encode(current + char).length > (parts.length ? 74 : 75)) {
      parts.push(current);
      current = "";
    }
    current += char;
  }
  parts.push(current);
  return parts.join("\r\n ");
}
