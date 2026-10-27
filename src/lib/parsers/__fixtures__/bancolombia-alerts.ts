/**
 * Alertas SINTÉTICAS de Bancolombia.
 *
 * La estructura de cada plantilla se copió de correos reales (revisión del 2026-10-27),
 * pero todos los nombres, llaves, cuentas, tarjetas, comercios y montos son inventados.
 * Nunca agregues aquí texto real sin anonimizarlo.
 */

/** Cuerpo de correo completo, con el texto pegado sin espacios como llega en texto plano. */
export const cardPurchaseFullEmail = `Logo Bancolombia [https://example.com/header-logo.png]yellow-icon [https://example.com/chulo.png]
¡Listo!Todo salió bien con tus movimientosBancolombia: Compraste $80.000,00 en
ESTACION DE SERVICIO con tu T.Deb *1111, el 17/07/2026 a las 18:15. Si tienes
dudas, encuentranos aqui: 6045109095 o 018000931987. Estamos cerca.
Controla tu dinero y gestiona tus gastos. Usa Día a Día en la app Bancolombia.`;

export const cardPurchaseSnippet =
  "¡Listo! Todo salió bien con tus movimientos Bancolombia: Compraste $10.850,00 en TIENDA EJEMPLO CENTRO con tu T.Deb *1111, el 16/10/2026 a las 20:17. Si tienes dudas, encuentranos aqui: 6045109095 o";

/** Monto con coma de miles y punto decimal; año de 2 dígitos. */
export const transferOutKeyCommaThousands = `¡Listo! Todo salió bien con tus movimientos Bancolombia: ANDRES, transferiste
$500,000.00 a la llave @andres001 desde tu cuenta *2222 a Andres Prueba Ejemplo
el 03/07/26 a las 18:37. Con Bre-b es de una y gratis. Dudas al 018000912345.`;

/** Monto sin separador de miles; llave numérica. */
export const transferOutKeyNoSeparator =
  "¡Listo! Todo salió bien con tus movimientos Bancolombia: ANDRES, transferiste $75000.00 a la llave 3001234567 desde tu cuenta *2222 a Laura Gómez Pérez el 01/10/26 a las 18:03. Con Bre-b es de una y gratis.";

/** Monto con coma de miles y sin decimales. */
export const transferOutAccount =
  "¡Listo!Todo salió bien con tus movimientosBancolombia: Transferiste $55,000 desde tu cuenta *2222 a la cuenta *12345678901 el 03/07/2026 a las 21:00. ¿Dudas? Llamanos al 018000931987. Estamos cerca.";

export const transferIn =
  "¡Listo! Todo salió bien con tus movimientos Bancolombia: Andres, recibiste una transferencia de JUAN PEREZ RAMIREZ por $223200.00 en tu cuenta *2222 conectada a la llave @ANDRES002 el 03/10/26 a las 18:58.";

/** La llave llega en mayúsculas aunque el usuario la registró en minúsculas, y sin hora. */
export const transferInFromSelfNoTime =
  "¡Listo! Todo salió bien con tus movimientos Bancolombia: Andres, recibiste una transferencia de ANDRÉS PRUEBA EJEMPLO por $150000.00 en tu cuenta *2222 conectada a la llave @ANDRES002 el 05/06/26";

export const unrelatedBankEmail =
  "Actualizamos el Reglamento de tu Cuenta de Ahorros. Conoce los cambios en www.bancolombia.com.";
