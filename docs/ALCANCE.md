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
| 1 | **Extracto Bancolombia (PDF, trimestral)** | Se sube y se lee **en el navegador** con la contraseña del usuario; el PDF nunca sale del dispositivo, al servidor solo llegan los movimientos extraídos | v1 ✅ |
| 2 | **Alertas de Bancolombia** | Pegar el texto o compartirlo desde el celular (Web Share Target). Se leen en el navegador; al importar el extracto, sus movimientos reemplazan a las alertas | v1 ✅ |
| 3 | **Facturas electrónicas DIAN (ZIP/XML)** | Arrastrar el archivo. Aporta NIT, razón social y soporte del gasto | v2 |
| 4 | **Ingresos en USD (opcional)** | Solo para quien conoce el monto en USD: se concilia con el `ABONO DE GIRO INTERNACIONAL` y da la tasa efectiva. El usuario de referencia cobra un monto fijo en pesos y no conoce los dólares, así que los ingresos salen del extracto en COP | v1 |
| 5 | Nequi ✅, Cuenta Nu ✅, tarjeta de crédito Nu ✅ | Extractos en PDF, leídos en el navegador y verificados contra su resumen como los de Bancolombia. Tarjeta: cada compra cuenta una vez por su valor total en la fecha de compra (no por cuotas); intereses y cargos son gastos; el pago, de cualquier lado, es transferencia propia. Extractos de la tarjeta con devoluciones: todavía no (se rechazan sin guardar nada) | v1 ✅ (adelantado de la v2) |
| 6 | Importación automática desde Gmail | OAuth con Gmail (`gmail.readonly` es *scope* restringido: verificación de Google en producción; en modo testing alcanza para ≤100 usuarios) | v2 |

### Conciliación

- Alerta y movimiento del extracto del mismo día, monto y cuenta → un solo movimiento (la alerta llega primero; el extracto la confirma).
- Factura DIAN y gasto de igual monto en ±3 días → se enlazan (la factura enriquece el gasto).
- **Transferencias propias** (mismo titular, llaves o cuentas registradas como propias, pago de la tarjeta de crédito) → se marcan como `own_transfer` y no cuentan como ingreso ni gasto.
- **Recibido de personas** (o abonos sin identificar) → queda como `received` y no cuenta como ingreso hasta que el usuario lo marque: puede ser una deuda que le pagan o efectivo cambiado por transferencia. Para las consignaciones que mira la DIAN sí cuenta.
- **Ingreso declarado:** para un mes sin extracto el usuario escribe cuánto le llegó (uno por mes); el extracto lo reemplaza cuando trae ingresos de ese mes.

## 5. Funcionalidades v1

| # | Funcionalidad | Detalle |
|---|---|---|
| 1 | Autenticación | Solo Google (Supabase Auth) ✅. Sin correo ni contraseñas: no hay que enviar correos ni guardar claves. Si los usuarios de prueba lo piden: cuenta propia (requiere SMTP para confirmar y recuperar) o teléfono (SMS de pago) |
| 2 | Onboarding (≤2 min) ✅ | Tipo de independiente, riesgo ARL, últimos dígitos del NIT/cédula, **cuentas, llaves y nombres propios** (para detectar transferencias propias) |
| 3 | Importar extractos ✅ | Bancolombia, Nequi, Cuenta Nu y tarjeta de crédito Nu. PDF + contraseña, procesado en el navegador; se verifica contra su resumen y hay vista previa antes de guardar |
| 4 | Pegar/compartir alertas ✅ | `/alertas` (varias a la vez) y Compartir → Cuadre en Android con un service worker que no guarda caché. Las alertas son provisionales: el extracto las reemplaza (monto, sentido y fecha ±1 día) y heredan su categoría |
| 5 | Facturas DIAN → **v2** | ZIP/XML → gasto enriquecido con NIT y soporte. ~3 al mes y no cambian ningún cálculo |
| 6 | Ingresos en USD (registro manual ✅); TRM y pérdida cambiaria → **v2** | Solo si el usuario conoce el monto en USD. Quien cobra un monto fijo en pesos no puede ver ni controlar la conversión |
| 7 | Categorización de gastos (IA) ✅ | Comercio nuevo → Gemini propone categoría → caché por comercio normalizado; el usuario puede corregir |
| 8 | Panel mensual y anual ✅ | Ingresos por mes y gastos por categoría (año y último mes). Comparación detallada entre meses → v2 |
| 9 | Calculadora de seguridad social ✅ | IBC (40 %, piso 1 SMMLV, techo 25), salud, pensión y ARL del último mes, con la fórmula visible. Si falta el extracto de un mes, el usuario declara el ingreso para conocer la PILA a tiempo |
| 10 | "¿Me toca declarar renta?" ✅ | Ingresos, consignaciones, compras y consumos con tarjeta de crédito del año contra sus topes en UVT, con proyección. Patrimonio bruto (`/patrimonio`): saldos de las cuentas más bienes registrados a mano, sin restar deudas y sin proyección (se mide al 31 de diciembre). Los topes sin datos se listan para revisar a mano |
| 11 | Alertas de fechas ✅ (PILA) | PILA por los dos últimos dígitos, días hábiles y festivos; calendario .ics suscribible. Renta: cuando la DIAN publique el calendario 2027 |
| 12 | Exportar y borrar ✅ | CSV para Excel (UTF-8, `;`, sin inyección de fórmulas) y JSON completo; borrar cuenta con todos los datos en cascada |
| 13 | Base de producto real | Privacidad (Ley 1581) ✅: política versionada, autorización expresa registrada, IA opcional y apagada por defecto. Botón de comentarios ✅. Sentry ✅ (solo errores y 10 % de rendimiento, sin datos personales), métricas agregadas en `analytics` ✅, PWA instalable ✅ |

