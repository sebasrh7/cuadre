import { z } from "zod";
import { buildIcs } from "@/lib/dates/ics";
import { upcomingPilaDues } from "@/lib/dates/pila";
import { createClient } from "@/lib/supabase/server";

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/**
 * Calendario suscribible (.ics) con las fechas de la PILA. Lo pide Google
 * Calendar sin sesión, así que se identifica por un token secreto. No incluye
 * montos ni datos personales: solo fechas.
 */
export async function GET(_req: Request, ctx: RouteContext<"/calendario/[token]">) {
  const { token } = await ctx.params;
  const parsed = z.uuid().safeParse(token.replace(/\.ics$/, ""));
  if (!parsed.success) return new Response("No encontrado", { status: 404 });

  const supabase = await createClient();
  const { data } = await supabase.rpc("calendar_for_token", { p_token: parsed.data });
  const row = data?.[0];
  if (!row) return new Response("No encontrado", { status: 404 });

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
  const events = upcomingPilaDues(today, row.business_day, 12).map((due) => {
    const month = MONTHS[Number(due.periodMonth.slice(5)) - 1];
    return {
      uid: `pila-${due.periodMonth}-${parsed.data}@cuadre`,
      date: due.dueDate,
      summary: `Pagar PILA de ${month}`,
      description:
        `Fecha límite para pagar los aportes de ${month} (mes vencido). ` +
        "Aplica si ese mes recibiste 1 salario mínimo o más. Revisa el valor estimado en Cuadre.",
      remindDaysBefore: 2,
    };
  });

  return new Response(buildIcs("Cuadre · PILA", events, new Date()), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
