# Cuadre

Copiloto financiero para independientes en Colombia. Alcance completo en `docs/ALCANCE.md`; léelo antes de proponer funcionalidades nuevas.

@AGENTS.md

## Stack
Next.js 16 (App Router) + TypeScript estricto · Supabase (Postgres, RLS, Auth, Storage) · Tailwind + shadcn/ui · Zod · Vitest + Playwright · Vercel.

## Comandos
- `npm test` — tests (Vitest)
- `npm run typecheck` — genera los tipos de rutas de Next y corre `tsc`
- `npm run lint`

## Reglas
- **Costo $0:** nada que requiera pagar. La IA (Gemini Flash, plan gratuito) es opcional en cada flujo: siempre debe existir un camino sin IA.
- **Dinero:** los montos se guardan como enteros (pesos sin decimales; centavos para USD), nunca como `float`. Todo cálculo de dinero lleva tests.
- **Reglas fiscales:** nunca en el código. Viven en la tabla `tax_rules` por año, con la URL de la fuente oficial.
- **Seguridad:** toda tabla con datos de usuario tiene RLS. Las llaves de API solo se usan en el servidor.
- **Validación:** Zod en toda entrada de usuario, todo archivo leído y toda respuesta de la IA.
- **Parsers** (`src/lib/parsers/`): funciones puras, probadas con fixtures reales **anonimizados** (sin nombres, números de cuenta ni de tarjeta completos).
- **Privacidad:** guardar lo mínimo. Nunca registrar en logs datos financieros ni texto crudo de alertas.
- Interfaz y textos en español (Colombia).
