import { requireUser } from "@/lib/auth";

/** Movimientos en CSV (abre en Excel): un archivo por todos los años. */
export async function GET() {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("movements")
    .select("occurred_on, direction, kind, amount_cop, counterparty, category, source, account_last4")
    .order("occurred_on");
  if (error) return new Response("No pudimos exportar tus movimientos.", { status: 500 });

  const kinds = { income: "Ingreso", expense: "Gasto", own_transfer: "Entre mis cuentas", received: "Recibido (sin clasificar)" } as const;
  const header = ["Fecha", "Tipo", "Valor (COP)", "Comercio o persona", "Categoría", "Fuente", "Cuenta"];
  const rows = data.map((m) => [
    m.occurred_on,
    kinds[m.kind as keyof typeof kinds] ?? m.kind,
    String(m.direction === "in" ? m.amount_cop : -m.amount_cop),
    m.counterparty ?? "",
    m.category ?? "",
    m.source,
    m.account_last4 ? `*${m.account_last4}` : "",
  ]);

  // BOM para que Excel reconozca UTF-8 (tildes y ñ); punto y coma por la configuración regional de Colombia.
  const csv = "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(";")).join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cuadre-movimientos.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

function csvCell(value: string): string {
  // Evita que Excel interprete celdas como fórmulas (inyección CSV).
  const safe = /^[=+\-@\t\r]/.test(value) && !/^-?\d+$/.test(value) ? `'${value}` : value;
  return /[";\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}
