import "server-only";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { EXPENSE_CATEGORIES, type ExpenseCategory } from "./categories";
import type { CategoryProvider } from "./categorize";

const DEFAULT_MODEL = "gemini-3.5-flash-lite";

const SYSTEM_INSTRUCTION = `Clasificas comercios de Colombia en categorías de gasto personal.
Recibes nombres de comercio tal como aparecen en un extracto bancario (pueden venir cortados o en mayúsculas).
Para cada uno elige exactamente una categoría de la lista. Si no reconoces el comercio, usa "Otros".
Responde solo con el JSON pedido.`;

const responseJsonSchema = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          merchant: { type: "string" },
          category: { type: "string", enum: [...EXPENSE_CATEGORIES] },
        },
        required: ["merchant", "category"],
      },
    },
  },
  required: ["items"],
};

// La respuesta de la IA se valida igual que cualquier entrada externa.
const responseSchema = z.object({
  items: z.array(z.object({ merchant: z.string(), category: z.enum(EXPENSE_CATEGORIES) })),
});

/**
 * Gemini (plan gratuito). Solo recibe nombres de comercio: nunca montos,
 * fechas ni nombres de personas. `store: false` para que no se guarde la solicitud.
 */
export function createGeminiProvider(): CategoryProvider | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const client = new GoogleGenAI({ apiKey });
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;

  return {
    async categorize(merchantKeys) {
      const interaction = await client.interactions.create({
        model,
        system_instruction: SYSTEM_INSTRUCTION,
        input: `Comercios:\n${merchantKeys.map((m) => `- ${m}`).join("\n")}`,
        response_format: { type: "text", mime_type: "application/json", schema: responseJsonSchema },
        store: false,
      });

      const parsed = responseSchema.safeParse(JSON.parse(interaction.output_text ?? "{}"));
      const result = new Map<string, ExpenseCategory>();
      if (!parsed.success) return result;

      // Solo se aceptan comercios que se preguntaron (la IA podría inventar otros).
      const asked = new Set(merchantKeys);
      for (const { merchant, category } of parsed.data.items) {
        if (asked.has(merchant)) result.set(merchant, category);
      }
      return result;
    },
  };
}
