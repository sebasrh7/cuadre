import "server-only";
import type { requireUser } from "@/lib/auth";
import { buildTaxRules, type TaxRules } from "./rules";

type Supabase = Awaited<ReturnType<typeof requireUser>>["supabase"];

/**
 * Reglas del año pedido o, si aún no se han cargado, las del último año
 * disponible (`isFallback` para avisarle al usuario).
 */
export async function loadTaxRules(
  supabase: Supabase,
  year: number,
): Promise<{ rules: TaxRules; isFallback: boolean } | null> {
  const { data: latest } = await supabase
    .from("tax_rules")
    .select("year")
    .lte("year", year)
    .order("year", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!latest) return null;

  const { data, error } = await supabase
    .from("tax_rules")
    .select("year, key, value, unit, norm, source_url")
    .eq("year", latest.year);
  if (error || !data) return null;

  return { rules: buildTaxRules(data), isFallback: latest.year !== year };
}
