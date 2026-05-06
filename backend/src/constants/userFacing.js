/**
 * Mensajes mostrados al usuario final (WhatsApp / panel).
 * No exponer detalles técnicos (stack, selectores, JDBC, etc.).
 */

/** Fallo genérico ante errores de API, scraping o pasos intermedios. */
const ACTION_FAILED =
  '❌ No se pudo completar esta acción. Por favor intentá de nuevo en unos minutos.';

module.exports = {
  ACTION_FAILED
};
