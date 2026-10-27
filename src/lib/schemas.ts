import { z } from "zod";
import { parseCopAmount, parseMinorAmount } from "@/lib/parsers/amount";

/** Campo vacío del formulario → `undefined`. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || undefined);

const last4 = z
  .string()
  .trim()
  .regex(/^(\d{4})?$/, "Escribe solo los últimos 4 dígitos")
  .transform((v) => v || undefined);

/** Lista separada por comas o saltos de línea, sin vacíos ni repetidos (sin importar mayúsculas). */
const list = (maxItem: number) =>
  z
    .string()
    .transform((v) => {
      const items = v.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
      return items.filter((item, i) => items.findIndex((o) => o.toLowerCase() === item.toLowerCase()) === i);
    })
    .pipe(z.array(z.string().max(maxItem)).max(10));

export const onboardingSchema = z.object({
  workerType: z.enum(["employee_contractor", "freelancer", "other"]),
  arlRisk: z.coerce.number().int().min(1).max(5),
  nitLastDigit: z.coerce.number().int().min(0).max(9),
  ownNames: list(80).pipe(z.array(z.string()).min(1, "Escribe al menos tu nombre")),
  ownKeys: list(80),
  savingsLast4: last4,
  debitCardLast4: last4,
  creditCardLast4: last4,
});

export type OnboardingInput = z.output<typeof onboardingSchema>;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Monto escrito por el usuario → entero, o error de validación legible. */
function amount(parse: (raw: string) => number, message: string) {
  return z.string().transform((raw, ctx) => {
    try {
      const value = parse(raw);
      if (value > 0) return value;
    } catch {}
    ctx.addIssue({ code: "custom", message });
    return z.NEVER;
  });
}

export const foreignIncomeSchema = z.object({
  receivedOn: z.string().regex(ISO_DATE, "Fecha inválida"),
  amountUsdCents: amount(parseMinorAmount, "Monto en USD inválido"),
  // Opcional: si ya vio el abono en la cuenta, se registra el movimiento en COP.
  amountCop: z
    .string()
    .trim()
    .transform((v) => v || undefined)
    .pipe(amount(parseCopAmount, "Monto en COP inválido").optional()),
  payer: optionalText(120),
});

export type ForeignIncomeInput = z.output<typeof foreignIncomeSchema>;
