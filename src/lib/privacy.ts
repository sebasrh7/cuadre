/** Cambia cuando cambie la política: los usuarios deben aceptarla de nuevo. */
export const PRIVACY_VERSION = "2026-10-28";

/** Responsable y canal de contacto (Ley 1581): los define quien opera la app. */
export function privacyContact() {
  return {
    controller: process.env.PRIVACY_CONTROLLER_NAME || null,
    email: process.env.PRIVACY_CONTACT_EMAIL || null,
  };
}
