import { describe, expect, it, vi } from "vitest";
import { categoryByKeyword, merchantKey } from "./categories";
import { categorizeMerchants, type CategoryProvider, type ResolvedCategory } from "./categorize";

describe("merchantKey", () => {
  it.each([
    ["TIENDA D1 CALI 245", "TIENDA D CALI"],
    ["Droguería La Économía #12", "DROGUERIA LA ECONOMIA"],
    ["  FLYPASS  ", "FLYPASS"],
  ])("%s → %s", (name, key) => {
    expect(merchantKey(name)).toBe(key);
  });
});

describe("categoryByKeyword", () => {
  it.each([
    ["FLYPASS", "Transporte"],
    ["ESTACION D", "Transporte"],
    ["TIENDA D", "Mercado"],
    ["NETFLIX COM", "Suscripciones"],
    ["CELSIA COLOMBIA SA", "Servicios públicos"],
    ["CLARO COLOMBIA", "Telefonía e internet"],
    ["DROGUERIA LA ECONOMIA", "Salud"],
    ["APORTES EN LINEA", "Impuestos y seguridad social"],
    ["RETIRO EN CAJERO", "Efectivo"],
    ["SUC VIRTUAL", "Transferencias"],
  ])("%s → %s", (key, category) => {
    expect(categoryByKeyword(key)).toBe(category);
  });

  it("no adivina comercios desconocidos", () => {
    expect(categoryByKeyword("COMERCIO DESCONOCIDO")).toBeNull();
    expect(categoryByKeyword("CARLOS D")).toBeNull();
  });
});

function fakeProvider(answers: Record<string, string>): CategoryProvider & { calls: string[][] } {
  const calls: string[][] = [];
  return {
    calls,
    async categorize(keys) {
      calls.push(keys);
      return new Map(keys.filter((k) => answers[k]).map((k) => [k, answers[k] as never]));
    },
  };
}

describe("categorizeMerchants", () => {
  const allow = vi.fn(async () => true);

  it("respeta lo guardado (correcciones del usuario) antes que reglas e IA", async () => {
    const known = new Map<string, ResolvedCategory>([["FLYPASS", { category: "Otros", source: "user" }]]);
    const provider = fakeProvider({});
    const result = await categorizeMerchants({ merchantKeys: ["FLYPASS"], known, provider, reserveAiCall: allow });
    expect(result.resolved.get("FLYPASS")).toEqual({ category: "Otros", source: "user" });
    expect(provider.calls).toEqual([]);
    expect(result.learned.size).toBe(0);
  });

  it("usa reglas sin llamar a la IA y las aprende", async () => {
    const provider = fakeProvider({});
    const result = await categorizeMerchants({ merchantKeys: ["FLYPASS"], known: new Map(), provider, reserveAiCall: allow });
    expect(result.resolved.get("FLYPASS")).toEqual({ category: "Transporte", source: "rule" });
    expect(provider.calls).toEqual([]);
  });

  it("pregunta a la IA solo lo desconocido, en lotes y sin repetidos", async () => {
    const provider = fakeProvider({ "LIBRERIA X": "Educación", "VET Y": "Mascotas" });
    const result = await categorizeMerchants({
      merchantKeys: ["LIBRERIA X", "VET Y", "LIBRERIA X", "FLYPASS"],
      known: new Map(),
      provider,
      reserveAiCall: allow,
      batchSize: 1,
    });
    expect(provider.calls).toEqual([["LIBRERIA X"], ["VET Y"]]);
    expect(result.aiCalls).toBe(2);
    expect(result.resolved.get("VET Y")).toEqual({ category: "Mascotas", source: "ai" });
  });

  it("sin IA deja pendientes los desconocidos en vez de inventar", async () => {
    const result = await categorizeMerchants({ merchantKeys: ["RARO"], known: new Map(), provider: null, reserveAiCall: allow });
    expect(result.pending).toEqual(["RARO"]);
    expect(result.resolved.has("RARO")).toBe(false);
  });

  it("se detiene cuando se acaba el cupo diario", async () => {
    let left = 1;
    const provider = fakeProvider({ A: "Otros", B: "Otros" });
    const result = await categorizeMerchants({
      merchantKeys: ["A", "B"],
      known: new Map(),
      provider,
      reserveAiCall: async () => left-- > 0,
      batchSize: 1,
    });
    expect(result.aiCalls).toBe(1);
    expect(result.pending).toEqual(["B"]);
  });

  it("nunca envía a la IA lo que parece un nombre de persona", async () => {
    const provider = fakeProvider({ "PEDRO PRUEBA PI A": "Otros", "ROYAL FILMS": "Entretenimiento" });
    const result = await categorizeMerchants({
      merchantKeys: ["PEDRO PRUEBA PI A", "ROYAL FILMS"],
      known: new Map(),
      provider,
      reserveAiCall: allow,
    });
    expect(provider.calls).toEqual([["ROYAL FILMS"]]);
    expect(result.pending).toEqual(["PEDRO PRUEBA PI A"]);
    expect(result.personal).toEqual(["PEDRO PRUEBA PI A"]);
  });

  it("si la IA falla, los comercios quedan pendientes", async () => {
    const provider: CategoryProvider = { categorize: async () => { throw new Error("caída"); } };
    const result = await categorizeMerchants({ merchantKeys: ["A"], known: new Map(), provider, reserveAiCall: allow });
    expect(result.pending).toEqual(["A"]);
  });
});
