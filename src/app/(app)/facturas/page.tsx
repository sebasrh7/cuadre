import { Suspense } from "react";
import { requireConsentedUser } from "@/lib/auth";
import { formatCop } from "@/lib/money/format";
import { deleteInvoice } from "./actions";
import { InvoiceImporter } from "./invoice-importer";

/** Consulta pública de la DIAN: la misma dirección del código QR de la factura. */
const dianUrl = (cufe: string) => `https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=${cufe}`;

export default function InvoicesPage() {
  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold">Facturas electrónicas</h1>
        <p className="text-sm text-muted">
          Sube el ZIP (o el XML) que llega al correo con cada factura electrónica. Cuadre la enlaza con el gasto que
          la pagó, para que tengas el soporte a la mano. No cambia tus cuentas: una factura no crea gastos nuevos. El
          archivo se lee en tu navegador; solo guardamos el vendedor, el número, la fecha, el valor y el código de la
          factura.
        </p>
      </div>
      <InvoiceImporter />
      <Suspense fallback={<p className="text-muted">Cargando…</p>}>
        <InvoiceList />
      </Suspense>
    </>
  );
}

async function InvoiceList() {
  const { supabase } = await requireConsentedUser();
  const { data, error } = await supabase
    .from("invoices")
    .select("id, cufe, number, issued_on, issuer_nit, issuer_name, total_cop, movement_id, movements(occurred_on, counterparty)")
    .order("issued_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) return <p className="text-danger">No pudimos cargar tus facturas.</p>;
  if (!data.length) return <p className="text-sm text-muted">Todavía no has subido facturas.</p>;

  const linked = data.filter((invoice) => invoice.movement_id).length;
  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">Tus facturas</h2>
        <p className="text-sm text-muted">
          {linked} de {data.length} enlazadas con su gasto
        </p>
      </div>
      <ul className="flex flex-col divide-y divide-border rounded-lg border border-border text-sm">
        {data.map((invoice) => (
          <li key={invoice.id} className="grid grid-cols-[1fr_auto] items-baseline gap-x-3 gap-y-1 px-4 py-2">
            <span className="min-w-0 truncate">{invoice.issuer_name}</span>
            <span className="text-right tabular-nums">{formatCop(invoice.total_cop)}</span>
            <span className="col-span-2 text-xs text-muted">
              {invoice.issued_on} · Factura {invoice.number} · NIT {invoice.issuer_nit}
            </span>
            <div className="text-xs">
              {invoice.movements ? (
                <span className="text-accent">
                  ✓ Pagada el {invoice.movements.occurred_on}
                  {invoice.movements.counterparty && ` · ${invoice.movements.counterparty}`}
                </span>
              ) : (
                <span className="text-muted">Sin gasto enlazado todavía</span>
              )}
            </div>
            <div className="flex gap-3 text-xs">
              <a href={dianUrl(invoice.cufe)} target="_blank" rel="noreferrer" className="underline">
                Ver en la DIAN
              </a>
              <form action={deleteInvoice}>
                <input type="hidden" name="id" value={invoice.id} />
                <button className="text-muted hover:text-danger" aria-label={`Borrar la factura ${invoice.number}`}>
                  Borrar
                </button>
              </form>
            </div>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted">
        Una factura se enlaza con un gasto del mismo valor exacto, pagado entre 3 días antes y 30 días después de su
        fecha. Si pagaste en efectivo no habrá gasto con qué enlazarla.
      </p>
    </section>
  );
}
