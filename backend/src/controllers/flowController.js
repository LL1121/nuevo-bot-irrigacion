'use strict';

/**
 * flowController.js — Data Exchange Endpoint para WhatsApp Dynamic Flows
 *
 * Meta llama a este endpoint con el cuerpo cifrado AES-128-GCM + RSA OAEP.
 * El handler implementa el ping-pong de cuatro pantallas:
 *   INIT               → SAVED_DNI o CHOOSE_TYPE (según si el usuario tiene DNI guardado)
 *   DATA_EXCHANGE paso=0 → SAVED_DNI: «usar_guardado» → RESULTS / «usar_otro» → CHOOSE_TYPE
 *   DATA_EXCHANGE paso=1 → INPUT_NUMBER (labels dinámicos según DNI/Padrón)
 *   DATA_EXCHANGE paso=2 → RESULTS     (consulta real a BD vía preFetchDebtManual)
 *
 *   1. Detecta health-checks (sin campos cifrados o action='ping')
 *   2. Descifra la request con flowCrypto.decryptRequest
 *   3. Enruta por acción + paso; solo paso=2 realiza polling de caché
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
 * Mapea los campos crudos del servicio de deuda al objeto `data` que espera
 * la pantalla RESULTS del Flow JSON.
 */
const buildResultsData = (raw) => ({
  titular:    String(raw.titular    ?? 'No disponible'),
  cuit:       String(raw.cuit       ?? 'No disponible'),
  hectareas:  String(raw.hectareas  ?? 'No disponible'),
  hijuela:    String(raw.hijuela    ?? 'No disponible'),
  capital:    formatArs(raw.capital),
  interes:    formatArs(raw.interes),
  apremio:    formatArs(raw.apremio),
  eventuales: formatArs(raw.eventuales),
  total:      formatArs(raw.total),
  link_pago:  String(raw.linkPago ?? raw.link_pago ?? ''),
});

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
    return res.type('text/plain').send(encrypted);
  }

  // ── 4. Requests sin teléfono real (testing de Meta, tokens de prueba) ─────
  if (!senderPhone || senderPhone === 'HEALTH_CHECK' || senderPhone === 'test') {
    logger.info(`${PREFIX} Request sin teléfono real (flow_token='${senderPhone}'), respondiendo active`);
    const encrypted = flowCrypto.encryptResponse(
      { version, data: { status: 'active' } },
      aesKey,
      iv,
    );
    return res.type('text/plain').send(encrypted);
  }

  // ── 5. Lógica ping-pong del Flow (INIT → paso 1 → paso 2 → RESULTS) ────────
  let responsePayload;

  const flowPayload  = decryptedBody.data || decryptedBody.payload || {};
  const paso         = flowPayload.paso          || null;
  const tipoConsulta = flowPayload.tipo_consulta || null;
  const inputValor   = flowPayload.input_valor   || null;

  try {
    if (action === 'INIT') {
      // Primera apertura del Flow: sin data dinámica, va a CHOOSE_TYPE por defecto.
      // Si el Flow JSON tiene SAVED_DNI como primera pantalla, Meta la muestra directamente
      // y el endpoint recibirá paso=0 cuando el usuario interactúe.
      logger.info(`${PREFIX} [${senderPhone}] INIT → enviando CHOOSE_TYPE`);
      responsePayload = { version, screen: 'CHOOSE_TYPE', data: {} };

    } else if (action === 'DATA_EXCHANGE' && paso === '0') {
      // ── paso 0: el usuario viene de la pantalla SAVED_DNI ─────────────────
      const decision = flowPayload.decision || null;
      logger.info(`${PREFIX} [${senderPhone}] paso=0 decision=${decision} valor=${inputValor}`);

      if (decision === 'usar_otro') {
        // El usuario quiere ingresar un DNI/padrón diferente → volver a elegir tipo
        responsePayload = { version, screen: 'CHOOSE_TYPE', data: {} };

      } else {
        // 'usar_guardado' (o cualquier otro valor): consultar con el valor guardado
        if (!inputValor) {
          logger.warn(`${PREFIX} [${senderPhone}] paso=0 usar_guardado sin input_valor`);
          responsePayload = buildErrorPayload(
            version, screen,
            'No se encontró el valor guardado. Por favor ingresá tus datos manualmente.',
          );
        } else {
          flowCoordinator.preFetchDebtManual(senderPhone, 'dni', inputValor);
          const cacheEntry = await waitForCache(senderPhone);

          if (!cacheEntry || cacheEntry.status === 'pending') {
            logger.error(`${PREFIX} [${senderPhone}] paso=0 timeout esperando deuda`);
            responsePayload = buildErrorPayload(
              version, screen,
              'La consulta está tardando más de lo esperado. Por favor intentá en unos minutos.',
            );
          } else if (cacheEntry.status === 'error') {
            logger.warn(`${PREFIX} [${senderPhone}] paso=0 error: ${cacheEntry.error}`);
            responsePayload = buildErrorPayload(version, screen, cacheEntry.userMessage);
          } else {
            const raw = cacheEntry.data || {};
            logger.info(`${PREFIX} [${senderPhone}] paso=0 datos listos → RESULTS`);
            responsePayload = {
              version,
              screen: 'RESULTS',
              data: buildResultsData(raw),
            };
          }
        }
      }

    } else if (action === 'DATA_EXCHANGE' && paso === '1') {
      // El usuario eligió DNI o Padrón → navegar a INPUT_NUMBER con labels dinámicos.
      const isDni = (tipoConsulta === 'dni');
      logger.info(`${PREFIX} [${senderPhone}] paso=1 tipo=${tipoConsulta} → enviando INPUT_NUMBER`);
      responsePayload = {
        version,
        screen: 'INPUT_NUMBER',
        data: {
          tipo_elegido:    tipoConsulta,
          label_dinamico:  isDni ? 'Ingresá tu DNI'                          : 'Ingresá tu padrón',
          helper_dinamico: isDni ? 'Sin puntos ni guiones (ej: 28456123)' : 'Solo números (ej: 12345)',
        },
      };

    } else if (action === 'DATA_EXCHANGE' && paso === '2') {
      // El usuario ingresó el número → consultar deuda real y devolver RESULTS.
      if (!tipoConsulta || !inputValor) {
        logger.warn(`${PREFIX} [${senderPhone}] paso=2 sin tipo_consulta o input_valor`);
        responsePayload = buildErrorPayload(
          version, screen,
          'Datos incompletos. Por favor completá todos los campos.',
        );
      } else {
        logger.info(`${PREFIX} [${senderPhone}] paso=2 tipo=${tipoConsulta} valor=${inputValor} → consultando deuda`);
        flowCoordinator.preFetchDebtManual(senderPhone, tipoConsulta, inputValor);

        const cacheEntry = await waitForCache(senderPhone);

        if (!cacheEntry || cacheEntry.status === 'pending') {
          logger.error(`${PREFIX} [${senderPhone}] Timeout esperando pre-fetch de deuda`);
          responsePayload = buildErrorPayload(
            version, screen,
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

          const raw = cacheEntry.data || {};
          responsePayload = {
            version,
            screen: 'RESULTS',
            data: buildResultsData(raw),
          };
        }
      }

    } else {
      // Otras acciones (BACK, COMPLETE, etc.) — sin datos adicionales
      logger.info(`${PREFIX} [${senderPhone}] Acción '${action}' / paso '${paso}' → data vacía`);
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
    return res.type('text/plain').send(encrypted);
  } catch (err) {
    logger.error(`${PREFIX} [${senderPhone}] Error al cifrar la respuesta: ${err.message}`);
    return res.status(500).json({ error: 'Encryption of response failed' });
  }
};

module.exports = { handleDataExchange };
