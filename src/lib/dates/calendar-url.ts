/** Enlaces para suscribirse al calendario de recordatorios. */
export function calendarUrls(origin: string, token: string) {
  const https = `${origin}/calendario/${token}`;
  const webcal = https.replace(/^https?:/, "webcal:");
  return {
    https,
    webcal,
    google: `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}`,
  };
}
