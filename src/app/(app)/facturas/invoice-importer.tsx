"use client";

import { useState, useTransition } from "react";
import { Button, Field, FormError, Input } from "@/components/ui";
import { formatCop } from "@/lib/money/format";
import { parseDianInvoice, type DianInvoice, type DianInvoiceProblem } from "@/lib/parsers/dian-invoice";
import { readInvoiceXmls } from "@/lib/parsers/dian-invoice-file";
import { saveInvoices, type SaveInvoicesResult } from "./actions";

const PROBLEMS: Record<DianInvoiceProblem | "no_xml", string> = {
  no_xml: "no trae ningún XML (el PDF solo no sirve)",
  not_an_invoice: "no es una factura electrónica de la DIAN",
  adjustment_note: "es una nota crédito o débito, no una factura",
  foreign_currency: "está en otra moneda",
  missing_fields: "no pudimos leerla: le falta algún dato",
};

interface Read {
  invoices: DianInvoice[];
  /** Archivos que no se pudieron leer, con el motivo. */
  skipped: { file: string; reason: string }[];
}

export function InvoiceImporter() {
  const [read, setRead] = useState<Read>();
  const [result, setResult] = useState<Extract<SaveInvoicesResult, { ok: true }>>();
  const [error, setError] = useState<string>();
  const [reading, setReading] = useState(false);
  const [saving, startSaving] = useTransition();

  // onSubmit y no `action`: React reinicia los formularios con action al terminar.
  async function readFiles(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const files = new FormData(event.currentTarget).getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
    setResult(undefined);
    if (!files.length) return setError("Elige el archivo de la factura (ZIP o XML).");

    setReading(true);
    try {
      const byCufe = new Map<string, DianInvoice>();
      const skipped: Read["skipped"] = [];
      for (const file of files) {
        const xmls = readInvoiceXmls(new Uint8Array(await file.arrayBuffer()));
        const parsed = xmls.map(parseDianInvoice);
        const found = parsed.filter((p) => p.ok);
        for (const { invoice } of found) byCufe.set(invoice.cufe, invoice);
        if (!found.length) {
          const problem = parsed.find((p) => !p.ok)?.problem ?? "no_xml";
          skipped.push({ file: file.name, reason: PROBLEMS[problem] });
        }
      }
      setRead({ invoices: [...byCufe.values()], skipped });
      setError(byCufe.size ? undefined : "No encontramos ninguna factura electrónica en esos archivos.");
    } finally {
      setReading(false);
    }
  }

  function save() {
    if (!read?.invoices.length) return;
    startSaving(async () => {
      const saved = await saveInvoices(read.invoices);
      if (!saved.ok) return setError(saved.error);
      setResult(saved);
      setRead(undefined);
    });
  }

  return (
    <section className="flex flex-col gap-4">
      {result && (
        <div role="status" className="rounded-lg border border-accent p-4 text-sm">
          <p className="font-medium">Facturas guardadas.</p>
          <ul>
            <li>{plural(result.inserted, "factura nueva", "facturas nuevas")}</li>
            {result.duplicates > 0 && <li>{plural(result.duplicates, "ya estaba guardada", "ya estaban guardadas")}</li>}
            {result.linked > 0 && <li>{plural(result.linked, "enlazada", "enlazadas")} con su gasto</li>}
            {result.inserted > result.linked && (
              <li>Las que no tienen gasto se enlazan solas cuando importes el extracto o la alerta del pago</li>
            )}
          </ul>
        </div>
      )}

      {!read?.invoices.length && (
        <form onSubmit={readFiles} className="flex flex-col gap-4 rounded-lg border border-border p-4">
          <Field
            label="Facturas (ZIP o XML)"
            hint="El archivo adjunto del correo de la factura. Puedes elegir varios. Se leen en tu navegador."
          >
            <Input name="files" type="file" multiple accept=".zip,.xml,application/zip,application/xml,text/xml" required />
          </Field>
          <FormError message={error} />
          <Skipped skipped={read?.skipped} />
          <Button disabled={reading}>{reading ? "Leyendo…" : "Leer facturas"}</Button>
        </form>
      )}

      {read && read.invoices.length > 0 && (
        <>
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border text-sm">
            {read.invoices.map((invoice) => (
              <li key={invoice.cufe} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 px-4 py-2">
                <span className="min-w-0 truncate">{invoice.issuerName}</span>
                <span className="text-right tabular-nums">{formatCop(invoice.totalCop)}</span>
                <span className="col-span-2 text-xs text-muted">
                  {invoice.issuedOn} · Factura {invoice.number} · NIT {invoice.issuerNit}
                </span>
              </li>
            ))}
          </ul>
          <Skipped skipped={read.skipped} />
          <FormError message={error} />
          <div className="flex gap-3">
            <Button onClick={save} disabled={saving}>
              {saving ? "Guardando…" : `Guardar ${plural(read.invoices.length, "factura", "facturas")}`}
            </Button>
            <Button variant="ghost" onClick={() => setRead(undefined)} disabled={saving}>
              Cancelar
            </Button>
          </div>
        </>
      )}
    </section>
  );
}

function Skipped({ skipped }: { skipped?: Read["skipped"] }) {
  if (!skipped?.length) return null;
  return (
    <ul className="text-sm text-muted">
      {skipped.map(({ file, reason }) => (
        <li key={file}>
          {file}: {reason}.
        </li>
      ))}
    </ul>
  );
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}
