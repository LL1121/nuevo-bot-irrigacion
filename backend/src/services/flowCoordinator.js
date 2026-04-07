'use strict';

/**
 * FlowCoordinator — Coordinador de WhatsApp Dynamic Flows
 *
 * Estrategia: ganarle al timeout de 3 s de Meta iniciando el pre-fetch de
 * datos de deuda EN EL MOMENTO en que el usuario toca la opción en el menú,
 * antes de que el Flow haya siquiera abierto.  Cuando Meta llame al endpoint
 * de Data Exchange el resultado ya está en memoria → respuesta < 100 ms.
 *
 * Estructura de cada entrada en caché:
 * {
 *   status : 'pending' | 'ready' | 'error',
 *   data   : Object | null,       // resultado de la API cuando status='ready'
 *   error  : string | null,       // mensaje de error cuando status='error'
 *   userMessage: string | null,   // texto amigable para mostrarle al usuario
 *   createdAt : number,           // Date.now() al crear la entrada
 *   resolvedAt: number | null,    // Date.now() al resolver (ready/error)
 * }
 */

const debtApiService     = require('./debtApiService');
const debtScraperService = require('./debtScraperService');
const clienteService     = require('./clienteService');
const logger             = require('./logService');

// ─── Configuración ────────────────────────────────────────────────────────────

const TTL_MS           = 5 * 60 * 1000;  // 5 minutos
const CLEANUP_INTERVAL = 60 * 1000;      // limpiar entradas expiradas cada 1 min
const PREFIX           = '[FlowCoordinator]';

// ─── Cache en memoria ─────────────────────────────────────────────────────────

/** @type {Map<string, Object>} */
const prefetchCache = new Map();

// ─── Limpieza periódica de entradas expiradas ─────────────────────────────────

const cleanupExpired = () => {
  const now = Date.now();
  let removed = 0;
  for (const [key, entry] of prefetchCache) {
    if (now - entry.createdAt > TTL_MS) {
      prefetchCache.delete(key);
      removed++;
    }
  }
  if (removed > 0) {
    logger.debug(`${PREFIX} Limpieza: ${removed} entradas expiradas eliminadas`);
  }
};

const cleanupTimer = setInterval(cleanupExpired, CLEANUP_INTERVAL);
// Evitar que el timer impida que el proceso cierre limpiamente
cleanupTimer.unref();

// ─── Helpers internos ─────────────────────────────────────────────────────────

/**
 * Construye la cache key para un teléfono + tipo de consulta.
 * Separar por tipo permite tener deuda superficial y subterránea en caché
 * simultáneamente para el mismo usuario.
 *
 * @param {string} telefono
 * @param {string} tipo
 */
const buildKey = (telefono, tipo) => `${telefono}::${tipo}`;

/**
 * Ejecuta la consulta real a la API/scraper según el tipo de padrón.
 * Sigue la misma lógica y fallback que usa webhookController:
 *   - superficial → API directa, si falla → scraper
 *   - resto        → scraper directamente
 *
 * @param {string} telefono
 * @param {Object} cliente  - Fila completa de clientes en BD
 * @returns {Promise<Object>} Resultado normalizado { success, data?, error?, userMessage? }
 */
const ejecutarConsultaDeuda = async (telefono, cliente) => {
  const tipo = cliente.tipo_consulta_preferido || null;

  // ── DNI / CUIT ──────────────────────────────────────────────────────────────
  if (!tipo && cliente.padron) {
    logger.info(`${PREFIX} [${telefono}] Pre-fetch por DNI: ${cliente.padron}`);
    return debtScraperService.obtenerDeudaDni(cliente.padron);
  }

  // ── Padrón superficial ──────────────────────────────────────────────────────
  if (tipo === 'superficial' && cliente.padron_superficial) {
    const [codigoCauce, numeroPadron] = String(cliente.padron_superficial).split(' ');
    const datos = { codigoCauce, numeroPadron };
    logger.info(`${PREFIX} [${telefono}] Pre-fetch superficial: ${cliente.padron_superficial}`);

    const resultadoApi = await debtApiService.obtenerDeudaPadronSuperficial(datos);
    if (resultadoApi.success) return resultadoApi;

    logger.warn(`${PREFIX} [${telefono}] API superficial falló, activando fallback scraper`);
    return debtScraperService.obtenerDeudaPadron('superficial', datos, 'deuda');
  }

  // ── Padrón subterráneo ──────────────────────────────────────────────────────
  if (tipo === 'subterraneo' && cliente.padron_subterraneo) {
    const [codigoDepartamento, numeroPozo] = String(cliente.padron_subterraneo).split(' ');
    const datos = { codigoDepartamento, numeroPozo };
    logger.info(`${PREFIX} [${telefono}] Pre-fetch subterráneo: ${cliente.padron_subterraneo}`);
    return debtScraperService.obtenerDeudaPadron('subterraneo', datos, 'deuda');
  }

  // ── Padrón contaminación ────────────────────────────────────────────────────
  if (tipo === 'contaminacion' && cliente.padron_contaminacion) {
    const datos = { numeroContaminacion: cliente.padron_contaminacion };
    logger.info(`${PREFIX} [${telefono}] Pre-fetch contaminación: ${cliente.padron_contaminacion}`);
    return debtScraperService.obtenerDeudaPadron('contaminacion', datos, 'deuda');
  }

  // Sin datos suficientes para pre-fetchear
  return {
    success: false,
    error: 'sin_datos',
    userMessage: 'No encontramos un DNI o padrón guardado. Deberás ingresarlo manualmente.',
  };
};

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Inicia el pre-fetch de deuda para un usuario en segundo plano.
 * NO bloquea: registra la entrada como 'pending' y lanza la consulta async.
 *
 * @param {string} telefono - Número en formato internacional (ej: 5492614666411)
 * @returns {void}
 */
