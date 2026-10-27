# Cuadre — Alcance v1

> Nombre provisional. "Cuadrar las cuentas": saber cómo vas cada mes sin Excel ni contador.

## 1. Problema y usuario

**Usuario objetivo:** persona natural independiente en Colombia (contratista, freelancer, desarrollador remoto) que recibe ingresos —a menudo del exterior— y no tiene contador fijo.

**Usuario #1:** el autor. Ingresos en USD por giro internacional a una cuenta de ahorros Bancolombia, sin factura ni cuenta de cobro. Además usa Nequi, Nu débito y Nu crédito.

**Problema:** no sabe con claridad cuánto ganó en pesos, cuánto pierde en el cambio, cuánto gastó, cuánto le toca aportar a seguridad social ni si debe declarar renta.

**Promesa v1:** *"En 5 minutos al mes sabes cómo vas y no se te pasa ninguna obligación."*

## 2. Principios

1. **Costo $0 aunque crezca.** La IA es complemento, no motor. Todo lo esencial funciona sin ella.
2. **Privacidad primero.** Datos financieros: RLS por usuario, exportar y borrar todo, nada sensible a la IA sin consentimiento. Se guarda lo mínimo (últimos 4 dígitos de cuentas y tarjetas, nunca el número completo).
3. **Orientación, no asesoría.** Cada cálculo muestra su fórmula y la norma de la que sale.
4. **Mobile-first, instalable (PWA).**
5. **Construir sobre datos reales.** Ningún parser se escribe sin haber visto el formato real; los fixtures del repo son sintéticos.

## 3. Hallazgos de la revisión del correo (semana 0, 2026-10-27)

| Fuente | Volumen | Hallazgo |
|---|---|---|
| Alertas de Bancolombia por correo | ~11/mes | 4 plantillas: compra con débito, transferencia a llave (Bre-B), transferencia a cuenta, transferencia recibida. **Formatos de monto inconsistentes** (`$80.000,00`, `$500,000.00`, `$75000.00`, `$55,000`) y año con 2 o 4 dígitos. No cubren todos los movimientos |
| Facturas electrónicas DIAN | ~38/año (~3/mes) | ZIP con XML + PDF. Asunto estándar `NIT;Razón social;Número;01;...`. Servicios públicos, peajes, cine, supermercado, streaming, seguros |
| Extracto mensual Bancolombia | 1/mes | PDF con contraseña y **texto seleccionable**. Contiene todos los movimientos de la cuenta, incluidos los ingresos del exterior como `ABONO DE GIRO INTERNACIONAL` |
| Avisos de ingresos del exterior | 0 | Ningún correo avisa de los giros internacionales: solo aparecen en el extracto |
| Transferencias propias | Frecuentes | Muchas transferencias van a cuentas o llaves del mismo titular. **Deben excluirse** de ingresos y gastos |

## 4. Fuentes de datos

| Prioridad | Fuente | Cómo entra | Estado |
|---|---|---|---|
| 1 | **Extracto mensual Bancolombia (PDF)** | Se sube y se lee **en el navegador** con la contraseña del usuario; el PDF nunca sale del dispositivo, al servidor solo llegan los movimientos extraídos | v1 |
| 2 | **Alertas de Bancolombia** | Pegar el texto o compartirlo desde el celular (Web Share Target). Parser con regex, sin IA | v1 — **parser hecho** |
| 3 | **Facturas electrónicas DIAN (ZIP/XML)** | Arrastrar el archivo. Aporta NIT, razón social y soporte del gasto | v1 |
| 4 | **Ingresos en USD** | El usuario registra el monto en USD; la app lo concilia con el `ABONO DE GIRO INTERNACIONAL` del extracto y calcula la tasa efectiva y la pérdida cambiaria | v1 |
| 5 | Nequi, Nu débito, Nu crédito | Extractos o exportaciones de cada entidad; formatos por revisar | v2 |
| 6 | Importación automática desde Gmail | OAuth con Gmail (`gmail.readonly` es *scope* restringido: verificación de Google en producción; en modo testing alcanza para ≤100 usuarios) | v2 |

### Conciliación

- Alerta y movimiento del extracto del mismo día, monto y cuenta → un solo movimiento (la alerta llega primero; el extracto la confirma).
- Factura DIAN y gasto de igual monto en ±3 días → se enlazan (la factura enriquece el gasto).
- **Transferencias propias** (mismo titular, llaves o cuentas registradas como propias, pago de la tarjeta de crédito) → se marcan como `own_transfer` y no cuentan como ingreso ni gasto.

## 5. Funcionalidades v1

