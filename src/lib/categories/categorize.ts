import { categoryByKeyword, looksLikePersonName, type ExpenseCategory } from "./categories";

/** Algo que sabe proponer categorías para nombres de comercio (la IA, o nada). */
export interface CategoryProvider {
  /** Recibe claves de comercio y devuelve las que pudo clasificar. */
  categorize(merchantKeys: string[]): Promise<Map<string, ExpenseCategory>>;
}

export type CategorySource = "user" | "ai" | "rule";

export interface ResolvedCategory {
  category: ExpenseCategory;
  source: CategorySource;
}

export interface CategorizeInput {
  merchantKeys: string[];
  /** Lo ya guardado en `merchant_categories` (correcciones del usuario y caché). */
  known: Map<string, ResolvedCategory>;
  provider: CategoryProvider | null;
  /** Pide permiso para una llamada a la IA (cupo diario). */
  reserveAiCall: () => Promise<boolean>;
  batchSize?: number;
}

export interface CategorizeResult {
  resolved: Map<string, ResolvedCategory>;
  /** Entradas nuevas para guardar en la caché. */
  learned: Map<string, ResolvedCategory>;
  aiCalls: number;
  /** Comercios que quedaron sin categoría (sin IA, sin cupo o la IA no supo). */
  pending: string[];
  /** Parte de `pending` que parece nombre de persona y no se envió a la IA. */
  personal: string[];
}

/**
 * Orden de prioridad: corrección del usuario o caché → reglas por palabra
 * clave → IA en lotes, mientras haya cupo. Siempre funciona sin IA: lo que no
 * se pueda clasificar queda pendiente, no inventado.
 */
export async function categorizeMerchants(input: CategorizeInput): Promise<CategorizeResult> {
  const { known, provider, reserveAiCall, batchSize = 40 } = input;
  const resolved = new Map<string, ResolvedCategory>();
  const learned = new Map<string, ResolvedCategory>();
  const unknown: string[] = [];
  const private_: string[] = [];

  for (const key of new Set(input.merchantKeys)) {
    const cached = known.get(key);
    if (cached) {
      resolved.set(key, cached);
      continue;
    }
    const byRule = categoryByKeyword(key);
    if (byRule) {
      const entry = { category: byRule, source: "rule" as const };
      resolved.set(key, entry);
      learned.set(key, entry);
      continue;
    }
    // Privacidad: lo que parece un nombre de persona no sale hacia la IA.
    if (looksLikePersonName(key)) {
      private_.push(key);
      continue;
    }
    unknown.push(key);
  }

  let aiCalls = 0;
  const pending: string[] = [...private_];
  for (let i = 0; i < unknown.length; i += batchSize) {
    const batch = unknown.slice(i, i + batchSize);
    if (!provider || !(await reserveAiCall())) {
      pending.push(...unknown.slice(i));
      break;
    }
    aiCalls++;
    let suggestions = new Map<string, ExpenseCategory>();
    try {
      suggestions = await provider.categorize(batch);
    } catch {
      // Si la IA falla, esos comercios quedan pendientes para otro intento.
    }
    for (const key of batch) {
      const category = suggestions.get(key);
      if (!category) {
        pending.push(key);
        continue;
      }
      const entry = { category, source: "ai" as const };
      resolved.set(key, entry);
      learned.set(key, entry);
    }
  }

  return { resolved, learned, aiCalls, pending, personal: private_ };
}
