"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireConsentedUser } from "@/lib/auth";
import { linkInvoices } from "@/lib/movements/invoices";
import { dianInvoiceSchema } from "@/lib/parsers/dian-invoice";

export type SaveInvoicesResult =
  | { ok: true; inserted: number; duplicates: number; linked: number }
  | { ok: false; error: string };

/** Llegan facturas ya leídas en el navegador: el XML y el PDF nunca salen del equipo. */
export async function saveInvoices(input: unknown): Promise<SaveInvoicesResult> {
  const parsed = z.array(dianInvoiceSchema).min(1).max(200).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Las facturas no son válidas." };

  const { supabase, userId } = await requireConsentedUser();
  const unique = [...new Map(parsed.data.map((invoice) => [invoice.cufe, invoice])).values()];
  const { data, error } = await supabase
    .from("invoices")
    .upsert(
      unique.map((invoice) => ({
        user_id: userId,
        cufe: invoice.cufe,
        number: invoice.number,
        issued_on: invoice.issuedOn,
        issuer_nit: invoice.issuerNit,
        issuer_name: invoice.issuerName,
        total_cop: invoice.totalCop,
      })),
      { onConflict: "user_id,cufe", ignoreDuplicates: true },
    )
    .select("id");
  if (error) return { ok: false, error: "No pudimos guardar las facturas. Inténtalo de nuevo." };

  const linked = await linkInvoices(supabase);
  refresh();
  return { ok: true, inserted: data?.length ?? 0, duplicates: unique.length - (data?.length ?? 0), linked };
}

export async function deleteInvoice(formData: FormData) {
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  const { supabase } = await requireConsentedUser();
  await supabase.from("invoices").delete().eq("id", id.data);
  refresh();
}