const preFetchDebt = (telefono) => {
  (async () => {
    let tipo = 'dni'; // fallback mientras no tengamos el cliente

    try {
      const cliente = await clienteService.obtenerCliente(telefono);

      if (!cliente) {
        logger.warn(`${PREFIX} [${telefono}] Pre-fetch cancelado: cliente no encontrado en BD`);
        return;
      }

      tipo = cliente.tipo_consulta_preferido || 'dni';
      const key = buildKey(telefono, tipo);

      // Evitar duplicar si ya hay un pre-fetch en curso o reciente
      const existing = prefetchCache.get(key);
      if (existing && Date.now() - existing.createdAt < TTL_MS) {
        logger.debug(`${PREFIX} [${telefono}] Pre-fetch ya en caché (${existing.status}), omitiendo`);
        return;
      }

      // Marcar como pendiente
      prefetchCache.set(key, {
        status     : 'pending',
        data       : null,
        error      : null,
        userMessage: null,
        createdAt  : Date.now(),
        resolvedAt : null,
      });

      logger.info(`${PREFIX} [${telefono}] Pre-fetch iniciado (tipo: ${tipo})`);

      const resultado = await ejecutarConsultaDeuda(telefono, cliente);

      if (resultado.success) {
        prefetchCache.set(key, {
          status     : 'ready',
          data       : resultado.data || resultado,
          error      : null,
          userMessage: null,
          createdAt  : prefetchCache.get(key)?.createdAt ?? Date.now(),
          resolvedAt : Date.now(),
        });
        logger.info(`${PREFIX} [${telefono}] Pre-fetch completado OK (tipo: ${tipo})`);
      } else {
        const errorMsg = resultado.error || 'consulta_fallida';
        const userMsg  = resultado.userMessage
          || 'No pudimos consultar tu deuda en este momento. Intentá nuevamente en unos minutos.';

        prefetchCache.set(key, {
          status     : 'error',
          data       : null,
          error      : errorMsg,
          userMessage: userMsg,
          createdAt  : prefetchCache.get(key)?.createdAt ?? Date.now(),
          resolvedAt : Date.now(),
        });

        logger.error(`${PREFIX} [${telefono}] Pre-fetch falló (tipo: ${tipo}): ${errorMsg}`);
      }

    } catch (err) {
      const key = buildKey(telefono, tipo);

      prefetchCache.set(key, {
        status     : 'error',
        data       : null,
        error      : err.message,
        userMessage: 'Hubo un error inesperado al consultar tu deuda. Por favor intentá más tarde.',
        createdAt  : prefetchCache.get(key)?.createdAt ?? Date.now(),
        resolvedAt : Date.now(),
      });

      logger.error(`${PREFIX} [${telefono}] Error inesperado en pre-fetch: ${err.message}`, {
        stack: err.stack,
      });
    }
  })();
};

/**
 * Recupera los datos pre-fetcheados desde el caché.
 * Llamado desde el endpoint de Data Exchange (Fase 3) cuando Meta solicita datos.
 *
 * @param {string} telefono
 * @param {string} [tipo='dni']
 * @returns {{ status: string, data?: Object, error?: string, userMessage?: string } | null}
 *   null si no hay entrada en caché (no se inició pre-fetch o ya expiró)
 */
const getPrefetchedData = (telefono, tipo = 'dni') => {
  const key   = buildKey(telefono, tipo);
  const entry = prefetchCache.get(key);

  if (!entry) {
    logger.debug(`${PREFIX} [${telefono}] Cache miss (tipo: ${tipo})`);
    return null;
  }

  if (Date.now() - entry.createdAt > TTL_MS) {
    prefetchCache.delete(key);
    logger.debug(`${PREFIX} [${telefono}] Entrada expirada eliminada (tipo: ${tipo})`);
    return null;
  }

  logger.debug(`${PREFIX} [${telefono}] Cache hit — status: ${entry.status} (tipo: ${tipo})`);
  return entry;
};

/**
 * Elimina manualmente la entrada de un usuario del caché.
 * Útil cuando el usuario reinicia el flujo o cambia de DNI/padrón.
 *
 * @param {string} telefono
 * @param {string} [tipo='dni']
 */
const invalidateCache = (telefono, tipo = 'dni') => {
  const key     = buildKey(telefono, tipo);
  const deleted = prefetchCache.delete(key);
  if (deleted) {
    logger.debug(`${PREFIX} [${telefono}] Entrada invalidada manualmente (tipo: ${tipo})`);
  }
};

/**
 * Devuelve el tamaño actual del caché (útil para métricas/health check).
 * @returns {number}
 */
const cacheSize = () => prefetchCache.size;

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  preFetchDebt,
  getPrefetchedData,
  invalidateCache,
  cacheSize,
};
