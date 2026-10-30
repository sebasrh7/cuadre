/** Cambia cuando cambie la política: los usuarios deben aceptarla de nuevo. */
export const PRIVACY_VERSION = "3";
/** Desde cuándo rige la versión actual. */
export const PRIVACY_EFFECTIVE_DATE = "2026-10-30";

/**
 * Identificación del responsable que exige el Decreto 1377 de 2013, art. 13:
 * nombre, domicilio, dirección, correo y teléfono. La define quien opera la app.
 */
export function privacyContact() {
  return {
    controller: process.env.PRIVACY_CONTROLLER_NAME || null,
    city: process.env.PRIVACY_CONTROLLER_CITY || null,
    address: process.env.PRIVACY_CONTROLLER_ADDRESS || null,
    phone: process.env.PRIVACY_CONTROLLER_PHONE || null,
    email: process.env.PRIVACY_CONTACT_EMAIL || null,
  };
}