## 6. Fuera de alcance v1

Extractos de la tarjeta Nu con devoluciones · facturas DIAN · TRM y pérdida cambiaria · lectura de fotos de recibos con IA · asistente RAG sobre normativa · emitir facturas electrónicas · conexión directa con bancos · generar el formulario de renta · personas jurídicas / régimen simple · otros países · importación automática desde Gmail.

## 7. Arquitectura y stack

| Capa | Elección |
|---|---|
| App | Next.js 16 (App Router), Server Actions, TypeScript estricto |
| Datos y auth | Supabase (Postgres + RLS + Auth). No se guardan archivos: los PDF se leen en el navegador |
| UI | Tailwind CSS 4 con componentes propios (`src/components/ui.tsx`); sin librería de gráficas |
| Validación | Zod en toda entrada y en toda respuesta de IA |
| Parsers | Funciones puras en `src/lib/parsers/`, probadas con fixtures sintéticos |
| Extracto PDF | pdf.js en el navegador (soporta PDF con contraseña) |
| TRM (v2) | API de datos abiertos (datos.gov.co), cacheada en `fx_rates` una vez al día. **Verificar el endpoint antes de implementarlo** |
| IA | Gemini Flash (plan gratuito) detrás de `CategoryProvider`; caché, límite diario por usuario, *fallback* "Sin categoría" |
| Recordatorios | Calendario `.ics` suscribible (Google Calendar avisa); sin correos ni cron |
| Calidad | Vitest, Playwright, GitHub Actions |
| Observabilidad | Sentry (plan gratuito) y métricas agregadas en SQL (`analytics.resumen`), sin rastreo de usuarios |
| Despliegue | Vercel Hobby |

### Modelo de datos

La fuente de verdad es `supabase/migrations/`.

- `profiles` (tipo de independiente, riesgo ARL, dígitos del NIT/cédula).
- `own_accounts` (entidad, tipo, últimos 4 dígitos, saldo y su fecha) y `own_aliases` (llaves y nombres propios).
- `movements`: `occurred_on`, `occurred_at_time`, `amount_cop`, `direction` (`in` | `out`), `kind` (`income` | `expense` | `own_transfer` | `received`), `counterparty`, `category`, `source` (`statement` | `alert` | `dian_xml` | `manual`), `dedupe_hash`, `account_last4`.
- `foreign_incomes`: `movement_id`, `received_on`, `currency`, `amount_minor`, `payer`.
- `assets`: bienes para el patrimonio (`kind`, `label`, `value_cop`).
- `merchant_categories` (caché de categoría por comercio: `user` | `ai` | `rule`) y `ai_usage` (cupo diario).
- `tax_rules` (por año, con URL de la fuente) y `pila_deadlines` (día hábil por dígitos, con su norma).
- `feedback`; el esquema `analytics` (métricas agregadas) no está expuesto por la API.
- Para la v2: `invoices` (DIAN) y `fx_rates` (TRM), todavía sin crear.

**Regla:** los valores fiscales nunca van en el código; viven en `tax_rules` y se verifican contra DIAN / UGPP / MinSalud antes de publicarse.

## 8. Métricas de éxito

Usuarios activos al mes · retención del mes 2 · % de movimientos que entran por extracto o alerta (frente a manual) · % categorizado por caché frente a IA · costo de IA por usuario (meta: $0).

## 9. Plan

| Semana | Entregable |
|---|---|
| **0** ✅ | Revisión del correo, hallazgos (sección 3), proyecto Next.js, parser de alertas con tests |
| **1** ✅ | Supabase (esquema + RLS), autenticación, onboarding con cuentas propias, ingreso manual en USD, despliegue en Vercel |
| **2** ✅ | Importar extracto PDF en el navegador, transferencias propias, ingresos en COP, seguridad social y renta (adelantados de la semana 4) |
| **3** ✅ | Categorización con reglas + Gemini, panel. (Facturas DIAN y TRM → v2) |
| **4** ✅ | Exportar/borrar, privacidad, CI con e2e (Playwright + Supabase local), recordatorios de PILA, comentarios, Sentry, métricas, PWA instalable, ajustes para celular, alertas pegadas y compartidas, README con capturas |
| **4b** ✅ | Con los datos reales del autor: extractos de Nequi, Cuenta Nu y tarjeta Nu, meses sin extracto, recibido de personas sin clasificar, ingreso declarado de un mes sin extracto, patrimonio, compras y tarjeta en renta |
| **5** | **Lanzamiento a 10-20 personas** y decidir la v2 con sus comentarios. Pendiente de terceros: fechas de renta 2027 cuando la DIAN publique el calendario |

## 10. Riesgos

| Riesgo | Mitigación |
|---|---|
| Bancolombia cambia el formato de alertas o extractos | Parsers aislados con fixtures; si fallan, el usuario ve el texto no reconocido y puede registrarlo a mano |
| Doble conteo entre alertas, extracto y facturas | Conciliación con reglas explícitas y tests |
| Transferencias propias infladas como ingreso o gasto | Cuentas propias en el onboarding + marcado `own_transfer` |
| Cálculo tributario incorrecto | Reglas en datos con su fuente, tests, aviso de orientación |
| Tratamiento fiscal de ingresos en USD | Verificarlo en la norma antes del semáforo; mostrar la tasa usada |
| Cuota gratuita de Gemini | Caché por comercio, límite diario, *fallback* sin IA |