| # | Funcionalidad | Detalle |
|---|---|---|
| 1 | Autenticación | Google OAuth + enlace mágico (Supabase Auth) |
| 2 | Onboarding (≤2 min) | Tipo de independiente, riesgo ARL, últimos dígitos del NIT/cédula, **cuentas, llaves y nombres propios** (para detectar transferencias propias) |
| 3 | Importar extracto Bancolombia | PDF + contraseña, procesado en el navegador; vista previa antes de guardar |
| 4 | Pegar/compartir alertas | Parser de las 4 plantillas; deduplicación |
| 5 | Facturas DIAN | ZIP/XML → gasto enriquecido con NIT y soporte |
| 6 | **Ingresos en USD y pérdida cambiaria** | Monto en USD + abono en COP del extracto + TRM oficial del día → tasa efectiva y costo de recibir el pago, por mes y por año |
| 7 | Categorización de gastos (IA) | Comercio nuevo → Gemini propone categoría → caché por comercio normalizado; el usuario puede corregir |
| 8 | Panel mensual y anual | Ingresos (USD y COP), gastos por categoría, pérdida cambiaria, comparación entre meses |
| 9 | Calculadora de seguridad social | IBC y aportes estimados con la fórmula visible |
| 10 | "¿Me toca declarar renta?" | Semáforo por topes en UVT del año |
| 11 | Alertas de fechas | Seguridad social y renta según el NIT |
| 12 | Exportar y borrar | Excel por año; borrar cuenta y datos |
| 13 | Base de producto real | Privacidad (Ley 1581), Sentry, analítica, botón de comentarios |

## 6. Fuera de alcance v1

Nequi y Nu · lectura de fotos de recibos con IA · asistente RAG sobre normativa · emitir facturas electrónicas · conexión directa con bancos · generar el formulario de renta · personas jurídicas / régimen simple · otros países · importación automática desde Gmail.

## 7. Arquitectura y stack

| Capa | Elección |
|---|---|
| App | Next.js 16 (App Router), Server Actions, TypeScript estricto |
| Datos, auth, archivos | Supabase (Postgres + RLS + Storage + Auth) |
| UI | Tailwind + shadcn/ui, Recharts |
| Validación | Zod en toda entrada y en toda respuesta de IA |
| Parsers | Funciones puras en `src/lib/parsers/`, probadas con fixtures sintéticos |
| Extracto PDF | pdf.js en el navegador (soporta PDF con contraseña) |
| TRM | API de datos abiertos (datos.gov.co), cacheada en `fx_rates` una vez al día. **Verificar el endpoint antes de implementarlo** |
| IA | Gemini Flash (plan gratuito) detrás de `CategoryProvider`; caché, límite diario por usuario, *fallback* "Sin categoría" |
| Correo / cron | Resend (plan gratuito) + Vercel Cron |
| Calidad | Vitest, Playwright, GitHub Actions |
| Observabilidad | Sentry + PostHog (planes gratuitos) |
| Despliegue | Vercel Hobby |

### Modelo de datos (borrador)

- `profiles`, `own_accounts` (llaves, últimos 4 dígitos y nombres propios).
- `movements`: `date`, `time`, `amount_cop`, `direction` (`in` | `out`), `kind` (`income` | `expense` | `own_transfer`), `counterparty`, `merchant_id`, `category`, `source` (`statement` | `alert` | `dian_xml` | `manual`), `dedupe_hash`, `account_last4`.
- `foreign_incomes`: `movement_id`, `currency`, `amount_original`, `trm_reference`, `rate_effective` (calculada), `fx_cost_cop` (calculado).
- `invoices` (DIAN): `nit`, `issuer`, `number`, `cufe`, `total`, `movement_id`.
- `merchants`, `fx_rates`, `tax_rules` (por año, con URL de la fuente), `deadlines`, `attachments`, `ai_usage`.

**Regla:** los valores fiscales nunca van en el código; viven en `tax_rules` y se verifican contra DIAN / UGPP / MinSalud antes de publicarse.

## 8. Métricas de éxito

Usuarios activos al mes · retención del mes 2 · % de movimientos que entran por extracto o alerta (frente a manual) · % categorizado por caché frente a IA · costo de IA por usuario (meta: $0).

## 9. Plan

| Semana | Entregable |
|---|---|
| **0** ✅ | Revisión del correo, hallazgos (sección 3), proyecto Next.js, parser de alertas con tests |
| **1** | Supabase (esquema + RLS), autenticación, onboarding con cuentas propias, ingreso manual en USD. Primer despliegue en Vercel |
| **2** | Importar extracto PDF en el navegador (necesita un extracto anonimizado como referencia), conciliación con alertas, transferencias propias |
| **3** | Facturas DIAN, TRM y pérdida cambiaria, categorización con Gemini, panel |
| **4** | Seguridad social, semáforo de renta, alertas de fechas, exportar/borrar, privacidad, PWA, README. **Lanzamiento a 10-20 personas** |

## 10. Riesgos

| Riesgo | Mitigación |
|---|---|
| Bancolombia cambia el formato de alertas o extractos | Parsers aislados con fixtures; si fallan, el usuario ve el texto no reconocido y puede registrarlo a mano |
| Doble conteo entre alertas, extracto y facturas | Conciliación con reglas explícitas y tests |
| Transferencias propias infladas como ingreso o gasto | Cuentas propias en el onboarding + marcado `own_transfer` |
| Cálculo tributario incorrecto | Reglas en datos con su fuente, tests, aviso de orientación |
| Tratamiento fiscal de ingresos en USD | Verificarlo en la norma antes del semáforo; mostrar la tasa usada |
| Cuota gratuita de Gemini | Caché por comercio, límite diario, *fallback* sin IA |
