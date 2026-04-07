'use strict';

/**
 * flowController.js — Data Exchange Endpoint para WhatsApp Dynamic Flows
 *
 * Meta llama a este endpoint con el cuerpo cifrado AES-128-GCM + RSA OAEP.
 * El handler:
 *   1. Detecta health-checks (sin campos cifrados o action='ping')
 *   2. Descifra la request con flowCrypto.decryptRequest
 *   3. Para INIT / DATA_EXCHANGE espera hasta 1.5 s el pre-fetch de deuda
 *   4. Construye la respuesta y la cifra con flowCrypto.encryptResponse
 *
 * Constraint crítico: toda la operación debe completarse en < 3 000 ms
 * (límite de Meta para Flows Data Exchange).
 */

const flowCrypto      = require('../utils/flowCrypto');
const flowCoordinator = require('../services/flowCoordinator');
const logger          = require('../services/logService');

const PREFIX          = '[FlowController]';
const POLL_INTERVAL_MS = 100;   // intervalo entre checkeos del caché
const POLL_TIMEOUT_MS  = 1500;  // max espera al pre-fetch → deja ~1.5 s para cifrar + red

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Formatea un número como pesos argentinos: $12.500,00
 * Recibe number | string | null | undefined.
 */
const formatArs = (value) => {
  const num = Number(value);
  if (isNaN(num)) return '$0,00';
  return '$' + num.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

/**
 * Lee FLOWS_PRIVATE_KEY desde env y convierte escapes \n → salto de línea real.
 * Soporta opcionalmente FLOWS_PRIVATE_KEY_PASSPHRASE.
 */
const getPrivateKey = () => {
  const raw = process.env.FLOWS_PRIVATE_KEY || '';
  return raw.replace(/\\n/g, '\n');
};

/**
 * Construye el payload de error que se devuelve (cifrado) al Flow de Meta.
 * El screen actual recibe `error: true` y un mensaje legible para el usuario.
 */
const buildErrorPayload = (version, screen, userMessage) => ({
  version,
  screen,
  data: {
    error: true,
    error_message: userMessage || 'Algo salió mal. Por favor intentá de nuevo.',
  },
});

/**
 * Polling asíncrono sobre el caché del FlowCoordinator.
 * Resuelve en cuanto el status deja de ser 'pending', o al agotar POLL_TIMEOUT_MS.
 *
 * @param {string} telefono
 * @returns {Promise<Object|null>}
 */
const waitForCache = (telefono) =>
  new Promise((resolve) => {
    const deadline = Date.now() + POLL_TIMEOUT_MS;

    const tick = () => {
      const entry = flowCoordinator.getAnyPrefetchedData(telefono);

      if (entry && entry.status !== 'pending') return resolve(entry);
      if (Date.now() >= deadline)              return resolve(entry ?? null);

      setTimeout(tick, POLL_INTERVAL_MS);
    };

    tick();
  });

// ─── Controlador principal ────────────────────────────────────────────────────

/**
 * POST /webhook/flows/exchange
 *
 * Endpoint de Data Exchange configurado en el panel de Meta para el Flow.
 * Meta también envía health-checks periódicos a esta URL:
 *   - Sin campos cifrados (body vacío o incompleto)  → { data: { status: 'active' } }
 *   - Con action='ping' (body cifrado)               → idem, cifrado
 */
const handleDataExchange = async (req, res) => {
  const { encrypted_flow_data, encrypted_aes_key, initial_vector } = req.body || {};

  // ── 1. Health-check sin cifrado ───────────────────────────────────────────
  if (!encrypted_flow_data || !encrypted_aes_key || !initial_vector) {
    logger.info(`${PREFIX} Health-check recibido (sin campos cifrados)`);
    return res.status(200).json({ data: { status: 'active' } });
  }

  // ── 2. Descifrado ─────────────────────────────────────────────────────────
  let decryptedBody, aesKey, iv;

  try {
    const privateKeyPem = getPrivateKey();

    if (!privateKeyPem) {
      logger.error(`${PREFIX} FLOWS_PRIVATE_KEY no está configurada en .env`);
      return res.status(500).json({ error: 'Flows private key not configured' });
    }

    const passphrase = process.env.FLOWS_PRIVATE_KEY_PASSPHRASE || undefined;

    ({ decryptedBody, aesKey, iv } = flowCrypto.decryptRequest(
      req.body,
      privateKeyPem,
      passphrase,
    ));
  } catch (err) {
    logger.error(`${PREFIX} Fallo en descifrado: ${err.message}`);
    // 421 = código que Meta espera ante errores de descifrado (activa re-key)
    return res.status(421).json({ error: 'Decryption failed' });
  }

  const {
    action,
    flow_token: senderPhone,
    screen   = 'SPLASH',
    version  = '3.0',
  } = decryptedBody;

  logger.info(`${PREFIX} [${senderPhone}] action=${action} screen=${screen}`);

  // ── 3. Health-check cifrado (action = 'ping') ─────────────────────────────
  if (action === 'ping') {
    logger.info(`${PREFIX} [${senderPhone}] Ping cifrado → respondiendo active`);
    const encrypted = flowCrypto.encryptResponse(
      { version, data: { status: 'active' } },
      aesKey,
      iv,
    );
    return res.status(200).json(encrypted);
  }

  // ── 4. Requests sin teléfono real (testing de Meta, tokens de prueba) ─────
  if (!senderPhone || senderPhone === 'HEALTH_CHECK' || senderPhone === 'test') {
    logger.info(`${PREFIX} Request sin teléfono real (flow_token='${senderPhone}'), respondiendo active`);
    const encrypted = flowCrypto.encryptResponse(
      { version, data: { status: 'active' } },
      aesKey,
      iv,
    );
    return res.status(200).json(encrypted);
  }

  // ── 5. Obtener datos de deuda (INIT / DATA_EXCHANGE) ─────────────────────
  let responsePayload;

  try {
    if (action === 'INIT' || action === 'DATA_EXCHANGE') {

      let cacheEntry = flowCoordinator.getAnyPrefetchedData(senderPhone);

      // Si el pre-fetch no arrancó todavía, lanzarlo ahora (caso borde: usuario
      // llegó al Flow sin haber pasado por el menú principal)
      if (!cacheEntry) {
        logger.warn(`${PREFIX} [${senderPhone}] Sin pre-fetch previo — lanzando consulta de emergencia`);
        flowCoordinator.preFetchDebt(senderPhone);
      }

      // Polling: esperar hasta 1.5 s a que el pre-fetch resuelva
      if (!cacheEntry || cacheEntry.status === 'pending') {
        cacheEntry = await waitForCache(senderPhone);
      }

      if (!cacheEntry || cacheEntry.status === 'pending') {
        // Timeout agotado antes de obtener datos
        logger.error(`${PREFIX} [${senderPhone}] Timeout esperando pre-fetch de deuda`);
        responsePayload = buildErrorPayload(
          version,
          screen,
          'La consulta está tardando más de lo esperado. Por favor intentá en unos minutos.',
        );

      } else if (cacheEntry.status === 'error') {
        logger.warn(`${PREFIX} [${senderPhone}] Pre-fetch con error: ${cacheEntry.error}`);
        responsePayload = buildErrorPayload(version, screen, cacheEntry.userMessage);

      } else {
        // status = 'ready'
        const resolvedMs = cacheEntry.resolvedAt
          ? cacheEntry.resolvedAt - cacheEntry.createdAt
          : '?';
        logger.info(`${PREFIX} [${senderPhone}] Datos listos (prefetch tardó ${resolvedMs} ms)`);

        // Mapear campos del servicio → nombres que espera el Flow JSON:
        //   total    → total  (mismo nombre)
        //   linkPago → link_pago (camelCase → snake_case)
        const raw = cacheEntry.data || {};
        const flowData = {
          titular:    String(raw.titular    ?? 'No disponible'),
          cuit:       String(raw.cuit       ?? 'No disponible'),
          hectareas:  String(raw.hectareas  ?? 'No disponible'),
          hijuela:    String(raw.hijuela    ?? 'No disponible'),
          capital:    formatArs(raw.capital),
          interes:    formatArs(raw.interes),
          apremio:    formatArs(raw.apremio),
          eventuales: formatArs(raw.eventuales),
          total:      formatArs(raw.total),
          link_pago:  String(raw.linkPago   ?? raw.link_pago ?? ''),
        };

        responsePayload = {
          version,
          screen: 'RESULTS',
          data: flowData,
        };
      }

    } else {
      // Acciones de navegación (BACK, COMPLETE, etc.) — sin datos adicionales
      logger.info(`${PREFIX} [${senderPhone}] Acción de navegación '${action}' → data vacía`);
      responsePayload = { version, screen, data: {} };
    }

  } catch (err) {
    logger.error(`${PREFIX} [${senderPhone}] Error inesperado: ${err.message}`, { stack: err.stack });
    responsePayload = buildErrorPayload(
      version,
      screen,
      'Ocurrió un error inesperado. Por favor intentá de nuevo.',
    );
  }

  // ── 6. Cifrar y enviar respuesta ──────────────────────────────────────────
  try {
    const encrypted = flowCrypto.encryptResponse(responsePayload, aesKey, iv);
    return res.status(200).json(encrypted);
  } catch (err) {
    logger.error(`${PREFIX} [${senderPhone}] Error al cifrar la respuesta: ${err.message}`);
    return res.status(500).json({ error: 'Encryption of response failed' });
  }
};

module.exports = { handleDataExchange };
