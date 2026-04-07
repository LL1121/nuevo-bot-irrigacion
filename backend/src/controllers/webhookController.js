const whatsappService = require('../services/whatsappService');
const debtScraperService = require('../services/debtScraperService');
const debtApiService = require('../services/debtApiService');
const flowCoordinator = require('../services/flowCoordinator');
const turnadoScraperService = require('../services/turnadoScraperService');
const turnadoApiService = require('../services/turnadoApiService');
const mensajeService = require('../services/mensajeService');
const clienteService = require('../services/clienteService');
const { compressPdfForFrontend } = require('../services/pdfCompressionService');
const fs = require('fs');
const path = require('path');

const BOLETOS_PUBLIC_DIR = path.join(__dirname, '../../public/uploads/boletos');
const BOLETOS_RETENTION_HOURS = Number(process.env.BOLETOS_RETENTION_HOURS || 24);
const BOLETOS_PREVIEW_PDFSETTINGS = process.env.BOLETOS_PREVIEW_PDFSETTINGS || 'ebook';
const TURNOS_CONTACTO_INSPECCION_DEFAULT = process.env.TURNOS_CONTACTO_INSPECCION || 'inspeccioncanadacolorada@gmail.com';
const TURNOS_CONTACTOS_POR_INSPECCION = {
  'canada colorada': process.env.TURNOS_CONTACTO_INSPECCION_CANADA_COLORADA || TURNOS_CONTACTO_INSPECCION_DEFAULT,
  'cañada colorada': process.env.TURNOS_CONTACTO_INSPECCION_CANADA_COLORADA || TURNOS_CONTACTO_INSPECCION_DEFAULT
};
const INVALID_PROFILE_NAMES = new Set([
  '',
  '.',
  '..',
  '...',
  '-',
  '--',
  '_',
  '__',
  'sin nombre',
  'no name',
  'unknown',
  'anonimo',
  'anónimo',
  'ninguno',
  'n/a'
]);

const normalizePersonName = (value = '') => String(value || '').replace(/\s+/g, ' ').trim();

const formatPersonName = (value = '') => {
  const normalized = normalizePersonName(value).toLowerCase();
  if (!normalized) return '';

  return normalized
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const normalizeSingleLine = (value = '') => String(value || '').replace(/\s+/g, ' ').trim();

const stripListSelectionDescription = (title = '', description = '') => {
  let cleanTitle = normalizeSingleLine(String(title || '').split('\n')[0]);
  const cleanDescription = normalizeSingleLine(description);

  if (!cleanTitle) return '';
  if (!cleanDescription) return cleanTitle;

  const titleLower = cleanTitle.toLowerCase();
  const descriptionLower = cleanDescription.toLowerCase();
  if (titleLower.endsWith(descriptionLower)) {
    cleanTitle = cleanTitle.slice(0, cleanTitle.length - cleanDescription.length).replace(/[\s\-–—:|]+$/, '').trim();
  }

  return cleanTitle;
};

const isLikelyValidPersonName = (value = '') => {
  const normalized = normalizePersonName(value);
  if (!normalized) return false;

  const lowered = normalized.toLowerCase();
  if (INVALID_PROFILE_NAMES.has(lowered)) return false;

  if (normalized.length < 2 || normalized.length > 60) return false;
  if (!/[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(normalized)) return false;

  const lettersOnly = normalized.replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñ]/g, '');
  if (lettersOnly.length < 2) return false;

  return true;
};

const NAME_STOPWORDS = new Set([
  'yo',
  'me',
  'mi',
  'mio',
  'mía',
  'llamo',
  'llamo,',
  'nombre',
  'es',
  'soy',
  'hola',
  'buenas',
  'mucho',
  'gusto'
]);

const extractLikelyNameFromInput = (value = '') => {
  const raw = normalizePersonName(value);
  if (!raw) return '';

  let candidate = raw
    .replace(/^(hola|buenas|buenos dias|buen día|buen dia|buenas tardes|buenas noches)[,!\s]*/i, '')
    .replace(/^(me\s+llamo|mi\s+nombre\s+es|soy|nombre\s*[:\-]?|yo\s+soy)\s+/i, '')
    .replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñ\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!candidate) return '';

  const words = candidate
    .split(' ')
    .map((w) => w.trim())
    .filter(Boolean)
    .filter((w) => !NAME_STOPWORDS.has(w.toLowerCase()));

  if (!words.length) return '';

  // Tomamos hasta 3 tokens para evitar capturar frases largas.
  const compact = words.slice(0, 3).join(' ');
  return formatPersonName(compact);
};

const getServiceErrorMessage = (payload, fallbackMessage = '') => {
  if (!payload) return fallbackMessage;

  const userMessage = normalizeSingleLine(payload.userMessage || '');
  if (userMessage) return userMessage;

  const message = normalizeSingleLine(payload.message || payload.error || '');
  if (message) return `❌ ${message}`;

  return fallbackMessage;
};

const isUnavailableValue = (value = '') => {
  const normalized = normalizeSingleLine(value).toLowerCase();
  return !normalized || normalized === 'no disponible' || normalized === 'n/a' || normalized === '-';
};

const hasUsableTurnoData = (data = {}) => {
  if (!data || typeof data !== 'object') return false;

  if (data.restringido && (!isUnavailableValue(data.ccpp) || !isUnavailableValue(data.titular))) {
    return true;
  }

  const hasTitular = !isUnavailableValue(data.titular);
  const hasSchedule = !isUnavailableValue(data.inicioTurno) || !isUnavailableValue(data.finTurno);
  const hasHijuela = !isUnavailableValue(data.hijuela);
  const hasInspeccion = !isUnavailableValue(data.inspeccion);

  return hasTitular || hasSchedule || hasHijuela || hasInspeccion;
};

const slugifyForFileName = (value = '') => {
  const normalized = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return normalized || 'sin_nombre';
};

const formatFileDate = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}${month}${day}_${hours}${minutes}`;
};

const buildBoletoPdfFileName = ({ tipoBoleto = 'boleto', nombrePersona = 'Usuario', createdAt = new Date() }) => {
  const tipoSegment = slugifyForFileName(tipoBoleto);
  const nombreSegment = slugifyForFileName(nombrePersona);
  const dateSegment = formatFileDate(createdAt);
  return `${tipoSegment}_${nombreSegment}_${dateSegment}.pdf`;
};

const resolveNombrePersona = async (from) => {
  const fromState = formatPersonName(userStates[from]?.nombreCliente || '');
  if (isLikelyValidPersonName(fromState)) return fromState;

  try {
    const cliente = await clienteService.obtenerCliente(from);
    const fromDb = formatPersonName(cliente?.nombre_whatsapp || '');
    if (isLikelyValidPersonName(fromDb)) return fromDb;
  } catch (error) {
    console.warn(`⚠️ No se pudo resolver nombre para naming de PDF (${from}):`, error.message);
  }

  return 'Usuario';
};

const cleanupOldBoletos = () => {
  try {
    if (!fs.existsSync(BOLETOS_PUBLIC_DIR)) return;

    const retentionMs = Math.max(1, BOLETOS_RETENTION_HOURS) * 60 * 60 * 1000;
    const now = Date.now();
    const files = fs.readdirSync(BOLETOS_PUBLIC_DIR);

    for (const fileName of files) {
      const filePath = path.join(BOLETOS_PUBLIC_DIR, fileName);
      try {
        const stat = fs.statSync(filePath);
        if (!stat.isFile()) continue;

        if (now - stat.mtimeMs > retentionMs) {
          fs.unlinkSync(filePath);
        }
      } catch (fileErr) {
        console.warn('⚠️ No se pudo revisar/eliminar boleto antiguo:', fileErr.message);
      }
    }
  } catch (error) {
    console.warn('⚠️ Error en limpieza de boletos retenidos:', error.message);
  }
};

const saveBoletoPublicCopy = async (sourcePdfPath, targetFileName = '') => {
  if (!fs.existsSync(sourcePdfPath)) return null;

  if (!fs.existsSync(BOLETOS_PUBLIC_DIR)) {
    fs.mkdirSync(BOLETOS_PUBLIC_DIR, { recursive: true });
  }

  cleanupOldBoletos();

  const rawName = String(targetFileName || '').trim().replace(/\.pdf$/i, '');
  const safeBaseName = slugifyForFileName(rawName || `boleto_${Date.now()}`);
  let fileName = `${safeBaseName}.pdf`;
  let destinationPath = path.join(BOLETOS_PUBLIC_DIR, fileName);
  let duplicateCounter = 1;

  while (fs.existsSync(destinationPath)) {
    fileName = `${safeBaseName}_${duplicateCounter}.pdf`;
    destinationPath = path.join(BOLETOS_PUBLIC_DIR, fileName);
    duplicateCounter += 1;
  }

  const compressionResult = await compressPdfForFrontend({
    inputPath: sourcePdfPath,
    outputPath: destinationPath,
    preset: BOLETOS_PREVIEW_PDFSETTINGS
  });

  if (compressionResult.compressed) {
    console.log('🗜️ PDF para frontend comprimido', {
      method: compressionResult.method,
      sourceSize: compressionResult.sourceSize,
      outputSize: compressionResult.outputSize
    });
  } else {
    console.log('📄 PDF para frontend guardado sin compresión efectiva', {
      method: compressionResult.method,
      reason: compressionResult.reason
    });
  }

  return `/uploads/boletos/${fileName}`;
};

const LOCALIDADES_PROMPT = [
  { id: 'sede_central', title: 'Sede Central', description: 'Subdelegación Sede Central' },
  { id: 'rio_tunyuan_superior', title: 'Río Tunuyán Superior', description: 'Subdelegación Río Tunuyán Superior' },
  { id: 'rio_mendoza', title: 'Río Mendoza', description: 'Subdelegación Río Mendoza' },
  { id: 'rio_atuel', title: 'Río Atuel', description: 'Subdelegación Río Atuel' },
  { id: 'zona_riego_malargue', title: 'Zona de Riego Malargüe', description: 'Zona de Riego Malargüe' },
  { id: 'rio_diamante', title: 'Río Diamante', description: 'Subdelegación Río Diamante' },
  { id: 'rio_tunyuan_inferior', title: 'Río Tunuyán Inferior', description: 'Subdelegación Río Tunuyán Inferior' }
];

// Memoria temporal para estados de usuarios
const userStates = {};

// Memoria para deduplicación de mensajes
const processedMessageIds = new Set();

// Bloqueo temporal de opciones deshabilitadas del menú principal
const TEMP_DISABLED_MENU_OPTIONS = new Set([
  'ubicacion',
  'vencimientos',
  'empadronamiento',
  'perforacion',
  'renuncia',
  'iniciar_perforacion',
  '4',
  'option_4'
]);

const emitToTenantRoom = async (phone, eventName, payload) => {
  if (!global.io) return;

  const subdelegacionInfo = await clienteService.obtenerSubdelegacionInfo(phone);
  const room = subdelegacionInfo?.id ? `zona_${subdelegacionInfo.id}` : null;
  if (room) {
    global.io.to(room).emit(eventName, payload);
    global.io.to('zona_admin').emit(eventName, payload);
  } else {
    global.io.emit(eventName, payload);
  }
};

const sendSubdelegacionPrompt = async (from) => {
  const sections = [];
  for (let index = 0; index < LOCALIDADES_PROMPT.length; index += 10) {
    sections.push({
      title: index === 0 ? 'Subdelegaciones' : 'Más opciones',
      rows: LOCALIDADES_PROMPT.slice(index, index + 10)
    });
  }

  await whatsappService.sendInteractiveList(
    from,
    'Su subdelegación',
    'Antes de seguir, decime a qué subdelegación corresponde su terreno.',
    'Elegir subdelegación',
    sections
  );

  const mensajeGuardado = await mensajeService.guardarMensaje({
    telefono: from,
    tipo: 'interactive',
    cuerpo: JSON.stringify({
      type: 'interactive_list',
      header: 'Su subdelegación',
      body: 'Antes de seguir, decime a qué subdelegación corresponde su terreno.',
      buttonText: 'Elegir subdelegación',
      sections
    }),
    emisor: 'bot',
    url_archivo: null
  });

  if (global.io) {
    const menuData = {
      type: 'interactive_list',
      header: 'Su subdelegación',
      body: 'Antes de seguir, decime a qué subdelegación corresponde su terreno.',
      buttonText: 'Elegir subdelegación',
      sections
    };

    global.io.emit('nuevo_mensaje', {
      id: mensajeGuardado.id,
      telefono: from,
      mensaje: JSON.stringify(menuData),
      emisor: 'bot',
      tipo: 'interactive',
      timestamp: mensajeGuardado.fecha
    });
  }
};

const handleSubdelegacionChoice = async (from, optionToProcess, messageBody = '') => {
  const selection = await clienteService.resolverSubdelegacionDesdeEntrada(optionToProcess || messageBody);

  if (!selection?.id) {
    await sendMessageAndSave(
      from,
      'No pude identificar la subdelegación. Elegí una opción de la lista.'
    );
    await sendSubdelegacionPrompt(from);
    return;
  }

  const subdelegacion = await clienteService.asignarSubdelegacionCliente(from, selection);
  if (!subdelegacion?.nombre) {
    await sendMessageAndSave(from, 'No pude guardar tu localidad. Probá nuevamente en un momento.');
    return;
  }

  userStates[from].subdelegacion = subdelegacion.nombre;
  userStates[from].subdelegacionId = subdelegacion.id;
  userStates[from].step = 'MAIN_MENU';

  await sendMessageAndSave(
    from,
    `Perfecto, te registramos en *${subdelegacion.nombre}*. Ahora sí, podés elegir una opción del menú.`
  );
  await sendMenuList(from, false);
};

const derivarAHumano = async (from, motivo = 'DERIVACION_BOT') => {
  const subdelegacionResuelta = await clienteService.resolverSubdelegacionCliente(from);

  await clienteService.actualizarEstadoConversacion(from, 'HUMANO');
  await clienteService.cambiarEstadoBot(from, false);

  const ticket = await clienteService.crearTicketHumano(
    from,
    subdelegacionResuelta?.id || null,
    motivo
  );

  await emitToTenantRoom(from, 'bot_mode_changed', {
    telefono: from,
    bot_activo: false,
    estado_conversacion: 'HUMANO',
    subdelegacion: subdelegacionResuelta?.nombre || null,
    subdelegacion_id: subdelegacionResuelta?.id || null,
    ticket_id: ticket?.id || null
  });

  return {
    subdelegacion: subdelegacionResuelta?.nombre || null,
    subdelegacionId: subdelegacionResuelta?.id || null,
    ticket
  };
};

const solicitarOperadorEnEspera = async (from, motivo = 'DERIVACION_BOT') => {
  const subdelegacionInfo = await clienteService.obtenerSubdelegacionInfo(from);

  await clienteService.actualizarEstadoConversacion(from, 'ESPERA_OPERADOR');
  await clienteService.cambiarEstadoBot(from, true);

  const ticket = await clienteService.crearTicketHumano(
    from,
    subdelegacionInfo?.id || null,
    motivo
  );

  await emitToTenantRoom(from, 'operator_handoff_requested', {
    telefono: from,
    subdelegacion: subdelegacionInfo?.nombre || null,
    subdelegacion_id: subdelegacionInfo?.id || null,
    ticket_id: ticket?.id || null,
    motivo,
    requested_at: new Date().toISOString()
  });

  await emitToTenantRoom(from, 'bot_mode_changed', {
    telefono: from,
    bot_activo: true,
    estado_conversacion: 'ESPERA_OPERADOR',
    subdelegacion: subdelegacionInfo?.nombre || null,
    subdelegacion_id: subdelegacionInfo?.id || null,
    ticket_id: ticket?.id || null
  });

  return {
    subdelegacion: subdelegacionInfo?.nombre || null,
    subdelegacionId: subdelegacionInfo?.id || null,
    ticket
  };
};

const intentarDerivarOperador = async (from, motivo = 'DERIVACION_BOT', options = {}) => {
  const { reenviaMenuSiFueraHorario = true } = options;
  const subdelegacionInfo = await clienteService.obtenerSubdelegacionInfo(from);
  const disponibilidad = await clienteService.validarHorarioAtencionOperador(subdelegacionInfo?.id || null);

  if (!disponibilidad.disponible) {
    await sendMessageAndSave(from, disponibilidad.mensaje || '👤 En este momento no hay operadores disponibles. Probá mañana de 8:00 a 13:30.');
    if (reenviaMenuSiFueraHorario) {
      await sendMenuList(from, true);
    }
    return {
      derivado: false,
      fueraHorario: true,
      enEspera: false,
      menuReenviado: Boolean(reenviaMenuSiFueraHorario),
      subdelegacion: subdelegacionInfo?.nombre || null,
      subdelegacionId: subdelegacionInfo?.id || null,
      ticket: null
    };
  }

  const waitingText = `👤 Solicitud enviada\n\nTe pusimos en *espera* para hablar con un operador.${subdelegacionInfo?.nombre ? `\n\n🏢 Localidad: *${subdelegacionInfo.nombre}*` : ''}\n\n¡Enseguida te respondemos!`;
  await sendMessageAndSave(from, waitingText);

  const handoff = await solicitarOperadorEnEspera(from, motivo);
  return {
    derivado: false,
    fueraHorario: false,
    enEspera: true,
    ...handoff
  };
};

/**
 * Verificación del webhook (GET)
 * Meta envía una petición GET para verificar el webhook
 */
const verifyWebhook = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  console.log('🔍 Verificación de webhook solicitada');

  // Verificar que el modo y token coincidan
  if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
    console.log('✅ Webhook verificado correctamente');
    res.status(200).send(challenge);
  } else {
    console.log('❌ Verificación fallida - Token incorrecto');
    res.sendStatus(403);
  }
};

/**
 * Recepción de mensajes (POST)
 * Meta envía los mensajes entrantes a este endpoint
 */
const receiveMessage = async (req, res) => {
  try {
    const body = req.body;

    console.log('📩 Webhook recibido:', JSON.stringify(body, null, 2));

    // Verificar que el body tenga la estructura esperada
    if (body.object) {
      if (
        body.entry &&
        body.entry[0].changes &&
        body.entry[0].changes[0].value.messages &&
        body.entry[0].changes[0].value.messages[0]
      ) {
        const message = body.entry[0].changes[0].value.messages[0];
        const messageId = message.id;
        
        // DEDUPLICACIÓN: Verificar si ya procesamos este mensaje
        if (processedMessageIds.has(messageId)) {
          console.log('🔄 Mensaje duplicado ignorado:', messageId);
          return res.sendStatus(200);
        }
        
        // Registrar el mensaje como procesado
        processedMessageIds.add(messageId);
        
        // Limpieza automática: Eliminar el ID después de 5 minutos
        setTimeout(() => {
          processedMessageIds.delete(messageId);
          console.log('🗑️ ID de mensaje eliminado de caché:', messageId);
        }, 5 * 60 * 1000); // 5 minutos
        
        const from = message.from;
        
        // ============================================
        // AUTO-REGISTRO DEL CLIENTE
        // ============================================
        const contactInfo = body.entry[0].changes[0].value.contacts?.[0] || {};
        const pushName = contactInfo.profile?.name || 'Sin Nombre';
        const fotoPerfil = contactInfo.wa_id ? `https://graph.facebook.com/v21.0/${contactInfo.wa_id}/profile_picture` : null;
        
        let cliente = null;
        let esClienteNuevo = false;
        try {
          cliente = await clienteService.obtenerOCrearCliente(from, pushName, fotoPerfil);
          // Detectar si es cliente nuevo: ultima_interaccion ≈ fecha_registro
          if (cliente) {
            const ultimaInteraccion = new Date(cliente.ultima_interaccion).getTime();
            const fechaRegistro = new Date(cliente.fecha_registro).getTime();
            const diferencia = ultimaInteraccion - fechaRegistro;
            esClienteNuevo = diferencia < 2000; // Menos de 2 segundos = es nuevo
          }
        } catch (error) {
          console.error('❌ Error en auto-registro de cliente:', error);
        }
        
        // Extraer el mensaje: puede ser texto o respuesta interactiva
        let messageBody = '';
        let tipoMensaje = message.type || 'text';
        let mediaUrl = null;
        
        if (message.type === 'text') {
          messageBody = message.text?.body?.trim() || '';
        } else if (message.type === 'interactive') {
          // Puede ser list_reply o button_reply
          let selectedOptionId = '';
          if (message.interactive.type === 'list_reply') {
            const rawTitle = message.interactive.list_reply.title || message.interactive.list_reply.id;
            const rawDescription = message.interactive.list_reply.description || '';
            messageBody = stripListSelectionDescription(rawTitle, rawDescription) || message.interactive.list_reply.id;
            selectedOptionId = message.interactive.list_reply.id;
          } else if (message.interactive.type === 'button_reply') {
            messageBody = message.interactive.button_reply.title || message.interactive.button_reply.id;
            selectedOptionId = message.interactive.button_reply.id;
          }
          // Guardar el ID para la lógica del bot
          message._optionId = selectedOptionId;
        } else if (message.type === 'image') {
          messageBody = message.image?.caption || '[Imagen]';
          mediaUrl = message.image?.id;
          tipoMensaje = 'image';
        } else if (message.type === 'audio') {
          messageBody = '[Audio]';
          mediaUrl = message.audio?.id;
          tipoMensaje = 'audio';
        } else if (message.type === 'document') {
          messageBody = message.document?.filename || '[Documento]';
          mediaUrl = message.document?.id;
          tipoMensaje = 'document';
        }

        console.log(`💬 Mensaje de ${from}: ${messageBody} (tipo: ${tipoMensaje})`);

        // Guardar mensaje del usuario en segundo plano (sin bloquear)
        const persistIncoming = async () => {
          try {
            let storedUrl = mediaUrl;
            if ((tipoMensaje === 'image' || tipoMensaje === 'document') && mediaUrl) {
              try {
                storedUrl = await whatsappService.downloadMedia(mediaUrl);
              } catch (downloadErr) {
                console.error('❌ Error descargando media entrante:', downloadErr);
              }
            }

            const mensajeGuardado = await mensajeService.guardarMensaje({
              telefono: from,
              tipo: tipoMensaje,
              cuerpo: messageBody,
              url_archivo: storedUrl,
              emisor: 'usuario',
              message_id: messageId
            });
            
            // ✅ Emitir al frontend CON el ID del mensaje guardado
            if (global.io) {
              global.io.emit('nuevo_mensaje', {
                id: mensajeGuardado.id, // ✅ INCLUIR ID
                telefono: from,
                mensaje: messageBody,
                emisor: 'usuario',
                tipo: tipoMensaje,
                timestamp: mensajeGuardado.fecha
              });
            }
          } catch (error) {
            console.error('❌ Error al guardar mensaje del cliente:', error);
          }
        };

        // ✅ Guardar el mensaje SIEMPRE (incluso si el bot está pausado)
        await persistIncoming();

        // ============================================
        // VERIFICAR ESTADO DEL BOT ANTES DE RESPONDER
        // ============================================
        const botActivo = await clienteService.esBotActivo(from);
        
        if (!botActivo) {
          console.log(`⏸️ Bot pausado para ${from} - Mensaje guardado, sin respuesta automática`);
          // No enviar respuesta automática
          return res.sendStatus(200);
        }

        // Verificar si el usuario existe y si pasaron más de 12 horas desde su último mensaje
        const TWELVE_HOURS = 12 * 60 * 60 * 1000; // 12 horas en milisegundos
        const now = Date.now();
        
        if (!userStates[from]) {
          // Usuario nuevo
          const nombreDetectado = cliente?.nombre_whatsapp || pushName;

          userStates[from] = {
            step: 'START',
            padron: null,
            nombreCliente: isLikelyValidPersonName(nombreDetectado) ? formatPersonName(nombreDetectado) : '',
            esClienteNuevo,
            subdelegacion: cliente?.subdelegacion || null,
            lastMessageTime: now,
            namePromptSent: false,
            needsNamePrompt: !Boolean(cliente?.nombre_validado)
          };
        } else {
          // Usuario existente: verificar tiempo de inactividad
          const timeSinceLastMessage = now - (userStates[from].lastMessageTime || 0);

          if (timeSinceLastMessage > TWELVE_HOURS) {
            // Pasaron más de 12 horas: saludar de nuevo pero mantener datos del cliente
            console.log(`⏰ Han pasado ${Math.round(timeSinceLastMessage / (60 * 60 * 1000))} horas desde el último mensaje de ${from}`);
            userStates[from].step = 'START';
            userStates[from].shouldGreet = true;
          }

          // Actualizar el timestamp del último mensaje
          userStates[from].lastMessageTime = now;

          if (!Boolean(cliente?.nombre_validado) && userStates[from].step !== 'AWAITING_USER_NAME') {
            userStates[from].step = 'START';
            userStates[from].needsNamePrompt = true;
            userStates[from].namePromptSent = false;
          }
        }

        const estadoConversacion = String(cliente?.estado_conversacion || 'BOT').toUpperCase();
        if (estadoConversacion === 'ESPERA_OPERADOR') {
          userStates[from].step = 'AWAITING_OPERATOR_ASSIGNMENT';
        } else if (estadoConversacion === 'ENCUESTA_POST_OPERADOR') {
          userStates[from].step = 'AWAITING_OPERATOR_SURVEY';
        } else if (estadoConversacion === 'FOLLOWUP_POST_OPERADOR') {
          userStates[from].step = 'AWAITING_OPERATOR_FOLLOWUP';
        }

        // Procesar mensaje según el estado actual
        const optionId = message._optionId || messageBody;

        // Anti-loop: ignorar webhooks sin input util (evita reenviar menú por eventos vacíos)
        if (!String(optionId || '').trim() && !String(messageBody || '').trim()) {
          console.log(`🔇 Evento sin contenido útil para ${from}: se ignora para evitar loop de menú`);
          return res.sendStatus(200);
        }

        await handleUserMessage(from, messageBody, optionId);
      }

      // Siempre responder con 200 OK
      res.sendStatus(200);
    } else {
      console.log('⚠️ Evento no reconocido');
      res.sendStatus(404);
    }
  } catch (error) {
    console.error('❌ Error procesando webhook:', error);
    // Responder 200 para evitar reintentos infinitos de Meta
    res.sendStatus(200);
  }
};

/**
 * Maneja la lógica del flujo conversacional
 */
const handleUserMessage = async (from, messageBody, optionId = null) => {
  const currentState = userStates[from].step;
  const optionToProcess = optionId || messageBody;

  console.log(`🔄 Estado actual de ${from}: ${currentState}`);

  // ============================================
  // MANEJO DE BOTONES GLOBALES
  // ============================================
  
  // Botón: Descargar Boleto
  if (messageBody === 'btn_descargar_boleto') {
    await handleDescargarBoleto(from);
    return;
  }
  
  // Botón: Cambiar DNI
  if (messageBody === 'btn_cambiar_dni') {
    const changeDniMsg = '📝 Entendido. Por favor escribí el nuevo DNI o CUIT a consultar (sin puntos ni guiones).';
    await sendMessageAndSave(from, changeDniMsg);
    userStates[from].step = 'AWAITING_DNI';
    console.log(`🔄 Usuario ${from} solicita cambiar DNI`);
    return;
  }

  switch (currentState) {
    case 'START':
    default:
      // Enviar bienvenida + menú (personalizado si es cliente conocido o si pasaron 12 horas)
      const shouldGreet = userStates[from].shouldGreet || userStates[from].step === 'START';
      if (shouldGreet) {
        await sendWelcomeMessage(from, userStates[from].nombreCliente, userStates[from].esClienteNuevo);
        userStates[from].shouldGreet = false; // Resetear el flag
      }
      if (userStates[from].needsNamePrompt && !userStates[from].namePromptSent) {
        userStates[from].namePromptSent = true;
        userStates[from].step = 'AWAITING_USER_NAME';
        break;
      }
      if (!userStates[from].subdelegacion) {
        await sendSubdelegacionPrompt(from);
        userStates[from].step = 'AWAITING_SUBDELEGACION';
        break;
      }
      await sendMenuList(from, false); // false = es la primera vez
      userStates[from].step = 'MAIN_MENU';
      break;

    case 'MAIN_MENU':
      await handleMainMenu(from, optionToProcess);
      break;

    case 'AWAITING_DNI':
      await handleDniInput(from, messageBody);
      break;

    case 'AWAITING_SUBDELEGACION':
      await handleSubdelegacionChoice(from, optionToProcess, messageBody);
      break;

    case 'AWAITING_DNI_BOLETO':
      await handleDniInputBoleto(from, messageBody);
      break;

    case 'AWAITING_MODO_CONSULTA':
      await handleModoConsulta(from, optionToProcess);
      break;

    case 'AWAITING_DNI_CHOICE':
      await handleDniChoice(from, optionToProcess);
      break;

    case 'AWAITING_PADRON_GLOBAL_CHOICE':
      await handlePadronGlobalChoice(from, optionToProcess);
      break;

    case 'AWAITING_PADRON_CHOICE':
      await handlePadronChoice(from, optionToProcess);
      break;

    case 'AWAITING_TIPO_PADRON':
      await handleTipoPadron(from, optionToProcess);
      break;

    case 'AWAITING_PADRON_SUPERFICIAL':
      await handlePadronSuperficial(from, messageBody);
      break;

    case 'AWAITING_PADRON_SUBTERRANEO':
      await handlePadronSubterraneo(from, messageBody);
      break;

    case 'AWAITING_PADRON_CONTAMINACION':
      await handlePadronContaminacion(from, messageBody);
      break;

    case 'AWAITING_USER_NAME':
      await handleUserNameInput(from, messageBody);
      break;

    case 'AWAITING_TIPO_CUOTA':
      await handleTipoCuota(from, optionToProcess);
      break;

    case 'AWAITING_TIPO_CUOTA_PADRON':
      await handleTipoCuotaPadron(from, optionToProcess);
      break;

    case 'AWAITING_BOLETO_POST_DEUDA':
      await handlePostDeudaBoletoChoice(from, optionToProcess);
      break;

    case 'AWAITING_PAGO_DEUDA':
      await handlePagoDeudaChoice(from, optionToProcess);
      break;

    case 'AWAITING_PAGO_BOLETO':
      await handlePagoBoletoChoice(from, optionToProcess);
      break;

    case 'AWAITING_PERFORACION_HELP':
      await handlePerforacionHelpChoice(from, optionToProcess);
      break;

    case 'AWAITING_OPCION_BOLETO_PADRON':
      await handleOpcionBoletoPadron(from, optionToProcess);
      break;

    case 'AWAITING_PADRON':
      await handlePadronInput(from, messageBody);
      break;

    case 'AWAITING_TURNO_METHOD':
      await handleTurnoMethodChoice(from, optionToProcess);
      break;

    case 'AWAITING_TURNO_TITULAR_CHOICE':
      await handleTurnoTitularChoice(from, optionToProcess);
      break;

    case 'AWAITING_TURNO_TITULAR':
      await handleTurnoTitularInput(from, messageBody);
      break;

    case 'AWAITING_TURNO_TITULAR_API_OPTION':
      await handleTurnoTitularApiOptionInput(from, messageBody);
      break;

    case 'AWAITING_TURNO_CCPP_CHOICE':
      await handleTurnoCCPPChoice(from, optionToProcess);
      break;

    case 'AWAITING_TURNO_CCPP':
      await handleTurnoCCPPInput(from, messageBody);
      break;

    case 'AUTH_MENU':
      await handleAuthMenu(from, messageBody);
      break;

    case 'AWAITING_OPERATOR_CHOICE':
      // Handle operator choice buttons
      console.log(`🔵 Opción recibida en AWAITING_OPERATOR_CHOICE: "${optionToProcess}"`);
      if (optionToProcess === 'op_si_operador') {
        // User wants to talk with operator
        const handoff = await intentarDerivarOperador(from, 'SCRAPER_ERROR_OPERATOR_CHOICE');
        if (handoff.enEspera) {
          userStates[from].step = 'AWAITING_OPERATOR_ASSIGNMENT';
          console.log(`👤 Usuario ${from} en espera de operador por error en scraper`);
        } else if (handoff.fueraHorario) {
          userStates[from].step = 'MAIN_MENU';
          console.log(`🕒 Fuera de horario de operador para ${from}`);
        } else {
          userStates[from].step = 'MAIN_MENU';
        }
      } else if (optionToProcess === 'op_no_operador') {
        // User wants to do another transaction
        await sendMenuList(from, true);
        userStates[from].step = 'MAIN_MENU';
        console.log(`📋 Usuario ${from} continúa con menú principal después de error`);
      } else if (optionToProcess === 'op_reintentar_dni') {
        // User wants to retry with a different DNI
        const retryMsg = `📝 Ingresá nuevamente tu DNI/CUIT.\n\nPor favor, verificá que el número sea correcto.`;
        await sendMessageAndSave(from, retryMsg);
        userStates[from].step = 'AWAITING_DNI';
        console.log(`🔄 Usuario ${from} reintentando con nuevo DNI`);
      } else {
        console.warn(`⚠️ Opción no reconocida en AWAITING_OPERATOR_CHOICE: "${optionToProcess}"`);
        const invalidMsg = '❌ Opción no válida. Por favor, elige una de las opciones disponibles.';
        await sendMessageAndSave(from, invalidMsg);
      }
      break;

    case 'AWAITING_OPERATOR_ASSIGNMENT':
      await handleOperatorWaitingInput(from, messageBody, optionToProcess);
      break;

    case 'AWAITING_OPERATOR_SURVEY':
      await handleOperatorSurveyResponse(from, optionToProcess);
      break;

    case 'AWAITING_OPINION_CHOICE':
      await handleOpinionChoice(from, optionToProcess);
      break;

    case 'AWAITING_OPINION_TEXT':
      await handleOpinionText(from, messageBody);
      break;

    case 'AWAITING_OPERATOR_FOLLOWUP':
      await handleOperatorPostFollowUp(from, optionToProcess);
      break;
  }
};

/**
 * Envía el mensaje de bienvenida personalizado o institucional
 * @param {string} from - Número de teléfono
 * @param {string} nombreCliente - Nombre del cliente (si existe)
 * @param {boolean} esClienteNuevo - Si es cliente nuevo o existente
 */
const sendWelcomeMessage = async (from, nombreCliente = '', esClienteNuevo = true) => {
  let welcomeMessage = '';
  
  if (esClienteNuevo) {
    // Saludo genérico para clientes nuevos
    welcomeMessage = `👋 ¡Bienvenido/a!

  Te comunicás con el *chat automatizado de Irrigación*.

  Para comenzar, ¿cómo es su nombre?`;
  } else {
    // Saludo personalizado para clientes conocidos
    const nombre = nombreCliente ? nombreCliente.split(' ')[0] : 'amigo'; // Usar solo el primer nombre
    welcomeMessage = `👋 ¡Hola ${nombre}! ¿En qué puedo ayudarte hoy?`;
  }
  
  await sendMessageAndSave(from, welcomeMessage);
  console.log(`👋 Mensaje de bienvenida enviado a ${from}`);
};

const handleUserNameInput = async (from, messageBody) => {
  try {
    const nombre = extractLikelyNameFromInput(messageBody);

    if (!isLikelyValidPersonName(nombre)) {
      const invalidNameMsg = '⚠️ Ese nombre no parece válido.\n\nPor favor escribí tu nombre real (mínimo 2 letras).\nEjemplo: Maria Gomez';
      await sendMessageAndSave(from, invalidNameMsg);
      userStates[from].step = 'AWAITING_USER_NAME';
      userStates[from].namePromptSent = true;
      return;
    }

    await clienteService.actualizarNombreWhatsapp(from, nombre, true);
    userStates[from].nombreCliente = nombre;
    userStates[from].esClienteNuevo = false;
    userStates[from].step = 'START';
    userStates[from].namePromptSent = false;
    userStates[from].needsNamePrompt = false;

    const primerNombre = nombre.split(' ')[0];
    await sendMessageAndSave(from, `Un gusto *${primerNombre}*! ¿A qué subdelegación corresponde su terreno?`);

    if (!userStates[from].subdelegacion) {
      await sendSubdelegacionPrompt(from);
      userStates[from].step = 'AWAITING_SUBDELEGACION';
      return;
    }

    await sendMenuList(from, false);
    userStates[from].step = 'MAIN_MENU';
  } catch (error) {
    console.error('❌ Error en handleUserNameInput:', error);
    await sendMessageAndSave(from, '❌ Ocurrió un error al guardar tu nombre. Intentá nuevamente.');
    userStates[from].step = 'AWAITING_USER_NAME';
  }
};

/**
 * Envía la lista interactiva del menú principal
 * @param {string} from - Número de teléfono del usuario
 * @param {boolean} isFollowUp - Si es true, muestra mensaje de seguimiento en lugar del inicial
 */
const sendMenuList = async (from, isFollowUp = false) => {
  const sections = [
    {
      title: 'Consultas Disponibles',
      rows: [
        { 
          id: 'deuda', 
          title: '💳 Solicitar Deuda',
          description: 'Consultar deuda y pagar online'
        },
        { 
          id: 'boleto', 
          title: '📄 Pago Anual o Bimestral',
          description: 'Obtener boleto y pagar online'
        },
        { 
          id: 'turnos', 
          title: '🗓️ Consultar Turnos',
          description: 'Información sobre turnos disponibles'
        }
      ]
    },
    {
      title: 'Ayuda y Soporte',
      rows: [
        {
          id: 'operador',
          title: '👤 Hablar con Operador',
          description: 'Comunicate con un agente en vivo'
        }
      ]
    }
  ];

  // Cambiar el mensaje según si es seguimiento o primera vez
  const header = 'Atención al Ciudadano';
  const body = isFollowUp ? '¿Desea realizar otro trámite?' : '¿Qué trámite desea realizar hoy?';
  const headerImageUrl = process.env.MENU_HEADER_IMAGE_URL || null;
  
  await whatsappService.sendInteractiveList(
    from,
    header,
    body,
    'Ver Opciones',
    sections,
    headerImageUrl
  );
  
  // Guardar estructura JSON completa para que el frontend pueda reconstruir las opciones
  const menuData = {
    type: 'interactive_list',
    header: header,
    body: body,
    buttonText: 'Ver Opciones',
    sections: sections
  };
  
  // Guardar en BD y emitir a frontend SIN reenviar el JSON por WhatsApp
  const mensajeGuardado = await mensajeService.guardarMensaje({
    telefono: from,
    tipo: 'interactive',
    cuerpo: JSON.stringify(menuData),
    emisor: 'bot',
    url_archivo: null
  });
  
  if (global.io) {
    global.io.emit('nuevo_mensaje', {
      id: mensajeGuardado.id,
      telefono: from,
      mensaje: JSON.stringify(menuData),
      emisor: 'bot',
      tipo: 'interactive',
      timestamp: mensajeGuardado.fecha
    });
  }
  
  console.log(`📋 Lista de menú enviada a ${from} (ID: ${mensajeGuardado.id})`);
};

const sendButtonReplyAndSave = async (from, body, buttons) => {
  await whatsappService.sendButtonReply(from, body, buttons);

  const payload = {
    type: 'interactive_buttons',
    body,
    buttons
  };

  const mensajeGuardado = await mensajeService.guardarMensaje({
    telefono: from,
    tipo: 'interactive',
    cuerpo: JSON.stringify(payload),
    emisor: 'bot',
    url_archivo: null
  });

  if (global.io) {
    global.io.emit('nuevo_mensaje', {
      id: mensajeGuardado.id,
      telefono: from,
      mensaje: JSON.stringify(payload),
      emisor: 'bot',
      tipo: 'interactive',
      timestamp: mensajeGuardado.fecha
    });
  }

  return mensajeGuardado;
};

const sendInteractiveButtonsAndSave = async (from, body, buttons) => {
  await whatsappService.sendInteractiveButtons(from, body, buttons);

  const payload = {
    type: 'interactive_buttons',
    body,
    buttons
  };

  const mensajeGuardado = await mensajeService.guardarMensaje({
    telefono: from,
    tipo: 'interactive',
    cuerpo: JSON.stringify(payload),
    emisor: 'bot',
    url_archivo: null
  });

  if (global.io) {
    global.io.emit('nuevo_mensaje', {
      id: mensajeGuardado.id,
      telefono: from,
      mensaje: JSON.stringify(payload),
      emisor: 'bot',
      tipo: 'interactive',
      timestamp: mensajeGuardado.fecha
    });
  }

  return mensajeGuardado;
};

/**
 * Maneja las opciones del menú principal
 */
const handleMainMenu = async (from, option) => {
  const normalizedOption = String(option || '').toLowerCase().trim();

  if (TEMP_DISABLED_MENU_OPTIONS.has(normalizedOption)) {
    await sendMessageAndSave(
      from,
      '🔒 Esta opción quedó deshabilitada temporalmente. Por favor elegí una de las opciones disponibles del menú actual.'
    );
    await sendMenuList(from, true);
    console.log(`🔒 Opción temporalmente deshabilitada: ${normalizedOption} | usuario=${from}`);
    return;
  }

  switch (option) {
    case '1':
    case 'option_1':
    case 'deuda':
      // Solicitar Deuda: Consultar deuda y ofrecer pago online
      // Pre-fetch en background para que el Flow endpoint responda < 100 ms
      flowCoordinator.preFetchDebt(from);
      await handleConsultarDeuda(from);
      break;

    case '2':
    case 'option_2':
    case 'boleto':
      // Pago Anual o Bimestral
      await handlePedirBoleto(from);
      break;

    case '3':
    case 'option_3':
    case 'turnos': {
      const [lastTitularDB, lastCCPPDB] = await Promise.all([
        clienteService.obtenerUltimoTitular(from),
        clienteService.obtenerUltimoCCPP(from)
      ]);

      if (lastTitularDB) {
        userStates[from].lastTitular = lastTitularDB;
      }
      if (lastCCPPDB) {
        userStates[from].lastCCPP = lastCCPPDB;
      }

      const hasMemory = Boolean(userStates[from].lastTitular || userStates[from].lastCCPP);
      // Ofrecer opciones de búsqueda de turno
      const turnosIntro = `🗓️ *Consulta de Turnos*\n\n¿Cómo desea buscar su turno?${hasMemory ? '\n\n💾 También podés escribir *mismo* para reutilizar tu última búsqueda.' : ''}\n\n_📌 En cualquier momento, escribí *SALIR* para volver al menú principal._`;
      await sendMessageAndSave(from, turnosIntro);

      await sendInteractiveButtonsAndSave(
        from,
        '📋 Seleccione el método de búsqueda:',
        [
          { id: 'turno_titular', title: '👤 Por Titular' },
          { id: 'turno_ccpp', title: '🔢 Por Servicio' },
          { id: 'volver', title: '↩️ Volver' }
        ]
      );

      userStates[from].step = 'AWAITING_TURNO_METHOD';
      console.log(`🗓️ Opciones de búsqueda de turno enviadas a ${from}`);
      break;
    }

    case 'ubicacion':
      const locationLat = parseFloat(process.env.UBICACION_LAT || '');
      const locationLon = parseFloat(process.env.UBICACION_LON || '');
      const locationName = process.env.UBICACION_NOMBRE || 'Jefatura de Zona de Riego';
      const locationAddress = process.env.UBICACION_DIRECCION || 'Av. San Martín 258, Malargüe, Mendoza';

      if (!Number.isNaN(locationLat) && !Number.isNaN(locationLon)) {
        await whatsappService.sendLocation(from, locationLat, locationLon, locationName, locationAddress);
        await mensajeService.guardarMensaje({
          telefono: from,
          tipo: 'location',
          cuerpo: JSON.stringify({
            latitude: locationLat,
            longitude: locationLon,
            name: locationName,
            address: locationAddress
          }),
          emisor: 'bot',
          url_archivo: null
        });
      } else {
        console.warn('⚠️ UBICACION_LAT/UBICACION_LON no configuradas. Enviando solo texto.');
      }

      const locationText = `📍 Ubicación y Horarios

Nos encontramos en:
🏢 ${locationAddress}

⏰ Horarios de atención:
📅 Lunes a Viernes: 8:00 a 13:30 hs
🚫 Fines de semana: Cerrado`;
      
      await sendMessageAndSave(from, locationText);
      // Reenviar la lista con mensaje de seguimiento
      await sendMenuList(from, true);
      console.log(`📍 Info de ubicación enviada a ${from}`);
      break;

    case '2':
    case 'option_2':
    case 'empadronamiento':
      const infoText = `🧾 Empadronamiento / Pedido de Agua

*REQUISITOS:*

a) Nombre, DNI, domicilio del solicitante
b) Firma del propietario del inmueble
c) Identificación del predio a beneficiar
d) Uso al que se destinará el recurso
e) Tipo de cultivo o actividad
f) Sistema de riego que utilizará
g) Elementos para cuantificar demanda
h) Acreditación de titularidad (Nomenclatura Catastral)
i) Certificado de libre deuda del DGI

*SOLICITUD DE PERMISO PRECARIO:*
Mismos requisitos (a-i)

📧 Presentación:
• Presencial en oficinas
• Email: entradasmalargue@irrigacion.gov.ar`;
      
      await sendMessageAndSave(from, infoText);
      // Reenviar la lista con mensaje de seguimiento
      await sendMenuList(from, true);
      console.log(`📋 Info de empadronamiento enviada a ${from}`);
      break;

    case 'vencimientos': {
      try {
        const imagePath = path.join(__dirname, '../../public/images/vencimientos.jpg');
        
        // Verificar si existe la imagen
        if (fs.existsSync(imagePath)) {
          const vencimientosText = `📅 Consultar Vencimientos

Aquí están las fechas de vencimiento actualizadas:`;
          await sendMessageAndSave(from, vencimientosText);
          
          // Enviar imagen
          await whatsappService.sendImage(from, imagePath, '📅 Calendario de vencimientos');
          
          await sendMenuList(from, true);
          console.log(`📅 Imagen de vencimientos enviada a ${from}`);
        } else {
          const errorText = `📅 Consultar Vencimientos

Los vencimientos no están disponibles en este momento.

Por favor contactá a un operador para más información.`;
          await sendMessageAndSave(from, errorText);
          await sendMenuList(from, true);
          console.log(`⚠️ Imagen de vencimientos no encontrada para ${from}`);
        }
      } catch (error) {
        console.error(`❌ Error enviando vencimientos a ${from}:`, error);
        const errorText = `❌ Error al cargar la información de vencimientos. Intenta de nuevo más tarde.`;
        await sendMessageAndSave(from, errorText);
        await sendMenuList(from, true);
      }
      break;
    }

    case 'perforacion': {
      await handleIniciarPerforacion(from);
      break;
    }

    case 'renuncia': {
      const renunciaText = `🧾 Tramitar Renuncia

*REQUISITOS:*

1. Constancia de Libre Deuda (tributos de riego)
2. Constancia de pago Obras Reembolsables
3. Constancia de pago de Aranceles (Acordadas)
4. Constancia conexión Red Pública Agua Potable
5. Sistema de Micromedición (opcional)
6. Apoderados: instrumento público
7. Fallecimiento: declaratoria de herederos
8. Copia Escritura Traslativa de Dominio
9. Copia Plano de Mensura (DPC)
10. Otra documentación requerida

📋 Además deberás completar un formulario.

📧 Presentación presencial en oficinas.

📩 También podés presentar la documentación por correo a entradamalargue@irrigacion.gov.ar.`;
      await sendMessageAndSave(from, renunciaText);
      
      try {
        const docPath = path.join(__dirname, '../../public/docs/formulario_renuncia.doc');
        
        // Verificar si existe el documento
        if (fs.existsSync(docPath)) {
          await whatsappService.sendDocument(from, docPath, 'Formulario de Renuncia.doc');
          console.log(`📎 Formulario de renuncia enviado a ${from}`);
          
          // 💾 GUARDAR el formulario en BD y emitir al frontend
          const mensajeGuardado = await mensajeService.guardarMensaje({
            telefono: from,
            tipo: 'document',
            cuerpo: 'Formulario de Renuncia',
            url_archivo: docPath,
            emisor: 'bot'
          });
          
          // Emitir al frontend via Socket.IO
          if (global.io) {
            global.io.emit('nuevo_mensaje', {
              id: mensajeGuardado.id,
              telefono: from,
              mensaje: 'Formulario de Renuncia.doc',
              emisor: 'bot',
              tipo: 'document',
              url_archivo: docPath,
              timestamp: mensajeGuardado.fecha
            });
          }
        } else {
          const infoText = `📎 El formulario estará disponible en oficinas.`;
          await sendMessageAndSave(from, infoText);
          console.log(`⚠️ Formulario de renuncia no encontrado para ${from}`);
        }
      } catch (error) {
        console.error(`❌ Error enviando formulario a ${from}:`, error);
      }
      
      await sendMenuList(from, true);
      console.log(`🧾 Info de renuncia enviada a ${from}`);
      break;
    }

    case '4':
    case 'option_4':
    case 'operador': {
      const handoff = await intentarDerivarOperador(from, 'MAIN_MENU_OPERATOR');
      if (handoff.enEspera) {
        userStates[from].step = 'AWAITING_OPERATOR_ASSIGNMENT';
        console.log(`👤 Usuario ${from} en espera de operador`);
      } else {
        userStates[from].step = 'MAIN_MENU';
        console.log(`🕒 Fuera de horario de operador para ${from}`);
      }
      break;
    }

    case 'iniciar_perforacion': {
      await handleIniciarPerforacion(from);
      break;
    }

    default:
      // Opción no válida, reenviar solo la lista
      await sendMenuList(from, true);
      console.log(`⚠️ Opción inválida de ${from}, reenviando menú`);
      break;
  }
};

/**
 * Procesa el número de padrón ingresado
 */
const handlePadronInput = async (from, messageBody) => {
  const lower = messageBody.toLowerCase().trim();
  
  // Permitir volver al menú
  if (lower === 'volver' || lower === 'menu' || lower === 'salir' || lower === 'cancelar') {
    await sendMenuList(from, true);
    userStates[from].step = 'MAIN_MENU';
    return;
  }
  
  // Extraer números del mensaje usando RegEx
  const match = messageBody.match(/\d+/);
  const padron = match ? match[0] : null;

  // Validar que se encontró un número
  if (!padron) {
    await whatsappService.sendMessage(
      from,
      '⚠️ No detectamos un número válido. Por favor escribí solo tu número de padrón (Ej: 1234).\n\n_📌 Para cancelar, escribí *SALIR*_'
    );
    console.log(`⚠️ Padrón inválido recibido de ${from}: ${messageBody}`);
    // No cambiar de estado, esperar nuevo input
    return;
  }

  // Buscar el regante en la base de datos
  try {
    const reganteData = await reganteService.getReganteByPadron(padron);

    if (!reganteData) {
      // Padrón no encontrado en la base de datos
      await whatsappService.sendMessage(
        from,
        `❌ No encontramos el padrón ${padron} en nuestra base de datos. Por favor verifique el número.\n\n_📌 Para cancelar, escribí *SALIR*_`
      );
      console.log(`❌ Padrón ${padron} no encontrado para ${from}`);
      // No cambiar de estado, permitir reintentar
      return;
    }

    // Guardar el padrón y los datos del regante
    userStates[from].padron = padron;
    userStates[from].data = reganteData;

    const buttons = [
      {
        id: 'auth_deuda',
        title: '💰 Consultar deuda'
      },
      {
        id: 'auth_estado',
        title: '🌾 Derechos de riego'
      },
      {
        id: 'auth_turno',
        title: '📅 Solicitar turno'
      }
    ];

    const bodyText = `✅ Bienvenido ${reganteData.nombre}

Padrón: *${padron}* vinculado correctamente.

Seleccioná una opción:`;

    await sendInteractiveButtonsAndSave(from, bodyText, buttons);
    
    // Enviar más opciones (contactar operador y salir)
    setTimeout(async () => {
      const moreButtons = [
        { id: 'auth_contact', title: '👤 Contactar Operador' },
        { id: 'auth_salir', title: '↩️ Volver al menú' }
      ];
      await sendInteractiveButtonsAndSave(
        from,
        'Otras opciones:',
        moreButtons
      );
    }, 500);

    userStates[from].step = 'AUTH_MENU';
    console.log(`✅ Usuario ${from} autenticado con padrón ${padron}`);
  } catch (error) {
    console.error('❌ Error consultando base de datos:', error);
    await whatsappService.sendMessage(
      from,
      '❌ Ocurrió un error al consultar la base de datos. Por favor intente más tarde.'
    );
  }
};

/**
 * Maneja las opciones del menú autenticado
 */
const handleAuthMenu = async (from, option) => {
  const padron = userStates[from].padron;
  const reganteData = userStates[from].data;

  switch (option) {
    case '1':
    case 'auth_deuda':
      const deudaText = `💰 Estado de Cuenta

Titular: *${reganteData.nombre}*
Padrón: *${padron}*

Deuda actual: *$${reganteData.deuda.toLocaleString('es-AR')}*

${reganteData.deuda > 0 ? '⚠️ Tiene deuda pendiente.\n\nPara abonar, acercate a nuestras oficinas.' : '✅ Se encuentra al día.'}`;
      
      await whatsappService.sendMessage(from, deudaText);
      console.log(`💰 Consulta de deuda enviada a ${from}`);
      break;

    case '2':
    case 'auth_estado':
      const estadoText = `🌾 Estado Derecho de Riego

Titular: *${reganteData.nombre}*
Padrón: *${padron}*

*Estado:* ${reganteData.estado === 'Activo' ? '✅ HABILITADO' : '❌ SUSPENDIDO'}

*Hectáreas registradas:* ${reganteData.hectareas} ha
*Tipo de cultivo:* ${reganteData.cultivo}
*Último turno:* ${reganteData.turno}

${reganteData.estado === 'Activo' ? 'Tu derecho de riego está al día.' : 'Por favor regularice su situación.'}`;
      
      await whatsappService.sendMessage(from, estadoText);
      console.log(`🌾 Estado de riego enviado a ${from}`);
      break;

    case '3':
    case 'auth_turno':
      const turnoText = `📅 Solicitud de Turno

Titular: *${reganteData.nombre}*
Padrón: *${padron}*

Tu solicitud ha sido registrada.

*Próximo turno disponible:*
📆 Fecha estimada: 28/12/2024
⏰ Horario: 06:00 a 12:00 hs

Te confirmaremos el turno por este medio 24hs antes.`;
      
      await whatsappService.sendMessage(from, turnoText);
      console.log(`📅 Turno solicitado por ${from}`);
      break;

    case 'auth_contact':
      {
        const handoff = await intentarDerivarOperador(from, 'AUTH_MENU_OPERATOR');
        if (handoff.enEspera) {
          userStates[from].step = 'AWAITING_OPERATOR_ASSIGNMENT';
          console.log(`👤 Contacto con operador en espera para ${from}`);
        } else {
          userStates[from].step = 'MAIN_MENU';
          console.log(`🕒 Fuera de horario de operador para ${from}`);
        }
      }
      break;

    case '4':
    case 'auth_salir':
      const goodbyeText = `👋 Sesión Finalizada

Gracias por usar el sistema de Irrigación Malargüe.

¡Hasta pronto!`;
      
      await sendMessageAndSave(from, goodbyeText);
      userStates[from] = { step: 'START', padron: null, lastMessageTime: Date.now() };
      console.log(`👋 Usuario ${from} salió del sistema`);
      break;

    default:
      // Opción no válida
      await sendMessageAndSave(from, '❌ Opción no válida. Por favor elegí una opción del menú:');
      await handlePadronInput(from, padron);
      console.log(`⚠️ Opción inválida en AUTH_MENU de ${from}`);
      break;
  }
};

/**
 * Manejar consulta de deuda (option_3)
 */
const handleConsultarDeuda = async (from) => {
  try {
    const preguntaMsg = `📝 *¿Cómo querés consultar tu deuda?*

_📌 En cualquier momento, escribí *SALIR* para volver al menú principal._`;
    await sendMessageAndSave(from, preguntaMsg);

    const buttons = [
      { id: 'modo_dni', title: '🆔 Por DNI' },
      { id: 'modo_padron', title: '📋 Por Servicio' },
      { id: 'volver_menu', title: '↩️ Volver' }
    ];

    await sendButtonReplyAndSave(
      from,
      'Elegí una opción:',
      buttons
    );

    userStates[from].step = 'AWAITING_MODO_CONSULTA';
    userStates[from].operacion = 'deuda';
    console.log(`📝 Esperando elección de modo (DNI vs Servicio) para deuda de ${from}`);
    
  } catch (error) {
    console.error('❌ Error en handleConsultarDeuda:', error);
    const errorMsg = '❌ Ocurrió un error al procesar tu solicitud. Por favor intenta más tarde.';
    await sendMessageAndSave(from, errorMsg);
    await sendMenuList(from, true);
  }
};

/**
 * Manejar solicitud de boleto
 */
const handlePedirBoleto = async (from) => {
  try {
    const preguntaMsg = `📄 *¿Cómo querés obtener tu boleto?*

_📌 En cualquier momento, escribí *SALIR* para volver al menú principal._`;
    await sendMessageAndSave(from, preguntaMsg);

    const buttons = [
      { id: 'modo_dni', title: '🆔 Por DNI' },
      { id: 'modo_padron', title: '📋 Por Servicio' },
      { id: 'volver_menu', title: '↩️ Volver' }
    ];

    await sendButtonReplyAndSave(
      from,
      'Elegí una opción:',
      buttons
    );

    userStates[from].step = 'AWAITING_MODO_CONSULTA';
    userStates[from].operacion = 'boleto';
    console.log(`📝 Esperando elección de modo (DNI vs Servicio) para boleto de ${from}`);
    
  } catch (error) {
    console.error('❌ Error en handlePedirBoleto:', error);
    const errorMsg = '❌ Ocurrió un error al procesar tu solicitud. Por favor intenta más tarde.';
    await sendMessageAndSave(from, errorMsg);
    await sendMenuList(from, true);
  }
};

/**
 * Manejar input de DNI (AWAITING_DNI)
 */
const handleDniInput = async (from, messageBody) => {
  try {
    const lower = messageBody.toLowerCase().trim();
    
    // Permitir volver al menú
    if (lower === 'volver' || lower === 'menu' || lower === 'salir' || lower === 'cancelar') {
      await sendMenuList(from, true);
      userStates[from].step = 'MAIN_MENU';
      return;
    }
    
    // Validar que sea solo números
    const dni = messageBody.replace(/\D/g, ''); // Eliminar todo lo que no sea número
    
    if (!dni || dni.length < 7 || dni.length > 11) {
      const errorMsg = '⚠️ Por favor ingresa un DNI o CUIT válido (7 a 11 dígitos numéricos).\n\n_Ejemplo: 12345678_\n\n_📝 Para cancelar, escribí *SALIR*_';
      await sendMessageAndSave(from, errorMsg);
      return;
    }
    
    // Guardar DNI en BD
    await clienteService.actualizarDni(from, dni);
    
    const confirmMsg = `✅ DNI *${dni}* vinculado correctamente a tu WhatsApp.\n\n🔍 Iniciando consulta de deuda...`;
    await sendMessageAndSave(from, confirmMsg);
    
    // Ejecutar scraper
    await ejecutarScraper(from, dni);
    
  } catch (error) {
    console.error('❌ Error en handleDniInput:', error);
    const errorMsg = '❌ Ocurrió un error al vincular tu DNI. Por favor intenta más tarde.';
    await sendMessageAndSave(from, errorMsg);
    await sendMenuList(from, true);
  }
};

/**
 * Manejar input de DNI para boleto (AWAITING_DNI_BOLETO)
 */
const handleDniInputBoleto = async (from, messageBody) => {
  try {
    const lower = messageBody.toLowerCase().trim();
    
    // Permitir volver al menú
    if (lower === 'volver' || lower === 'menu' || lower === 'salir' || lower === 'cancelar') {
      await sendMenuList(from, true);
      userStates[from].step = 'MAIN_MENU';
      return;
    }
    
    // Validar que sea solo números
    const dni = messageBody.replace(/\D/g, ''); // Eliminar todo lo que no sea número
    
    if (!dni || dni.length < 7 || dni.length > 11) {
      const errorMsg = '⚠️ Por favor ingresa un DNI o CUIT válido (7 a 11 dígitos numéricos).\n\n_Ejemplo: 12345678_\n\n_📝 Para cancelar, escribí *SALIR*_';
      await sendMessageAndSave(from, errorMsg);
      return;
    }
    
    // Guardar DNI en BD
    await clienteService.actualizarDni(from, dni);
    
    const confirmMsg = `✅ DNI *${dni}* vinculado correctamente a tu WhatsApp.\n\n📄 *Seleccioná el tipo de boleto:*`;
    await sendMessageAndSave(from, confirmMsg);
    
    // Preguntar tipo de cuota
    const buttons = [
      { id: 'cuota_anual', title: '📅 Cuota Anual' },
      { id: 'cuota_bimestral', title: '📆 Cuota Bimestral' },
      { id: 'volver_menu', title: '↩️ Volver' }
    ];
    
    await sendButtonReplyAndSave(
      from,
      'Elige el tipo de cuota:',
      buttons
    );
    
    // Guardar DNI en estado temporal
    userStates[from].tempDni = dni;
    userStates[from].step = 'AWAITING_TIPO_CUOTA';
    
  } catch (error) {
    console.error('❌ Error en handleDniInputBoleto:', error);
    const errorMsg = '❌ Ocurrió un error al vincular tu DNI. Por favor intenta más tarde.';
    await sendMessageAndSave(from, errorMsg);
    await sendMenuList(from, true);
  }
};

/**
 * Manejar selección de tipo de cuota
 */
const handleTipoCuota = async (from, option) => {
  try {
    // Permitir volver al menú
    if (option === 'volver_menu') {
      await sendMenuList(from, true);
      userStates[from].step = 'MAIN_MENU';
      delete userStates[from].tempDni;
      return;
    }
    
    const dni = userStates[from].tempDni;
    
    if (!dni) {
      const errorMsg = '❌ Ocurrió un error. Por favor intenta nuevamente.';
      await sendMessageAndSave(from, errorMsg);
      await sendMenuList(from, true);
      return;
    }
    
    let tipoCuota = null;
    let tipoCuotaTexto = '';
    
    if (option === 'cuota_anual') {
      tipoCuota = 'anual';
      tipoCuotaTexto = '📅 Cuota Anual';
      
      // 💾 GUARDAR la selección del usuario en BD y emitir al frontend
      const mensajeGuardado = await mensajeService.guardarMensaje({
        telefono: from,
        tipo: 'interactive',
        cuerpo: tipoCuotaTexto,
        emisor: 'usuario',
        url_archivo: null
      });
      
      if (global.io) {
        global.io.emit('nuevo_mensaje', {
          id: mensajeGuardado.id,
          telefono: from,
          mensaje: tipoCuotaTexto,
          emisor: 'usuario',
          tipo: 'interactive',
          timestamp: mensajeGuardado.fecha
        });
      }
    } else if (option === 'cuota_bimestral') {
      tipoCuota = 'bimestral';
      tipoCuotaTexto = '📆 Cuota Bimestral';
      
      // 💾 GUARDAR la selección del usuario en BD y emitir al frontend
      const mensajeGuardado = await mensajeService.guardarMensaje({
        telefono: from,
        tipo: 'interactive',
        cuerpo: tipoCuotaTexto,
        emisor: 'usuario',
        url_archivo: null
      });
      
      if (global.io) {
        global.io.emit('nuevo_mensaje', {
          id: mensajeGuardado.id,
          telefono: from,
          mensaje: tipoCuotaTexto,
          emisor: 'usuario',
          tipo: 'interactive',
          timestamp: mensajeGuardado.fecha
        });
      }
    } else {
      const errorMsg = '❌ Opción no válida. Por favor intenta nuevamente.';
      await sendMessageAndSave(from, errorMsg);
      await sendMenuList(from, true);
      return;
    }
    
    const searchingMsg = `📄 Generando boleto de *${tipoCuotaTexto}* para el DNI *${dni}*...\n\n⏳ Aguarda unos segundos mientras procesamos la solicitud.`;
    await sendMessageAndSave(from, searchingMsg);
    
    // Ejecutar scraper con tipo de cuota
    await ejecutarScraperBoleto(from, dni, tipoCuota);

    // Limpiar DNI temporal (el estado final lo maneja ejecutarScraperBoletoPadron)
    delete userStates[from].tempDni;
    
  } catch (error) {
    console.error('❌ Error en handleTipoCuota:', error);
    const errorMsg = '❌ Ocurrió un error al generar el boleto. Por favor intenta más tarde.';
    await sendMessageAndSave(from, errorMsg);
    await sendMenuList(from, true);
  }
};

/**
 * Manejar selección de tipo de cuota para padrón (boleto)
 */
const handleTipoCuotaPadron = async (from, option) => {
  try {
    // Permitir volver al menú
    if (option === 'volver_menu') {
      await sendMenuList(from, true);
      userStates[from].step = 'MAIN_MENU';
      delete userStates[from].tempPadron;
      delete userStates[from].tempTipoPadron;
      return;
    }
    
    const padronData = userStates[from].tempPadron;
    const tipoPadron = userStates[from].tempTipoPadron;
    
    if (!padronData || !tipoPadron) {
      const errorMsg = '❌ Ocurrió un error. Por favor intenta nuevamente.';
      await sendMessageAndSave(from, errorMsg);
      await sendMenuList(from, true);
      return;
    }
    
    let tipoCuota = null;
    let tipoCuotaTexto = '';
    
    if (option === 'cuota_anual') {
      tipoCuota = 'anual';
      tipoCuotaTexto = '📅 Cuota Anual';
      
      // 💾 GUARDAR la selección del usuario en BD y emitir al frontend
      const mensajeGuardado = await mensajeService.guardarMensaje({
        telefono: from,
        tipo: 'interactive',
        cuerpo: tipoCuotaTexto,
        emisor: 'usuario',
        url_archivo: null
      });
      
      if (global.io) {
        global.io.emit('nuevo_mensaje', {
          id: mensajeGuardado.id,
          telefono: from,
          mensaje: tipoCuotaTexto,
          emisor: 'usuario',
          tipo: 'interactive',
          timestamp: mensajeGuardado.fecha
        });
      }
    } else if (option === 'cuota_bimestral') {
      tipoCuota = 'bimestral';
      tipoCuotaTexto = '📆 Cuota Bimestral';
      
      // 💾 GUARDAR la selección del usuario en BD y emitir al frontend
      const mensajeGuardado = await mensajeService.guardarMensaje({
        telefono: from,
        tipo: 'interactive',
        cuerpo: tipoCuotaTexto,
        emisor: 'usuario',
        url_archivo: null
      });
      
      if (global.io) {
        global.io.emit('nuevo_mensaje', {
          id: mensajeGuardado.id,
          telefono: from,
          mensaje: tipoCuotaTexto,
          emisor: 'usuario',
          tipo: 'interactive',
          timestamp: mensajeGuardado.fecha
        });
      }
    } else {
      const errorMsg = '❌ Opción no válida. Por favor intenta nuevamente.';
      await sendMessageAndSave(from, errorMsg);
      await sendMenuList(from, true);
      return;
    }
    
    const searchingMsg = `📄 Generando boleto de ${tipoCuotaTexto} para padrón *${padronData}*...\n\n⏳ Aguarda unos segundos mientras procesamos la solicitud.`;
    await sendMessageAndSave(from, searchingMsg);
    
    // Ejecutar scraper con padrón y tipo de cuota
    await ejecutarScraperBoletoPadron(from, padronData, tipoPadron, tipoCuota);
    
    // El estado se define dentro de ejecutarScraperBoletoPadron
    
  } catch (error) {
    console.error('❌ Error en handleTipoCuotaPadron:', error);
    const errorMsg = '❌ Ocurrió un error al generar el boleto. Por favor intenta más tarde.';
    await sendMessageAndSave(from, errorMsg);
    await sendMenuList(from, true);
  }
};

/**
 * Manejar descarga de boleto (a demanda)
 */
const handleDescargarBoleto = async (from) => {
  try {
    const fs = require('fs');
    
    // Recuperar pdfPath del estado
    const pdfPath = userStates[from]?.tempPdf;
    
    if (!pdfPath) {
      const noPdfMsg = '⚠️ No hay ningún boleto disponible.\n\nPor favor realiza una nueva consulta de deuda.';
      await sendMessageAndSave(from, noPdfMsg);
      await sendMenuList(from, true);
      return;
    }
    
    // Verificar si el archivo existe
    if (!fs.existsSync(pdfPath)) {
      const expiredMsg = '⚠️ El boleto ha expirado o ya fue descargado.\n\nPor favor realiza una nueva consulta.';
      await sendMessageAndSave(from, expiredMsg);
      
      // Limpiar estado
      delete userStates[from].tempPdf;
      
      await sendMenuList(from, true);
      return;
    }
    
    // Enviar mensaje de procesamiento
    const sendingMsg = '📤 Enviando boleto de pago...';
    await sendMessageAndSave(from, sendingMsg);
    
    // Subir PDF a WhatsApp
    const mediaId = await whatsappService.uploadMedia(pdfPath, 'application/pdf');

    const nombrePersona = await resolveNombrePersona(from);
    const fileNameForDelivery = buildBoletoPdfFileName({
      tipoBoleto: 'deuda',
      nombrePersona,
      createdAt: new Date()
    });
    
    // Enviar documento
    await whatsappService.sendDocument(
      from,
      mediaId,
      fileNameForDelivery,
      `Boleto de pago - ${nombrePersona}`
    );
    
    console.log(`📄 PDF enviado a ${from}`);
    
    const retainedPdfUrl = await saveBoletoPublicCopy(pdfPath, fileNameForDelivery);

    // 💾 GUARDAR el PDF en BD y emitir al frontend
    const mensajeGuardado = await mensajeService.guardarMensaje({
      telefono: from,
      tipo: 'document',
      cuerpo: `Boleto de pago - ${nombrePersona}`,
      url_archivo: retainedPdfUrl,
      emisor: 'bot'
    });
    
    // Emitir al frontend via Socket.IO
    if (global.io) {
      global.io.emit('nuevo_mensaje', {
        id: mensajeGuardado.id,
        telefono: from,
        mensaje: fileNameForDelivery,
        emisor: 'bot',
        tipo: 'document',
        url_archivo: retainedPdfUrl,
        timestamp: mensajeGuardado.fecha
      });
    }
    
    // Eliminar archivo temporal
    fs.unlinkSync(pdfPath);
    delete userStates[from].tempPdf;
    console.log(`🗑️ PDF eliminado: ${pdfPath}`);
    
    const successMsg = '✅ Boleto enviado correctamente.\n\n¿Necesitas algo más?';
    await sendMessageAndSave(from, successMsg);
    await sendMenuList(from, true);
    
  } catch (error) {
    console.error('❌ Error al enviar boleto:', error);
    const errorMsg = '❌ Ocurrió un error al enviar el boleto. Por favor intenta más tarde.';
    await sendMessageAndSave(from, errorMsg);
    await sendMenuList(from, true);
  }
};

/**
 * Manejar opción posterior a consulta de deuda (Pedir boleto / Volver)
 */
const handlePostDeudaBoletoChoice = async (from, option) => {
  try {
    if (option === 'volver_menu') {
      await sendMenuList(from, true);
      userStates[from].step = 'MAIN_MENU';
      return;
    }

    if (option !== 'pedir_boleto') {
      const invalidMsg = '❌ Opción no válida. Por favor elegí una opción del menú.';
      await sendMessageAndSave(from, invalidMsg);
      return;
    }

    const preguntaMsg = `📄 *Selecciona el tipo de boleto que deseas generar:*`;
    await sendMessageAndSave(from, preguntaMsg);

    const buttons = [
      { id: 'cuota_anual', title: '📅 Cuota Anual' },
      { id: 'cuota_bimestral', title: '📆 Cuota Bimestral' }
    ];

    await sendButtonReplyAndSave(
      from,
      'Elige el tipo de cuota:',
      buttons
    );

    if (userStates[from].tempPadron && userStates[from].tempTipoPadron) {
      userStates[from].step = 'AWAITING_TIPO_CUOTA_PADRON';
    } else if (userStates[from].tempDni) {
      userStates[from].step = 'AWAITING_TIPO_CUOTA';
    } else {
      const errorMsg = '❌ Ocurrió un error. Por favor intenta nuevamente.';
      await sendMessageAndSave(from, errorMsg);
      await sendMenuList(from, true);
      userStates[from].step = 'MAIN_MENU';
    }
  } catch (error) {
    console.error('❌ Error en handlePostDeudaBoletoChoice:', error);
    const errorMsg = '❌ Ocurrió un error al procesar tu solicitud. Por favor intenta más tarde.';
    await sendMessageAndSave(from, errorMsg);
    await sendMenuList(from, true);
  }
};

/**
 * Ejecutar scraper y enviar resultado (OPTIMIZADO)
 */
const parsePadronFromHyphen = (padron) => {
  const normalized = String(padron || '').trim();
  const [codigo1, codigo2] = normalized.split('-').map((part) => (part || '').trim());

  if (!codigo1 || !codigo2) {
    return null;
  }

  return {
    codigo1,
    codigo2,
    padronTexto: `${codigo1} ${codigo2}`,
    padronDisplay: `${codigo1}-${codigo2}`
  };
};

const obtenerPadronDesdeDni = async (dni) => {
  console.log(`🧭 [FLOW] Traduciendo DNI/CUIT a padrón vía API: ${dni}`);
  const traduccion = await debtApiService.traducirDniAPadron(dni);

  if (!traduccion.success) {
    return {
      success: false,
      userMessage: traduccion.message || 'No se encontraron padrones para este DNI.'
    };
  }

  if (traduccion.multiple) {
    const opciones = (traduccion.opciones || []).slice(0, 10);
    const listado = opciones
      .map((opt, idx) => `${idx + 1}. ${opt.padron} - ${opt.descripcion}`)
      .join('\n');

    return {
      success: false,
      userMessage:
        `ℹ️ Encontramos más de un servicio para ese DNI:\n\n${listado}\n\n` +
        `Para continuar, por favor consultá por *Servicio* (padrón) desde el menú.`
    };
  }

  const parsed = parsePadronFromHyphen(traduccion.padron);
  if (!parsed) {
    return {
      success: false,
      userMessage: '❌ No se pudo interpretar el padrón devuelto para este DNI.'
    };
  }

  return {
    success: true,
    tipoPadron: 'superficial',
    titular: traduccion.titular || 'No disponible',
    ...parsed
  };
};

const ejecutarScraper = async (from, dni) => {
  try {
    const traduccion = await obtenerPadronDesdeDni(dni);

    if (!traduccion.success) {
      await sendMessageAndSave(from, `⚠️ ${traduccion.userMessage}`);
      await sendMenuList(from, true);
      userStates[from].step = 'MAIN_MENU';
      return;
    }

    console.log(`✅ [FLOW] DNI ${dni} traducido a padrón ${traduccion.padronDisplay}`);

    const clienteMock = {
      padron_superficial: traduccion.padronTexto
    };

    await ejecutarScraperPadron(from, clienteMock, traduccion.tipoPadron, 'deuda');
    userStates[from].tempDni = dni;
    
  } catch (error) {
    console.error('❌ Error en ejecutarScraper:', error);
    const errorMsg = '❌ Ocurrió un error al consultar la deuda. Por favor intenta más tarde.';
    await sendMessageAndSave(from, errorMsg);
    await sendMenuList(from, true);
  }
};

/**
 * Ejecutar scraper solo para descargar boleto
 */
const ejecutarScraperBoleto = async (from, dni, tipoCuota) => {
  try {
    const traduccion = await obtenerPadronDesdeDni(dni);

    if (!traduccion.success) {
      await sendMessageAndSave(from, `⚠️ ${traduccion.userMessage}`);
      await sendMenuList(from, true);
      return;
    }

    console.log(`✅ [FLOW] DNI ${dni} traducido a padrón ${traduccion.padronDisplay} para boleto`);
    await ejecutarScraperBoletoPadron(from, traduccion.padronTexto, traduccion.tipoPadron, tipoCuota);
    
  } catch (error) {
    console.error('❌ Error en ejecutarScraperBoleto:', error);
    const errorMsg = '❌ Ocurrió un error al generar el boleto. Por favor intenta más tarde.';
    await sendMessageAndSave(from, errorMsg);
    await sendMenuList(from, true);
  }
};

/**
 * Envía un mensaje a WhatsApp Y lo guarda en la BD automáticamente
 * @param {string} telefono - Número destino
 * @param {string} mensaje - Contenido del mensaje
 * @param {string} tipo - Tipo de mensaje ('text', 'interactivo', etc.)
 */
const sendMessageAndSave = async (telefono, mensaje, tipo = 'text') => {
  try {
    // 1. Enviar a WhatsApp
    await whatsappService.sendMessage(telefono, mensaje);
    
    // 2. Guardar en BD (retorna el objeto con ID)
    const mensajeGuardado = await mensajeService.guardarMensaje({
      telefono,
      tipo,
      cuerpo: mensaje,
      emisor: 'bot',
      url_archivo: null
    });
    
    // 3. Emitir evento Socket.io CON EL ID DEL MENSAJE
    if (global.io) {
      global.io.emit('nuevo_mensaje', {
        id: mensajeGuardado.id, // ✅ INCLUIR ID DEL MENSAJE
        telefono,
        mensaje,
        emisor: 'bot',
        tipo,
        timestamp: mensajeGuardado.fecha
      });
    }
    
    console.log(`✅ Mensaje enviado y guardado: ${telefono} (ID: ${mensajeGuardado.id})`);
    return true;
  } catch (error) {
    console.error('❌ Error en sendMessageAndSave:', error);
    throw error;
  }
};

const buildActionFailedMessage = (actionLabel) => {
  return `❌ No se pudo ${actionLabel} en este momento.\n\nPor favor intentá nuevamente en unos minutos.`;
};

const buildTurnoLookupFailedMessage = (inputLabel, detail = '') => {
  const detailLine = detail ? `${detail}\n\n` : '';
  return `❌ No se pudo consultar el turno.\n\n${detailLine}Podés reintentar ingresando ${inputLabel} nuevamente o escribir *volver*.`;
};

const formatInicioTurno = (data = {}) => {
  let inicioTurno = data.inicioTurno || 'No disponible';
  if (data.fechaInicioCompleta) {
    const fechaMatch = data.fechaInicioCompleta.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
    if (fechaMatch) {
      inicioTurno = `${data.inicioTurno || 'No disponible'} (${fechaMatch[1]})`;
    }
  }
  return inicioTurno;
};

const resolveInspeccionContact = (inspeccion = '') => {
  const normalized = normalizeSingleLine(inspeccion).toLowerCase();
  if (!normalized) return TURNOS_CONTACTO_INSPECCION_DEFAULT;

  for (const [key, contact] of Object.entries(TURNOS_CONTACTOS_POR_INSPECCION)) {
    if (normalized.includes(key)) return contact;
  }

  return TURNOS_CONTACTO_INSPECCION_DEFAULT;
};

const buildTurnoResponse = ({ data = {}, titularFallback = 'No disponible', ccppFallback = 'No disponible', includeHijuela = true }) => {
  const inspeccion = data.inspeccion || 'No disponible';
  const titular = data.titular || titularFallback;
  const hijuela = data.hijuela || 'No disponible';
  const ccpp = data.ccpp || ccppFallback;
  const inicioTurnoFormato = formatInicioTurno(data);
  const finTurnoFormato = data.finTurno || 'No disponible';

  if (data.restringido) {
    const contactoInspeccion = resolveInspeccionContact(inspeccion);
    const hijuelaLine = includeHijuela ? `\n• Hijuela: ${hijuela}` : '';

    return `🚫 *Estado del turno: RESTRINGIDO*\n\n` +
      `⚠️ El turno figura como restringido para este servicio.\n\n` +
      `• Titular: ${titular}\n` +
      `• Inspección de cauce: ${inspeccion}${hijuelaLine}\n\n` +
      `Si creés que es un error, comunicate con la inspección de cauce:\n` +
      `📞/✉️ ${contactoInspeccion}`;
  }

  const tomero1 = data.telAmaya || 'No disponible';
  const tomero2 = data.telContreras || 'No disponible';

  return `✅ *Turno encontrado*\n\n` +
    `• Inspección de cauce: ${inspeccion}${includeHijuela ? `\n• Hijuela: ${hijuela}` : ''}\n` +
    `• C.C.-P.P.: ${ccpp}\n` +
    `• Titular: ${titular}\n` +
    `• Inicio de turno: ${inicioTurnoFormato}\n` +
    `• Fin de turno: ${finTurnoFormato}\n` +
    `• Tomero 1: ${tomero1}\n` +
    `• Tomero 2: ${tomero2}`;
};

/**
 * Manejar selección de método de consulta (DNI vs Padrón)
 */
const handleModoConsulta = async (from, option) => {
  try {
    const operacion = userStates[from].operacion || 'deuda';

    if (option === 'volver_menu') {
      await sendMenuList(from, true);
      userStates[from].step = 'MAIN_MENU';
      return;
    }
    
    if (option === 'modo_dni') {
      const cliente = await clienteService.obtenerCliente(from);
      const ultimoDni = cliente?.padron || null;
      console.log(`🧠 [MEMORIA][DNI] Último DNI en BD para ${from}: ${ultimoDni || 'sin dato'}`);

      if (ultimoDni) {
        const msg = `🆔 *Último DNI consultado:* *${ultimoDni}*\n\n¿Querés usar este DNI o ingresar uno nuevo?`;
        await sendMessageAndSave(from, msg);

        const buttons = [
          { id: 'usar_ultimo_dni', title: '✅ Usar último DNI' },
          { id: 'ingresar_nuevo_dni', title: '📝 DNI nuevo' },
          { id: 'volver_menu', title: '↩️ Volver' }
        ];

        await sendButtonReplyAndSave(from, 'Elegí una opción:', buttons);
        userStates[from].ultimoDni = ultimoDni;
        userStates[from].step = 'AWAITING_DNI_CHOICE';
      } else {
        const msg = '🆔 *Ingresá tu número de DNI/CUIT* (sin puntos ni espacios)\n\nEj: 12345678\n\n_📝 Para volver al menú, escribí *SALIR*._';
        await sendMessageAndSave(from, msg);

        if (operacion === 'boleto') {
          userStates[from].step = 'AWAITING_DNI_BOLETO';
        } else {
          userStates[from].step = 'AWAITING_DNI';
        }
      }
      console.log(`📝 Flujo DNI iniciado para ${operacion} de ${from}`);
      
    } else if (option === 'modo_padron') {
      const cliente = await clienteService.obtenerCliente(from);
      const padronSuperficial = cliente?.padron_superficial || '';
      const padronSubterraneo = cliente?.padron_subterraneo || '';
      const padronContaminacion = cliente?.padron_contaminacion || '';

      userStates[from].padronesGuardados = {
        superficial: padronSuperficial,
        subterraneo: padronSubterraneo,
        contaminacion: padronContaminacion
      };

      const tieneGuardado = Boolean(padronSuperficial || padronSubterraneo || padronContaminacion);

      if (tieneGuardado) {
        const padronesDetalle = [
          padronSuperficial ? `• Superficial: *${padronSuperficial}*` : null,
          padronSubterraneo ? `• Subterráneo: *${padronSubterraneo}*` : null,
          padronContaminacion ? `• Contaminación: *${padronContaminacion}*` : null
        ].filter(Boolean).join('\n');

        const msg = `📋 Encontramos padrón/es guardado/s:\n${padronesDetalle}\n\n¿Querés usar uno guardado o cambiarlo?`;
        await sendMessageAndSave(from, msg);

        const buttons = [
          { id: 'usar_padron_guardado', title: '✅ Usar guardado' },
          { id: 'cambiar_padron', title: '📝 Cambiar padrón' },
          { id: 'volver_menu', title: '↩️ Volver' }
        ];

        await sendButtonReplyAndSave(from, 'Elegí una opción:', buttons);
        userStates[from].step = 'AWAITING_PADRON_GLOBAL_CHOICE';
      } else {
        const msg = '📋 *Seleccioná el tipo de servicio:*';
        await sendMessageAndSave(from, msg);

        const buttons = [
          { id: 'tipo_padron_a', title: '🌾 A) Superficial' },
          { id: 'tipo_padron_b', title: '💧 B) Subterráneo' },
          { id: 'tipo_padron_c', title: '🛢️ C) Contaminación' }
        ];

        await sendButtonReplyAndSave(from, 'Elegí una opción:', buttons);
        userStates[from].step = 'AWAITING_TIPO_PADRON';
      }

      console.log(`📝 Flujo padrón invertido iniciado para ${operacion} de ${from}`);
    }
  } catch (error) {
    console.error('❌ Error en handleModoConsulta:', error);
    const errorMsg = '❌ Ocurrió un error. Por favor intenta de nuevo.';
    await sendMessageAndSave(from, errorMsg);
  }
};

const handleDniChoice = async (from, option) => {
  try {
    const operacion = userStates[from].operacion || 'deuda';

    if (option === 'volver_menu') {
      await sendMenuList(from, true);
      userStates[from].step = 'MAIN_MENU';
      delete userStates[from].ultimoDni;
      return;
    }

    if (option === 'usar_ultimo_dni') {
      const dni = userStates[from].ultimoDni;

      if (!dni) {
        await sendMessageAndSave(from, '❌ No encontramos un DNI previo para reutilizar.');
        await sendMenuList(from, true);
        userStates[from].step = 'MAIN_MENU';
        return;
      }

      if (operacion === 'boleto') {
        await sendMessageAndSave(from, `✅ Usando DNI guardado: *${dni}*`);
        userStates[from].tempDni = dni;
        const preguntaMsg = `📄 *Seleccioná el tipo de boleto que querés generar:*`;
        await sendMessageAndSave(from, preguntaMsg);

        const buttons = [
          { id: 'cuota_anual', title: '📅 Cuota Anual' },
          { id: 'cuota_bimestral', title: '📆 Cuota Bimestral' },
          { id: 'volver_menu', title: '↩️ Volver' }
        ];

        await sendButtonReplyAndSave(from, 'Elegí el tipo de cuota:', buttons);
        userStates[from].step = 'AWAITING_TIPO_CUOTA';
      } else {
        await sendMessageAndSave(from, `✅ Usando DNI guardado: *${dni}*`);
        const searchingMsg = `🔍 Consultando deuda para el DNI *${dni}*...\n\n⏳ Aguarda unos segundos mientras procesamos la solicitud.`;
        await sendMessageAndSave(from, searchingMsg);
        await ejecutarScraper(from, dni);
      }

      delete userStates[from].ultimoDni;
      return;
    }

    if (option === 'ingresar_nuevo_dni') {
      const msg = '🆔 *Ingresá tu número de DNI/CUIT* (sin puntos ni espacios)\n\nEj: 12345678\n\n_📝 Para volver al menú, escribí *SALIR*._';
      await sendMessageAndSave(from, msg);

      if (operacion === 'boleto') {
        userStates[from].step = 'AWAITING_DNI_BOLETO';
      } else {
        userStates[from].step = 'AWAITING_DNI';
      }
      return;
    }

    await sendMessageAndSave(from, '❌ Opción no válida. Elegí una de las opciones disponibles.');
  } catch (error) {
    console.error('❌ Error en handleDniChoice:', error);
    await sendMessageAndSave(from, '❌ Ocurrió un error. Por favor intentá nuevamente.');
    await sendMenuList(from, true);
    userStates[from].step = 'MAIN_MENU';
  }
};

const handlePadronGlobalChoice = async (from, option) => {
  try {
    const operacion = userStates[from].operacion || 'deuda';
    const guardados = userStates[from].padronesGuardados || {};
    const disponibles = [
      { tipo: 'superficial', valor: guardados.superficial },
      { tipo: 'subterraneo', valor: guardados.subterraneo },
      { tipo: 'contaminacion', valor: guardados.contaminacion }
    ].filter((item) => item.valor);

    if (option === 'volver_menu') {
      await sendMenuList(from, true);
      userStates[from].step = 'MAIN_MENU';
      delete userStates[from].padronesGuardados;
      return;
    }

    if (option === 'cambiar_padron') {
      const msg = '📋 *Seleccioná el tipo de servicio:*';
      await sendMessageAndSave(from, msg);

      const buttons = [
        { id: 'tipo_padron_a', title: '🌾 A) Superficial' },
        { id: 'tipo_padron_b', title: '💧 B) Subterráneo' },
        { id: 'tipo_padron_c', title: '🛢️ C) Contaminación' }
      ];

      await sendButtonReplyAndSave(from, 'Elegí una opción:', buttons);
      userStates[from].step = 'AWAITING_TIPO_PADRON';
      return;
    }

    const ejecutarConPadronGuardado = async (tipoPadron, padronValor) => {
      userStates[from].tempTipoPadron = tipoPadron;
      userStates[from].tempPadron = padronValor;

      if (operacion === 'boleto') {
        const preguntaMsg = `📄 *Seleccioná el tipo de boleto que querés generar:*`;
        await sendMessageAndSave(from, preguntaMsg);

        const buttons = [
          { id: 'cuota_anual', title: '📅 Cuota Anual' },
          { id: 'cuota_bimestral', title: '📆 Cuota Bimestral' },
          { id: 'volver_menu', title: '↩️ Volver' }
        ];

        await sendButtonReplyAndSave(from, 'Elegí el tipo de cuota:', buttons);
        userStates[from].step = 'AWAITING_TIPO_CUOTA_PADRON';
      } else {
        const clienteMock = {
          padron_superficial: tipoPadron === 'superficial' ? padronValor : '',
          padron_subterraneo: tipoPadron === 'subterraneo' ? padronValor : '',
          padron_contaminacion: tipoPadron === 'contaminacion' ? padronValor : ''
        };
        await ejecutarScraperPadron(from, clienteMock, tipoPadron, 'deuda');
      }

      delete userStates[from].padronesGuardados;
    };

    if (option === 'usar_padron_guardado') {
      if (!disponibles.length) {
        await sendMessageAndSave(from, 'ℹ️ No encontramos padrones guardados para usar.');
        await sendMenuList(from, true);
        userStates[from].step = 'MAIN_MENU';
        return;
      }

      if (disponibles.length === 1) {
        await ejecutarConPadronGuardado(disponibles[0].tipo, disponibles[0].valor);
        return;
      }

      const msg = '📋 Tenés más de un padrón guardado. Elegí cuál querés usar:';
      await sendMessageAndSave(from, msg);

      const buttons = [];
      if (guardados.superficial) buttons.push({ id: 'usar_guardado_superficial', title: '🌾 A) Superficial' });
      if (guardados.subterraneo) buttons.push({ id: 'usar_guardado_subterraneo', title: '💧 B) Subterráneo' });
      if (guardados.contaminacion) buttons.push({ id: 'usar_guardado_contaminacion', title: '🛢️ C) Contaminación' });

      await sendButtonReplyAndSave(from, 'Elegí una opción:', buttons.slice(0, 3));
      userStates[from].step = 'AWAITING_PADRON_GLOBAL_CHOICE';
      return;
    }

    if (option === 'usar_guardado_superficial' && guardados.superficial) {
      await ejecutarConPadronGuardado('superficial', guardados.superficial);
      return;
    }

    if (option === 'usar_guardado_subterraneo' && guardados.subterraneo) {
      await ejecutarConPadronGuardado('subterraneo', guardados.subterraneo);
      return;
    }

    if (option === 'usar_guardado_contaminacion' && guardados.contaminacion) {
      await ejecutarConPadronGuardado('contaminacion', guardados.contaminacion);
      return;
    }

    await sendMessageAndSave(from, '❌ Opción no válida. Elegí una de las opciones disponibles.');
  } catch (error) {
    console.error('❌ Error en handlePadronGlobalChoice:', error);
    await sendMessageAndSave(from, '❌ Ocurrió un error. Por favor intentá nuevamente.');
    await sendMenuList(from, true);
    userStates[from].step = 'MAIN_MENU';
  }
};

/**
 * Manejar selección de tipo de servicio (A, B o C)
 */
const handleTipoPadron = async (from, option) => {
  try {
    const operacion = userStates[from].operacion || 'deuda';
    let tipoSeleccionado = '';
    
    if (option === 'tipo_padron_a') {
      tipoSeleccionado = 'superficial';
      
    } else if (option === 'tipo_padron_b') {
      tipoSeleccionado = 'subterraneo';
      
    } else if (option === 'tipo_padron_c') {
      tipoSeleccionado = 'contaminacion';
    }

    if (!tipoSeleccionado) {
      await sendMessageAndSave(from, '❌ Opción no válida. Elegí una opción del menú.');
      return;
    }

    userStates[from].tempTipoPadron = tipoSeleccionado;

    if (tipoSeleccionado === 'superficial') {
      const msg = '🌾 *A - Superficial*\n\nIngresá: *Código de cauce* y *Padrón parcial*\n\n_Formato: código de cauce (espacio) padrón parcial_\n\nEj: 8234 1710\n\n_📝 Para volver al menú, escribí *SALIR*._';
      await sendMessageAndSave(from, msg);
      userStates[from].step = 'AWAITING_PADRON_SUPERFICIAL';
    } else if (tipoSeleccionado === 'subterraneo') {
      const msg = '💧 *B - Subterráneo*\n\nIngresá: *Código Departamento* y *N° de Pozo*\n\n_Formato: código departamento (espacio) número de pozo_\n\nEj: 10 5\n\n_📝 Para volver al menú, escribí *SALIR*._';
      await sendMessageAndSave(from, msg);
      userStates[from].step = 'AWAITING_PADRON_SUBTERRANEO';
    } else {
      const msg = '🛢️ *C - Contaminación*\n\nIngresá solo el *N° de Contaminación* (campo izquierdo)\n\nEj: 12345\n\n_📝 Para volver al menú, escribí *SALIR*._';
      await sendMessageAndSave(from, msg);
      userStates[from].step = 'AWAITING_PADRON_CONTAMINACION';
    }
    
    console.log(`📝 Esperando datos de padrón tipo ${userStates[from].tempTipoPadron} de ${from}`);
  } catch (error) {
    console.error('❌ Error en handleTipoPadron:', error);
    const errorMsg = '❌ Ocurrió un error. Por favor intenta de nuevo.';
    await sendMessageAndSave(from, errorMsg);
  }
};

const handlePadronChoice = async (from, option) => {
  try {
    const operacion = userStates[from].operacion || 'deuda';
    const tipoPadron = userStates[from].tempTipoPadron;
    const ultimoPadron = userStates[from].ultimoPadron;

    if (option === 'volver_menu') {
      await sendMenuList(from, true);
      userStates[from].step = 'MAIN_MENU';
      delete userStates[from].ultimoPadron;
      return;
    }

    if (!tipoPadron) {
      await sendMessageAndSave(from, '❌ No se encontró el tipo de servicio. Intentá nuevamente.');
      await sendMenuList(from, true);
      userStates[from].step = 'MAIN_MENU';
      return;
    }

    if (option === 'ingresar_nuevo_padron') {
      if (tipoPadron === 'superficial') {
        const msg = '🌾 *A - Superficial*\n\nIngresá: *Código de cauce* y *Padrón parcial*\n\n_Formato: código de cauce (espacio) padrón parcial_\n\nEj: 8234 1710\n\n_📝 Para volver al menú, escribí *SALIR*._';
        await sendMessageAndSave(from, msg);
        userStates[from].step = 'AWAITING_PADRON_SUPERFICIAL';
      } else if (tipoPadron === 'subterraneo') {
        const msg = '💧 *B - Subterráneo*\n\nIngresá: *Código Departamento* y *N° de Pozo*\n\n_Formato: código departamento (espacio) número de pozo_\n\nEj: 10 5\n\n_📝 Para volver al menú, escribí *SALIR*._';
        await sendMessageAndSave(from, msg);
        userStates[from].step = 'AWAITING_PADRON_SUBTERRANEO';
      } else {
        const msg = '🛢️ *C - Contaminación*\n\nIngresá solo el *N° de Contaminación* (campo izquierdo)\n\nEj: 12345\n\n_📝 Para volver al menú, escribí *SALIR*._';
        await sendMessageAndSave(from, msg);
        userStates[from].step = 'AWAITING_PADRON_CONTAMINACION';
      }
      return;
    }

    if (option === 'usar_ultimo_padron') {
      if (!ultimoPadron) {
        await sendMessageAndSave(from, '❌ No hay un padrón guardado para este servicio.');
        await sendMenuList(from, true);
        userStates[from].step = 'MAIN_MENU';
        return;
      }

      if (operacion === 'boleto') {
        userStates[from].tempPadron = ultimoPadron;

        const preguntaMsg = `📄 *Seleccioná el tipo de boleto que querés generar:*`;
        await sendMessageAndSave(from, preguntaMsg);

        const buttons = [
          { id: 'cuota_anual', title: '📅 Cuota Anual' },
          { id: 'cuota_bimestral', title: '📆 Cuota Bimestral' },
          { id: 'volver_menu', title: '↩️ Volver' }
        ];

        await sendButtonReplyAndSave(from, 'Elegí el tipo de cuota:', buttons);
        userStates[from].step = 'AWAITING_TIPO_CUOTA_PADRON';
      } else {
        const cliente = await clienteService.obtenerCliente(from);
        await ejecutarScraperPadron(from, cliente, tipoPadron, 'deuda');
      }

      delete userStates[from].ultimoPadron;
      return;
    }

    await sendMessageAndSave(from, '❌ Opción no válida. Elegí una de las opciones disponibles.');
  } catch (error) {
    console.error('❌ Error en handlePadronChoice:', error);
    await sendMessageAndSave(from, '❌ Ocurrió un error. Por favor intentá nuevamente.');
    await sendMenuList(from, true);
    userStates[from].step = 'MAIN_MENU';
  }
};

/**
 * Manejar input de padrón superficial
 */
const handlePadronSuperficial = async (from, messageBody) => {
  try {
    const lower = messageBody.toLowerCase().trim();
    
    // Permitir volver al menú
    if (lower === 'volver' || lower === 'menu' || lower === 'salir' || lower === 'cancelar') {
      await sendMenuList(from, true);
      userStates[from].step = 'MAIN_MENU';
      return;
    }
    
    const operacion = userStates[from].operacion || 'deuda';
    const partes = messageBody.trim().split(/\s+/);
    
    if (partes.length !== 2) {
      const msg = '❌ Formato incorrecto. Por favor ingresa:\n\nCódigo de cauce (espacio) Número de padrón\n\nEj: 8234 1710\n\n_📌 Para cancelar, escribí *SALIR*_';
      await sendMessageAndSave(from, msg);
      return;
    }
    
    const codigoCauce = partes[0];
    const numeroPadron = partes[1];
    
    // Guardar en base de datos
    await clienteService.actualizarPadronSuperficial(from, codigoCauce, numeroPadron);
    console.log(`✅ Padrón superficial guardado: ${from} -> ${codigoCauce} ${numeroPadron}`);
    
    // Ejecutar la operación
    if (operacion === 'deuda') {
      // Consultar deuda con el padrón
      const cliente = await clienteService.obtenerCliente(from);
      await ejecutarScraperPadron(from, cliente, 'superficial', 'deuda');
      
    } else if (operacion === 'boleto') {
      userStates[from].tempPadron = `${codigoCauce} ${numeroPadron}`;
      
      // Preguntar tipo de cuota
      const preguntaMsg = `📄 *Selecciona el tipo de boleto que deseas generar:*`;
      await sendMessageAndSave(from, preguntaMsg);
      
      const buttons = [
        { id: 'cuota_anual', title: '📅 Cuota Anual' },
        { id: 'cuota_bimestral', title: '📆 Cuota Bimestral' },
        { id: 'volver_menu', title: '↩️ Volver' }
      ];
      
      await sendButtonReplyAndSave(from, preguntaMsg, buttons);
      userStates[from].step = 'AWAITING_TIPO_CUOTA_PADRON';
    }
  } catch (error) {
    console.error('❌ Error en handlePadronSuperficial:', error);
    const errorMsg = '❌ Ocurrió un error al procesar tu padrón. Por favor intenta de nuevo.';
    await sendMessageAndSave(from, errorMsg);
    await sendMenuList(from, true);
  }
};

/**
 * Manejar input de padrón subterráneo
 */
const handlePadronSubterraneo = async (from, messageBody) => {
  try {
    const lower = messageBody.toLowerCase().trim();
    
    // Permitir volver al menú
    if (lower === 'volver' || lower === 'menu' || lower === 'salir' || lower === 'cancelar') {
      await sendMenuList(from, true);
      userStates[from].step = 'MAIN_MENU';
      return;
    }
    
    const operacion = userStates[from].operacion || 'deuda';
    const partes = messageBody.trim().split(/\s+/);
    
    if (partes.length !== 2) {
      const msg = '❌ Formato incorrecto. Por favor ingresa:\n\nCódigo de departamento (espacio) Número de pozo\n\nEj: 10 5\n\n_📌 Para cancelar, escribí *SALIR*_';
      await sendMessageAndSave(from, msg);
      return;
    }
    
    const codigoDepartamento = partes[0];
    const numeroPozo = partes[1];
    
    // Guardar en base de datos
    await clienteService.actualizarPadronSubterraneo(from, codigoDepartamento, numeroPozo);
    console.log(`✅ Padrón subterráneo guardado: ${from} -> ${codigoDepartamento} ${numeroPozo}`);
    
    // Ejecutar la operación
    if (operacion === 'boleto') {
      userStates[from].tempPadron = `${codigoDepartamento} ${numeroPozo}`;
      
      // Preguntar tipo de cuota
      const preguntaMsg = `📄 *Selecciona el tipo de boleto que deseas generar:*`;
      await sendMessageAndSave(from, preguntaMsg);
      
      const buttons = [
        { id: 'cuota_anual', title: '📅 Cuota Anual' },
        { id: 'cuota_bimestral', title: '📆 Cuota Bimestral' },
        { id: 'volver_menu', title: '↩️ Volver' }
      ];
      
      await sendButtonReplyAndSave(
        from,
        'Elige el tipo de cuota:',
        buttons
      );
      
      userStates[from].step = 'AWAITING_TIPO_CUOTA_PADRON';
    } else {
      // Operación: deuda - consultar con el padrón guardado
      const cliente = await clienteService.obtenerCliente(from);
      await ejecutarScraperPadron(from, cliente, 'subterraneo', 'deuda');
    }
  } catch (error) {
    console.error('❌ Error en handlePadronSubterraneo:', error);
    const errorMsg = '❌ Ocurrió un error al procesar tu padrón. Por favor intenta de nuevo.';
    await sendMessageAndSave(from, errorMsg);
    await sendMenuList(from, true);
  }
};

/**
 * Manejar input de padrón contaminación
 */
const handlePadronContaminacion = async (from, messageBody) => {
  try {
    const lower = messageBody.toLowerCase().trim();
    
    // Permitir volver al menú
    if (lower === 'volver' || lower === 'menu' || lower === 'salir' || lower === 'cancelar') {
      await sendMenuList(from, true);
      userStates[from].step = 'MAIN_MENU';
      return;
    }
    
    const operacion = userStates[from].operacion || 'deuda';
    const numeroContaminacion = messageBody.trim();
    
    if (!numeroContaminacion || numeroContaminacion.length === 0) {
      const msg = '❌ Por favor ingresa un número de contaminación válido.\n\nEj: 12345\n\n_📌 Para cancelar, escribí *SALIR*_';
      await sendMessageAndSave(from, msg);
      return;
    }
    
    // Guardar en base de datos
    await clienteService.actualizarPadronContaminacion(from, numeroContaminacion);
    console.log(`✅ Padrón contaminación guardado: ${from} -> ${numeroContaminacion}`);
    
    // Ejecutar la operación
    if (operacion === 'boleto') {
      userStates[from].tempPadron = numeroContaminacion;
      
      // Preguntar tipo de cuota
      const preguntaMsg = `📄 *Selecciona el tipo de boleto que deseas generar:*`;
      await sendMessageAndSave(from, preguntaMsg);
      
      const buttons = [
        { id: 'cuota_anual', title: '📅 Cuota Anual' },
        { id: 'cuota_bimestral', title: '📆 Cuota Bimestral' },
        { id: 'volver_menu', title: '↩️ Volver' }
      ];
      
      await sendButtonReplyAndSave(
        from,
        'Elige el tipo de cuota:',
        buttons
      );
      
      userStates[from].step = 'AWAITING_TIPO_CUOTA_PADRON';
    } else {
      // Operación: deuda - consultar con el padrón guardado
      const cliente = await clienteService.obtenerCliente(from);
      await ejecutarScraperPadron(from, cliente, 'contaminacion', 'deuda');
    }
  } catch (error) {
    console.error('❌ Error en handlePadronContaminacion:', error);
    const errorMsg = '❌ Ocurrió un error al procesar tu padrón. Por favor intenta de nuevo.';
    await sendMessageAndSave(from, errorMsg);
    await sendMenuList(from, true);
  }
};

/**
 * Manejar opción de boleto después de consultar deuda con padrón
 */
const handleOpcionBoletoPadron = async (from, option) => {
  try {
    if (option === 'sin_boleto') {
      const msg = '✅ Gracias por tu consulta.';
      await sendMessageAndSave(from, msg);
      await sendMenuList(from, true);
      userStates[from].step = 'MAIN_MENU';
      return;
    }
    
    let tipoCuota = null;
    
    if (option === 'pedir_boleto_anual') {
      tipoCuota = 'anual';
    } else if (option === 'pedir_boleto_bimestral') {
      tipoCuota = 'bimestral';
    } else {
      const errorMsg = '❌ Opción no válida. Por favor intenta nuevamente.';
      await sendMessageAndSave(from, errorMsg);
      return;
    }
    
    const padronData = userStates[from].tempPadron;
    const tipoPadron = userStates[from].tempTipoPadron;
    
    if (!padronData || !tipoPadron) {
      const errorMsg = '❌ Ocurrió un error. Por favor intenta nuevamente.';
      await sendMessageAndSave(from, errorMsg);
      await sendMenuList(from, true);
      return;
    }
    
    // Ejecutar scraper de boleto
    await ejecutarScraperBoletoPadron(from, padronData, tipoPadron, tipoCuota);
    
    userStates[from].step = 'MAIN_MENU';
    delete userStates[from].tempPadron;
    delete userStates[from].tempTipoPadron;
    
  } catch (error) {
    console.error('❌ Error en handleOpcionBoletoPadron:', error);
    const errorMsg = '❌ Ocurrió un error al procesar tu solicitud. Por favor intenta más tarde.';
    await sendMessageAndSave(from, errorMsg);
    await sendMenuList(from, true);
  }
};

/**
 * Ejecutar scraper con padrón (consulta de deuda)
 */
const ejecutarScraperPadron = async (from, cliente, tipoPadron, tipoOperacion = 'deuda') => {
  try {
    let padronData = {};
    let padronRaw = '';
    
    if (tipoPadron === 'superficial') {
      padronRaw = cliente.padron_superficial || '';
      const [codigoCauce, numeroPadron] = padronRaw.split(' ');
      padronData = { codigoCauce, numeroPadron };
    } else if (tipoPadron === 'subterraneo') {
      padronRaw = cliente.padron_subterraneo || '';
      const [codigoDepartamento, numeroPozo] = padronRaw.split(' ');
      padronData = { codigoDepartamento, numeroPozo };
    } else if (tipoPadron === 'contaminacion') {
      padronRaw = cliente.padron_contaminacion || '';
      padronData = { numeroContaminacion: padronRaw };
    }
    
    console.log(`⚙️ Ejecutando scraper de ${tipoOperacion} con padrón ${tipoPadron}:`, padronData);
    
    // Separación de responsabilidades con fallback:
    // - deuda superficial: request directo por API
    // - si la API falla: fallback a scraping
    // - resto de casos: scraping
    let resultado;
    if (tipoOperacion === 'deuda' && tipoPadron === 'superficial') {
      console.log('🧭 [FLOW] Deuda superficial: intentando API directa primero');
      const resultadoApi = await debtApiService.obtenerDeudaPadronSuperficial(padronData);

      if (resultadoApi.success) {
        console.log('✅ [FLOW] Deuda superficial resuelta por API directa');
        resultado = resultadoApi;
      } else {
        console.warn(`⚠️ API de deuda superficial falló, activando fallback scraping: ${resultadoApi.error}`);
        resultado = await debtScraperService.obtenerDeudaPadron(tipoPadron, padronData, tipoOperacion);
        console.log(`🧭 [FLOW] Resultado fallback deuda: ${resultado.success ? 'OK' : 'ERROR'}`);

        if (!resultado.success) {
          resultado.userMessage = resultadoApi.userMessage || resultado.userMessage;
        }
      }
    } else {
      resultado = await debtScraperService.obtenerDeudaPadron(tipoPadron, padronData, tipoOperacion);
    }
    
    if (!resultado.success) {
      await sendMessageAndSave(
        from,
        getServiceErrorMessage(resultado, buildActionFailedMessage('consultar la deuda del servicio'))
      );
      await sendMenuList(from, true);
      userStates[from].step = 'MAIN_MENU';
      return;
    }
    
    // Guardar PDF en estado para poder descargarlo
    if (resultado.absolutePdfPath) {
      userStates[from].tempPdf = resultado.absolutePdfPath;
    }

    // Guardar padrón para posible generación de boleto
    userStates[from].tempPadron = padronRaw;
    userStates[from].tempTipoPadron = tipoPadron;
    
    // Formatear mensaje de deuda
    const datos = resultado.data;
    const deudaMsg = datos.formattedMessage || (`📊 *Resumen de deuda del padrón ${tipoPadron.toUpperCase()}*\n\n` +
      `👤 *Titular:* ${datos.titular}\n` +
      `🆔 *CUIT:* ${datos.cuit}\n` +
      `🌾 *Hectáreas:* ${datos.hectareas}\n\n` +
      `🚜 *Hijuela:* ${datos.hijuela || 'No disponible'}\n\n` +
      `💰 *DEUDA:*\n` +
      `Capital: ${datos.capital}\n` +
      `Interés: ${datos.interes}\n` +
      `Apremio: ${datos.apremio}\n` +
      `Eventuales: ${datos.eventuales}\n\n` +
      `*💵 TOTAL A PAGAR: ${datos.total}*\n\n` +
      `_💡 Si pagás el total de la deuda, te descontamos el 50% de los intereses._`);
    
    await sendMessageAndSave(from, deudaMsg);
    
    // Pequeña pausa para que WhatsApp entregue los mensajes en orden
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Ofrecer pagar deuda o volver
    const opcionesMsg = `💳 *¿Querés pagar tu deuda online?*`;
    await sendMessageAndSave(from, opcionesMsg);
    
    // Pequeña pausa antes de enviar botones
    await new Promise(resolve => setTimeout(resolve, 500));

    const buttons = [
      { id: 'pagar_deuda', title: '💳 Pagar deuda' },
      { id: 'volver_menu', title: '↩️ Volver' }
    ];

    await sendButtonReplyAndSave(from, 'Elige una opción:', buttons);
    userStates[from].step = 'AWAITING_PAGO_DEUDA';
    
  } catch (error) {
    console.error('❌ Error en ejecutarScraperPadron:', error);
    const errorMsg = '❌ Ocurrió un error al consultar la deuda. Por favor intenta más tarde.';
    await sendMessageAndSave(from, errorMsg);
    await sendMenuList(from, true);
    userStates[from].step = 'MAIN_MENU';
  }
};

/**
 * Ejecutar scraper de boleto con padrón
 */
const ejecutarScraperBoletoPadron = async (from, padronData, tipoPadron, tipoCuota) => {
  try {
    console.log(`⚙️ Ejecutando scraper de boleto con padrón ${tipoPadron} - ${tipoCuota}`);
    
    // Necesito parsear padronData para obtener tipoPadron
    let datosParaScrap = {};
    
    if (tipoPadron === 'superficial') {
      const [codigoCauce, numeroPadron] = padronData.split(' ');
      datosParaScrap = { codigoCauce, numeroPadron };
    } else if (tipoPadron === 'subterraneo') {
      const [codigoDepartamento, numeroPozo] = padronData.split(' ');
      datosParaScrap = { codigoDepartamento, numeroPozo };
    } else if (tipoPadron === 'contaminacion') {
      datosParaScrap = { numeroContaminacion: padronData };
    }
    
    let resultado = await debtApiService.obtenerBoletoPadron(tipoPadron, datosParaScrap, tipoCuota);
    console.log(`🧭 [FLOW] Boleto por API: ${resultado.success ? 'OK' : 'FALLÓ'}`);
    if (!resultado.success) {
      console.warn(`⚠️ API de boleto falló, activando fallback scraping: ${resultado.error}`);
      resultado = await debtScraperService.obtenerBoletoPadron(tipoPadron, datosParaScrap, tipoCuota);
      console.log(`🧭 [FLOW] Boleto fallback scraping: ${resultado.success ? 'OK' : 'ERROR'}`);
    }
    
    if (!resultado.success) {
      await sendMessageAndSave(
        from,
        getServiceErrorMessage(resultado, buildActionFailedMessage('generar el boleto del servicio'))
      );
      await sendMenuList(from, true);
      return;
    }
    
    // Pequeña pausa
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (resultado.pdfPath) {
      // Subir PDF a WhatsApp primero
      const sendingMsg = '📤 Preparando envío del boleto...';
      await sendMessageAndSave(from, sendingMsg);
      
      try {
        const mediaId = await whatsappService.uploadMedia(resultado.pdfPath, 'application/pdf');
        const nombrePersona = await resolveNombrePersona(from);
        const tipoBoleto = tipoCuota === 'anual' ? 'cuota_anual' : 'cuota_bimestral';
        const docFileName = buildBoletoPdfFileName({
          tipoBoleto,
          nombrePersona,
          createdAt: new Date()
        });
        
        // Enviar documento con mediaId
        await whatsappService.sendDocument(
          from,
          mediaId,
          docFileName,
          `Boleto de pago - ${tipoCuota === 'anual' ? 'Cuota Anual' : 'Cuota Bimestral'}`
        );
        console.log(`✅ Boleto PDF enviado: ${resultado.pdfPath}`);

        const retainedPdfUrl = await saveBoletoPublicCopy(resultado.pdfPath, docFileName);
        
        // 💾 GUARDAR el PDF en BD y emitir al frontend
        const mensajeGuardado = await mensajeService.guardarMensaje({
          telefono: from,
          tipo: 'document',
          cuerpo: `Boleto de pago - ${tipoCuota === 'anual' ? 'Cuota Anual' : 'Cuota Bimestral'} - ${nombrePersona}`,
          url_archivo: retainedPdfUrl,
          emisor: 'bot'
        });
        
        // Emitir al frontend via Socket.IO
        if (global.io) {
          global.io.emit('nuevo_mensaje', {
            id: mensajeGuardado.id,
            telefono: from,
            mensaje: docFileName,
            emisor: 'bot',
            tipo: 'document',
            url_archivo: retainedPdfUrl,
            timestamp: mensajeGuardado.fecha
          });
        }
        
        // Limpiar archivo después de enviar
        try {
          const fs = require('fs');
          fs.unlinkSync(resultado.pdfPath);
          console.log(`🗑️ Archivo ${resultado.pdfPath} eliminado`);
        } catch (cleanupError) {
          console.warn(`⚠️ No se pudo eliminar ${resultado.pdfPath}:`, cleanupError.message);
        }
        
      } catch (uploadError) {
        console.error('❌ Error al subir PDF a WhatsApp:', uploadError);
        await sendMessageAndSave(from, '❌ Error al enviar el boleto. Por favor intenta más tarde.');
        await sendMenuList(from, true);
        return;
      }
      
      // Pequeña pausa
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Ofrecer pagar boleto
      const pagarMsg = `📄 *Boleto generado correctamente*`;
      await sendMessageAndSave(from, pagarMsg);
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const buttons = [
        { id: 'pagar_boleto', title: '💳 Pagar boleto' },
        { id: 'volver_menu', title: '🚪 Salir' }
      ];
      
      await sendButtonReplyAndSave(from, '¿Desea pagar el boleto?', buttons);
      userStates[from].step = 'AWAITING_PAGO_BOLETO';

      const periBole = resultado?.data?.periBole;
      const numeBole = resultado?.data?.numeBole;
      const appBaseUrl = (
        process.env.BASE_URL
        || process.env.PUBLIC_BASE_URL
        || process.env.BACKEND_URL
        || `http://localhost:${process.env.PORT || 3000}`
      ).replace(/\/$/, '');
      const redirectLink = (periBole && numeBole)
        ? `${appBaseUrl}/pagar-boleto/${periBole}/${numeBole}`
        : null;
      console.log('🧭 [FLOW] Link de redirección de pago generado', {
        periBole,
        numeBole,
        redirectDisponible: Boolean(redirectLink)
      });
      
      // Guardar datos para el pago
      userStates[from].tempBoletoPago = {
        tipoPadron,
        tipoCuota,
        datos: datosParaScrap,
        redirectLink
      };
      
    } else {
      await sendMessageAndSave(from, '⚠️ No se pudo descargar el boleto.');
      await sendMenuList(from, true);
      userStates[from].step = 'MAIN_MENU';
    }
    
  } catch (error) {
    console.error('❌ Error en ejecutarScraperBoletoPadron:', error);
    const errorMsg = '❌ Ocurrió un error al generar el boleto. Por favor intenta más tarde.';
    await sendMessageAndSave(from, errorMsg);
    await sendMenuList(from, true);
    userStates[from].step = 'MAIN_MENU';
  }
};

/**
 * Manejar elección de pago de deuda
 */
const handlePagoDeudaChoice = async (from, optionToProcess) => {
  try {
    if (optionToProcess === 'pagar_deuda') {
      // Construir link de pago
      const tipoPadron = userStates[from].tempTipoPadron;
      const padronData = userStates[from].tempPadron;
      
      let letra = '';
      let codigo1 = '';
      let codigo2 = '';
      
      if (tipoPadron === 'superficial') {
        letra = 'A';
        const [codigoCauce, numeroPadron] = padronData.split(' ');
        codigo1 = codigoCauce;
        codigo2 = numeroPadron;
      } else if (tipoPadron === 'subterraneo') {
        letra = 'B';
        const [codigoDepartamento, numeroPozo] = padronData.split(' ');
        codigo1 = codigoDepartamento;
        codigo2 = numeroPozo;
      } else if (tipoPadron === 'contaminacion') {
        letra = 'C';
        codigo1 = padronData;
        codigo2 = '';
      }
      
      const linkPago = letra === 'C' 
        ? `https://autogestion.cloud.irrigacion.gov.ar/cuenta-corriente/${letra}/${codigo1}`
        : `https://autogestion.cloud.irrigacion.gov.ar/cuenta-corriente/${letra}/${codigo1}/${codigo2}`;
      
      const instruccionesMsg = 
        `💳 *Link de pago de deuda*\n\n` +
        `Podés pagar tu deuda online ingresando al siguiente link:\n\n` +
        `🔗 ${linkPago}\n\n` +
        `*Instrucciones:*\n` +
        `1️⃣ Ingresá al link\n` +
        `2️⃣ Seleccioná la/s cuota/s que querés pagar\n` +
        `3️⃣ Presioná *"Generar Boleto"*\n` +
        `4️⃣ Confirmá la operación\n` +
        `5️⃣ Imprimí y pagá en Pago Fácil, Rapipago o sucursal; también podés usar *"Pagar"* para transferencia\n\n` +
        `_💡 Recordá: Si pagás el total de la deuda, tenés 50% de descuento en intereses._`;
      
      await sendMessageAndSave(from, instruccionesMsg);
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      await sendMenuList(from, true);
      userStates[from].step = 'MAIN_MENU';
      
    } else if (optionToProcess === 'volver_menu') {
      await sendMenuList(from, true);
      userStates[from].step = 'MAIN_MENU';
    }
    
  } catch (error) {
    console.error('❌ Error en handlePagoDeudaChoice:', error);
    await sendMessageAndSave(from, '❌ Ocurrió un error. Por favor intenta más tarde.');
    await sendMenuList(from, true);
    userStates[from].step = 'MAIN_MENU';
  }
};

/**
 * Manejar elección de pago de boleto
 */
const handlePagoBoletoChoice = async (from, optionToProcess) => {
  try {
    if (optionToProcess === 'pagar_boleto') {
      // Obtener datos guardados
      const boletoPago = userStates[from].tempBoletoPago;
      
      if (!boletoPago) {
        await sendMessageAndSave(from, '❌ No se encontraron datos del boleto. Por favor intenta nuevamente.');
        await sendMenuList(from, true);
        userStates[from].step = 'MAIN_MENU';
        return;
      }
      
      const esperaMsg = `⏳ *Generando enlace de pago...*\n\nEste proceso puede demorar unos segundos.`;
      await sendMessageAndSave(from, esperaMsg);

      let linkPago = boletoPago.redirectLink;
      console.log(`🧭 [FLOW] Pago boleto: usando ${linkPago ? 'redirect /pagar-boleto' : 'scraper link fallback'}`);
      if (!linkPago) {
        const resultado = await debtScraperService.obtenerLinkPagoBoleto(
          boletoPago.tipoPadron,
          boletoPago.datos,
          boletoPago.tipoCuota
        );

        if (!resultado.success) {
          await sendMessageAndSave(
            from,
            getServiceErrorMessage(resultado, buildActionFailedMessage('obtener el enlace de pago del boleto'))
          );
          await sendMenuList(from, true);
          userStates[from].step = 'MAIN_MENU';
          return;
        }

        linkPago = resultado.linkPago;
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const instruccionesMsg = 
        `💳 *Enlace de pago del boleto*\n\n` +
        `Podés abonar tu boleto ingresando al siguiente enlace:\n\n` +
        `🔗 ${linkPago}\n\n` +
        `*Pasos sugeridos:*\n` +
        `1️⃣ Ingresá al link\n` +
        `2️⃣ Elegí tu método de pago preferido (tarjeta, Mercado Pago, etc.)\n` +
        `3️⃣ Completá el pago siguiendo las instrucciones del portal\n` +
        `4️⃣ Guardá el comprobante de pago\n\n` +
        `_✅ El pago se acreditará en 24-48 horas hábiles._`;
      
      await sendMessageAndSave(from, instruccionesMsg);
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const buttons = [
        { id: 'volver_menu', title: '↩️ Volver al Menú' }
      ];
      
      await sendButtonReplyAndSave(from, 'Elegí una opción:', buttons);
      userStates[from].step = 'MAIN_MENU';
      
      // Limpiar datos temporales
      delete userStates[from].tempBoletoPago;
      
    } else if (optionToProcess === 'volver_menu') {
      await sendMenuList(from, true);
      userStates[from].step = 'MAIN_MENU';
    }
    
  } catch (error) {
    console.error('❌ Error en handlePagoBoletoChoice:', error);
    await sendMessageAndSave(from, buildActionFailedMessage('procesar el pago del boleto'));
    await sendMenuList(from, true);
    userStates[from].step = 'MAIN_MENU';
  }
};

const handleIniciarPerforacion = async (from) => {
  try {
    const perforacionInfo = `🔧 *Solicitud de Perforación de Pozo*

Para obtener un permiso de perforación es necesario:

✅ Ubicación de la propiedad
✅ Presentar requisitos y formularios
✅ Iniciar trámite en oficinas
✅ Contratar profesional especializado
✅ Determinar demanda hídrica

*Plazo de construcción:* 6 meses máximo
*Plazo de equipamiento:* 12 meses

Para más información y requisitos, visitá:
🔗 https://www.irrigacion.gov.ar/web/agua-subterranea-2/

¿Necesitás ayuda con el trámite?`;
    
    await sendMessageAndSave(from, perforacionInfo);

    const buttons = [
      { id: 'perforacion_ayuda_si', title: '✅ Sí' },
      { id: 'perforacion_ayuda_no', title: '❌ No' }
    ];

    await sendButtonReplyAndSave(from, '¿Necesitás mas ayuda?', buttons);
    userStates[from].step = 'AWAITING_PERFORACION_HELP';
    
    console.log(`🔧 Info de perforación de subterránea enviada a ${from}`);
  } catch (error) {
    console.error('Error en handleIniciarPerforacion:', error);
    await sendMessageAndSave(from, '❌ Error al mostrar información. Intenta de nuevo.');
  }
};

const handlePerforacionHelpChoice = async (from, optionToProcess) => {
  try {
    if (optionToProcess === 'perforacion_ayuda_si') {
      const handoff = await intentarDerivarOperador(from, 'PERFORACION_HELP');
      userStates[from].step = handoff.enEspera ? 'AWAITING_OPERATOR_ASSIGNMENT' : 'MAIN_MENU';
      return;
    }

    await sendMenuList(from, true);
    userStates[from].step = 'MAIN_MENU';
  } catch (error) {
    console.error('❌ Error en handlePerforacionHelpChoice:', error);
    await sendMessageAndSave(from, '❌ Ocurrió un error. Por favor intenta más tarde.');
    await sendMenuList(from, true);
    userStates[from].step = 'MAIN_MENU';
  }
};

const handleOperatorWaitingInput = async (from, messageBody = '', optionToProcess = '') => {
  const normalized = String(optionToProcess || messageBody || '').trim().toLowerCase();
  if (normalized === 'salir' || normalized === 'cancelar' || normalized === 'menu' || normalized === 'volver') {
    await clienteService.actualizarEstadoConversacion(from, 'BOT');
    const ticketCerrado = await clienteService.cerrarTicketHumano(from, 'CANCELADO_USUARIO_EN_ESPERA');
    await emitToTenantRoom(from, 'bot_mode_changed', {
      telefono: from,
      bot_activo: true,
      estado_conversacion: 'BOT',
      ticket_id: ticketCerrado?.id || null
    });
    await sendMessageAndSave(from, '✅ Cancelamos la espera para hablar con operador.');
    await sendMenuList(from, true);
    userStates[from].step = 'MAIN_MENU';
    return;
  }

  const waitingReminder = '🕒 Tu solicitud sigue en espera. En cuanto un operador la tome, te vamos a avisar por acá.\n\nSi preferís volver al bot, escribí *SALIR*.';
  await sendMessageAndSave(from, waitingReminder);
  userStates[from].step = 'AWAITING_OPERATOR_ASSIGNMENT';
};

const handleOperatorSurveyResponse = async (from, optionToProcess = '') => {
  const validOptions = new Set([
    'op_satisfaccion_1',
    'op_satisfaccion_2',
    'op_satisfaccion_3',
    'op_satisfaccion_4',
    'op_satisfaccion_5'
  ]);

  if (!validOptions.has(optionToProcess)) {
    await sendMessageAndSave(from, '🙏 Por favor elegí una opción de la encuesta usando los botones.');
    return;
  }

  await clienteService.actualizarEstadoConversacion(from, 'FOLLOWUP_POST_OPERADOR');

  await sendMessageAndSave(from, '¡Gracias por tu respuesta! 🙌');
  await sendButtonReplyAndSave(from, '¿Querés dejarnos alguna opinión?', [
    { id: 'op_opinion_si', title: '✅ Sí' },
    { id: 'op_opinion_no', title: '❌ No' }
  ]);

  userStates[from].step = 'AWAITING_OPINION_CHOICE';
};

const handleOpinionChoice = async (from, optionToProcess = '') => {
  if (optionToProcess === 'op_opinion_si') {
    await sendMessageAndSave(from, '✍️ Escribí tu opinión y la registramos:');
    userStates[from].step = 'AWAITING_OPINION_TEXT';
    return;
  }

  if (optionToProcess === 'op_opinion_no') {
    await sendButtonReplyAndSave(from, '¿Necesitás ayuda en algo más?', [
      { id: 'op_mas_ayuda_si', title: '✅ Sí' },
      { id: 'op_mas_ayuda_no', title: '❌ No' }
    ]);
    userStates[from].step = 'AWAITING_OPERATOR_FOLLOWUP';
    return;
  }

  await sendMessageAndSave(from, 'Por favor elegí una opción: *Sí* o *No*.');
};

const handleOpinionText = async (from, messageBody = '') => {
  const opinion = String(messageBody || '').trim();
  if (!opinion) {
    await sendMessageAndSave(from, '✍️ Por favor escribí tu opinión:');
    return;
  }

  await mensajeService.guardarMensaje({
    telefono: from,
    tipo: 'text',
    cuerpo: `[OPINIÓN DEL CLIENTE]: ${opinion}`,
    emisor: 'bot',
    url_archivo: null
  });

  await sendMessageAndSave(from, '¡Gracias por su opinión! La misma nos ayuda a mejorar continuamente. 🙏');
  await sendButtonReplyAndSave(from, '¿Necesitás ayuda en algo más?', [
    { id: 'op_mas_ayuda_si', title: '✅ Sí' },
    { id: 'op_mas_ayuda_no', title: '❌ No' }
  ]);
  userStates[from].step = 'AWAITING_OPERATOR_FOLLOWUP';
};

const handleOperatorPostFollowUp = async (from, optionToProcess = '') => {
  if (optionToProcess === 'op_mas_ayuda_si') {
    await clienteService.actualizarEstadoConversacion(from, 'BOT');
    await sendMenuList(from, true);
    userStates[from].step = 'MAIN_MENU';
    return;
  }

  if (optionToProcess === 'op_mas_ayuda_no') {
    await clienteService.actualizarEstadoConversacion(from, 'BOT');
    await sendMessageAndSave(from, 'Perfecto. Gracias por comunicarte con nosotros. ¡Que tengas un gran día! 👋');
    userStates[from].step = 'START';
    userStates[from].shouldGreet = true;
    return;
  }

  await sendMessageAndSave(from, 'Por favor elegí una opción: *Sí* o *No*.');
};

const logTurnoSource = (from, context, result = {}) => {
  const source = result?.source || 'unknown';
  const success = Boolean(result?.success);
  const hasData = Boolean(result?.data);
  const reason = result?.message || result?.error || result?.userMessage || null;

  console.log('🧭 [TURNOS][SOURCE]', {
    telefono: from,
    contexto: context,
    source,
    success,
    hasData,
    reason
  });
};

const buscarTurnoPorTitularApiFirst = async (titular) => {
  const titularBusqueda = String(titular || '').trim();
  console.log(`🧭 [FLOW] Turno por titular: intentando API directa primero para "${titularBusqueda}"`);

  const listadoApi = await turnadoApiService.buscarTurnos('titular', titularBusqueda);
  if (listadoApi.success && Array.isArray(listadoApi.resultados) && listadoApi.resultados.length > 0) {
    if (listadoApi.resultados.length > 1) {
      return {
        success: false,
        multiple: true,
        opciones: listadoApi.resultados,
        titularBusqueda
      };
    }

    const primeraOpcion = listadoApi.resultados[0] || {};
    const ccppSeleccionado = primeraOpcion.ccpp_oculto || primeraOpcion.ccpp || '';

    if (ccppSeleccionado) {
      const detalleApi = await turnadoApiService.obtenerDetalleTurnoCompleto(ccppSeleccionado);
      if (detalleApi.success) {
        console.log(`✅ [FLOW] Turno por titular resuelto por API directa (${ccppSeleccionado})`);

        const data = detalleApi.data || {};
        return {
          success: true,
          data: {
            ...data,
            titular: data.titular || primeraOpcion.titular || titularBusqueda,
            ccpp: data.ccpp || primeraOpcion.ccpp || ccppSeleccionado,
            hijuela: data.hijuela || primeraOpcion.canal_hijuela || 'No disponible'
          },
          source: 'api-direct'
        };
      }

      console.log(`⚠️ API detalle por CCPP falló para ${ccppSeleccionado}, activando fallback scraping por titular`);
    } else {
      console.log('⚠️ API por titular no devolvió CCPP utilizable, activando fallback scraping');
    }
  } else {
    console.log(`⚠️ API por titular falló o sin resultados, activando fallback scraping: ${listadoApi.message || 'sin detalle'}`);
  }

  const fallback = await turnadoScraperService.buscarPorTitular(titularBusqueda);
  return {
    ...fallback,
    source: 'scraper-fallback'
  };
};

const resolverTurnoTitularDesdeOpcion = async (titularBusqueda, opcionSeleccionada) => {
  const opcion = opcionSeleccionada || {};
  const ccppSeleccionado = opcion.ccpp_oculto || opcion.ccpp || '';

  if (ccppSeleccionado) {
    console.log(`🧭 [FLOW] Turno por titular (opción elegida): intentando detalle API para ${ccppSeleccionado}`);
    const detalleApi = await turnadoApiService.obtenerDetalleTurnoCompleto(ccppSeleccionado);
    if (detalleApi.success) {
      const data = detalleApi.data || {};
      return {
        success: true,
        data: {
          ...data,
          titular: data.titular || opcion.titular || titularBusqueda,
          ccpp: data.ccpp || opcion.ccpp || ccppSeleccionado,
          hijuela: data.hijuela || opcion.canal_hijuela || 'No disponible'
        },
        source: 'api-direct'
      };
    }

    console.log(`⚠️ API detalle por CCPP falló para ${ccppSeleccionado}, activando fallback scraping por titular`);
  }

  const fallback = await turnadoScraperService.buscarPorTitular(titularBusqueda);
  return {
    ...fallback,
    source: 'scraper-fallback'
  };
};

/**
 * Maneja la elección de usar el último titular o ingresar uno nuevo
 */
const handleTurnoTitularChoice = async (from, option) => {
  const normalized = (option || '').toString().trim().toLowerCase();

  if (normalized === 'usar_ultimo_titular') {
    const lastTitular = userStates[from].lastTitular;
    await sendMessageAndSave(from, `🔎 Buscando turno con: *${lastTitular}*...`);

    const result = await buscarTurnoPorTitularApiFirst(lastTitular);
    logTurnoSource(from, 'titular/usar_ultimo', result);

    if (result.multiple) {
      const opciones = (result.opciones || []).slice(0, 10);
      userStates[from].turnoTitularOpciones = opciones;
      userStates[from].turnoTitularBusqueda = result.titularBusqueda || lastTitular;

      const listado = opciones
        .map((item, index) => {
          const ccpp = item.ccpp || item.ccpp_oculto || 'Sin CCPP';
          const canal = item.canal_hijuela || 'Sin canal/hijuela';
          return `${index + 1}. ${ccpp} - ${canal}`;
        })
        .join('\n');

      await sendMessageAndSave(
        from,
        `📋 Encontramos varios resultados para *${lastTitular}*:\n\n${listado}\n\nRespondé con el número de opción (1-${opciones.length}) o escribí *volver*.`
      );
      userStates[from].step = 'AWAITING_TURNO_TITULAR_API_OPTION';
      return;
    }
    
    if (!result.success) {
      const errorMsg = buildTurnoLookupFailedMessage('el titular', getServiceErrorMessage(result, 'No encontramos turnos para ese titular.'));
      await sendMessageAndSave(from, errorMsg);
      userStates[from].step = 'AWAITING_TURNO_TITULAR';
      return;
    }
    
    const data = result.data || {};
    if (!hasUsableTurnoData(data)) {
      const noDataMsg = buildTurnoLookupFailedMessage('el titular', 'No encontramos datos de turno para ese titular.');
      await sendMessageAndSave(from, noDataMsg);
      userStates[from].step = 'AWAITING_TURNO_TITULAR';
      return;
    }

    userStates[from].lastTurnoMode = 'titular';
    const response = buildTurnoResponse({
      data,
      titularFallback: lastTitular,
      ccppFallback: 'No disponible',
      includeHijuela: true
    });
    
    await sendMessageAndSave(from, response);
    await sendMenuList(from, true);
    userStates[from].step = 'MAIN_MENU';
    return;
  }

  if (normalized === 'nuevo_titular') {
    const msg = `📝 *Ingresar nuevo titular*

Recordá: *APELLIDO* seguido del *Nombre*

Ej: *GONZALEZ JUAN*

_📌 Para cancelar esta búsqueda, escribí *SALIR*_`;
    await sendMessageAndSave(from, msg);
    userStates[from].step = 'AWAITING_TURNO_TITULAR';
    return;
  }

  if (normalized === 'volver' || normalized === 'menu') {
    await sendMenuList(from, true);
    userStates[from].step = 'MAIN_MENU';
    return;
  }

  await sendMessageAndSave(from, '❌ Opción no válida.');
};

/**
 * Maneja la elección de usar el último C.C.-P.P. o ingresar uno nuevo
 */
const handleTurnoCCPPChoice = async (from, option) => {
  const normalized = (option || '').toString().trim().toLowerCase();

  if (normalized === 'usar_ultimo_ccpp') {
    const lastCCPP = userStates[from].lastCCPP;
    await sendMessageAndSave(from, `🔎 Buscando turno con: *${lastCCPP}*...`);
    
    // Intentar API primero
    console.log(`🧭 [FLOW] Turno por CCPP (usar_ultimo): intentando API directa para ${lastCCPP}`);
    let result = await turnadoApiService.obtenerDetalleTurnoCompleto(lastCCPP);
    let source = 'api-direct';
    
    // Si API falla, fallback a scraper
    if (!result.success) {
      console.log(`⚠️ API de turno falló para ${lastCCPP}, activando fallback scraping`);
      result = await turnadoScraperService.buscarPorCCPP(lastCCPP);
      source = 'scraper-fallback';
    } else {
      console.log(`✅ [FLOW] Turno por CCPP (usar_ultimo) resuelta por API directa`);
    }

    result = { ...result, source };
    logTurnoSource(from, 'ccpp/usar_ultimo', result);
    
    if (!result.success) {
      const errorMsg = buildTurnoLookupFailedMessage('el C.C.-P.P.', getServiceErrorMessage(result, 'No encontramos turnos para ese servicio.'));
      await sendMessageAndSave(from, errorMsg);
      userStates[from].step = 'AWAITING_TURNO_CCPP';
      return;
    }
    
    const data = result.data || {};
    if (!hasUsableTurnoData(data)) {
      const noDataMsg = buildTurnoLookupFailedMessage('el C.C.-P.P.', 'No encontramos datos de turno para ese servicio.');
      await sendMessageAndSave(from, noDataMsg);
      userStates[from].step = 'AWAITING_TURNO_CCPP';
      return;
    }

    userStates[from].lastTurnoMode = 'ccpp';
    const response = buildTurnoResponse({
      data,
      titularFallback: 'No disponible',
      ccppFallback: lastCCPP,
      includeHijuela: false
    });
    
    await sendMessageAndSave(from, response);
    await sendMenuList(from, true);
    userStates[from].step = 'MAIN_MENU';
    return;
  }

  if (normalized === 'nuevo_ccpp') {
    const msg = `📝 *Ingresar nuevo C.C.-P.P.*

Recordá: *sin ceros después del guion*

Ej: *8234-1*

_📌 Para cancelar esta búsqueda, escribí *SALIR*_`;
    await sendMessageAndSave(from, msg);
    userStates[from].step = 'AWAITING_TURNO_CCPP';
    return;
  }

  if (normalized === 'volver' || normalized === 'menu') {
    await sendMenuList(from, true);
    userStates[from].step = 'MAIN_MENU';
    return;
  }

  await sendMessageAndSave(from, '❌ Opción no válida.');
};

/**
 * Maneja la elección del método de búsqueda de turnos
 */
const handleTurnoMethodChoice = async (from, option) => {
  const normalized = (option || '').toString().trim().toLowerCase();

  if (normalized === 'mismo' || normalized === 'turno_mismo') {
    const [lastTitularDB, lastCCPPDB] = await Promise.all([
      clienteService.obtenerUltimoTitular(from),
      clienteService.obtenerUltimoCCPP(from)
    ]);

    const lastTitular = lastTitularDB || userStates[from].lastTitular;
    const lastCCPP = lastCCPPDB || userStates[from].lastCCPP;
    const lastMode = userStates[from].lastTurnoMode;
    console.log('🧠 [MEMORIA][TURNOS] Estado de memoria cargado', {
      telefono: from,
      lastMode: lastMode || 'sin modo',
      lastTitular: lastTitular || 'sin titular',
      lastCCPP: lastCCPP || 'sin ccpp'
    });

    if (lastMode === 'titular' && lastTitular) {
      userStates[from].lastTitular = lastTitular;
      await handleTurnoTitularChoice(from, 'usar_ultimo_titular');
      return;
    }

    if (lastMode === 'ccpp' && lastCCPP) {
      userStates[from].lastCCPP = lastCCPP;
      await handleTurnoCCPPChoice(from, 'usar_ultimo_ccpp');
      return;
    }

    if (lastTitular) {
      userStates[from].lastTitular = lastTitular;
      userStates[from].lastTurnoMode = 'titular';
      await handleTurnoTitularChoice(from, 'usar_ultimo_titular');
      return;
    }

    if (lastCCPP) {
      userStates[from].lastCCPP = lastCCPP;
      userStates[from].lastTurnoMode = 'ccpp';
      await handleTurnoCCPPChoice(from, 'usar_ultimo_ccpp');
      return;
    }

    await sendMessageAndSave(from, 'ℹ️ No hay una búsqueda previa guardada para reutilizar.');
    return;
  }

  if (normalized === 'turno_titular') {
    userStates[from].lastTurnoMode = 'titular';
    // Cargar último titular desde BD
    const lastTitularDB = await clienteService.obtenerUltimoTitular(from);
    const lastTitular = lastTitularDB || userStates[from].lastTitular;
    
    if (lastTitular) {
      // Ofrecer usar el último titular
      const msg = `👤 *Búsqueda por Titular*

Último titular buscado: *${lastTitular}*

¿Querés buscar con el mismo titular?`;
      await sendMessageAndSave(from, msg);
      
      await sendInteractiveButtonsAndSave(
        from,
        'Elegí una opción:',
        [
          { id: 'usar_ultimo_titular', title: '✅ Usar mismo' },
          { id: 'nuevo_titular', title: '📝 Ingresar otro' },
          { id: 'volver', title: '↩️ Volver' }
        ]
      );
      
      userStates[from].step = 'AWAITING_TURNO_TITULAR_CHOICE';
      userStates[from].lastTitular = lastTitular; // Guardar en memoria también
    } else {
      const msg = `👤 *Búsqueda por Titular*

Recordá ingresar *APELLIDO* seguido del *Nombre* como figura en tu turno anterior o boleta de pago.

Ej: *GONZALEZ JUAN*

_📌 Para cancelar esta búsqueda, escribí *SALIR*_`;
      await sendMessageAndSave(from, msg);
      userStates[from].step = 'AWAITING_TURNO_TITULAR';
    }
    return;
  }

  if (normalized === 'turno_ccpp') {
    userStates[from].lastTurnoMode = 'ccpp';
    // Cargar último C.C.-P.P. desde BD
    const lastCCPPDB = await clienteService.obtenerUltimoCCPP(from);
    const lastCCPP = lastCCPPDB || userStates[from].lastCCPP;
    
    if (lastCCPP) {
      const msg = `🔢 *Búsqueda por Servicio*

Último servicio utilizado: *${lastCCPP}*

¿Querés buscar con el mismo servicio?`;
      await sendMessageAndSave(from, msg);
      
      await sendInteractiveButtonsAndSave(
        from,
        'Elegí una opción:',
        [
          { id: 'usar_ultimo_ccpp', title: '✅ Usar mismo' },
          { id: 'nuevo_ccpp', title: '📝 Ingresar otro' },
          { id: 'volver', title: '↩️ Volver' }
        ]
      );
      
      userStates[from].step = 'AWAITING_TURNO_CCPP_CHOICE';
      userStates[from].lastCCPP = lastCCPP; // Guardar en memoria también
    } else {
      const msg = `🔢 *Búsqueda por Servicio*

ℹ️ *¿Qué es el servicio?*
El número del servicio está compuesto por:
• *CC* = Código de Cauce
• *PP* = Padrón Parcial
Ejemplo: 8234-1710

📝 *Importante:* los ceros después del guion (-) NO se colocan.
Ej: si tu padrón es *8234-0001* debés ingresar *8234-1*

Ingresá tu número de servicio:

_📌 Para cancelar esta búsqueda, escribí *SALIR*_`;
      await sendMessageAndSave(from, msg);
      userStates[from].step = 'AWAITING_TURNO_CCPP';
    }
    return;
  }

  if (normalized === 'volver' || normalized === 'menu') {
    await sendMenuList(from, true);
    userStates[from].step = 'MAIN_MENU';
    return;
  }

  await sendMessageAndSave(from, '❌ Opción no válida. Por favor elegí una opción del menú:');
  await sendInteractiveButtonsAndSave(
    from,
    '📋 Seleccione el método de búsqueda:',
    [
      { id: 'turno_titular', title: '👤 Por Titular' },
      { id: 'turno_ccpp', title: '🔢 Por Servicio' },
      { id: 'volver', title: '↩️ Volver' }
    ]
  );
};

/**
 * Maneja ingreso de titular para búsqueda de turnos
 */
const handleTurnoTitularInput = async (from, messageBody) => {
  const raw = (messageBody || '').trim();
  const lower = raw.toLowerCase();

  if (!raw) {
    await sendMessageAndSave(from, '⚠️ Por favor ingresá el titular (APELLIDO Nombre).\n\n_📌 Para cancelar, escribí *SALIR*_');
    return;
  }

  if (lower === 'volver' || lower === 'menu' || lower === 'salir' || lower === 'cancelar') {
    await sendMenuList(from, true);
    userStates[from].step = 'MAIN_MENU';
    return;
  }

  // Guardar en memoria y BD
  userStates[from].lastTitular = raw;
  await clienteService.guardarUltimoTitular(from, raw);

  await sendMessageAndSave(from, '🔎 Buscando turno, un momento por favor...');

  const result = await buscarTurnoPorTitularApiFirst(raw);
  logTurnoSource(from, 'titular/nuevo', result);

  if (result.multiple) {
    const opciones = (result.opciones || []).slice(0, 10);
    userStates[from].turnoTitularOpciones = opciones;
    userStates[from].turnoTitularBusqueda = result.titularBusqueda || raw;

    const listado = opciones
      .map((item, index) => {
        const ccpp = item.ccpp || item.ccpp_oculto || 'Sin CCPP';
        const canal = item.canal_hijuela || 'Sin canal/hijuela';
        return `${index + 1}. ${ccpp} - ${canal}`;
      })
      .join('\n');

    await sendMessageAndSave(
      from,
      `📋 Encontramos varios resultados para *${raw}*:\n\n${listado}\n\nRespondé con el número de opción (1-${opciones.length}) o escribí *volver*.`
    );
    userStates[from].step = 'AWAITING_TURNO_TITULAR_API_OPTION';
    return;
  }

  if (!result.success) {
    const errorMsg = buildTurnoLookupFailedMessage('el titular', getServiceErrorMessage(result, 'No encontramos turnos para ese titular.'));
    await sendMessageAndSave(from, errorMsg);
    return;
  }

  const data = result.data || {};
  if (!hasUsableTurnoData(data)) {
    const noDataMsg = buildTurnoLookupFailedMessage('el titular', 'No encontramos datos de turno para ese titular.');
    await sendMessageAndSave(from, noDataMsg);
    return;
  }

  userStates[from].lastTurnoMode = 'titular';
  const response = buildTurnoResponse({
    data,
    titularFallback: raw,
    ccppFallback: 'No disponible',
    includeHijuela: true
  });

  await sendMessageAndSave(from, response);
  await sendMenuList(from, true);
  userStates[from].step = 'MAIN_MENU';
};

const handleTurnoTitularApiOptionInput = async (from, messageBody) => {
  const raw = String(messageBody || '').trim();
  const lower = raw.toLowerCase();

  if (lower === 'volver' || lower === 'menu' || lower === 'salir' || lower === 'cancelar') {
    delete userStates[from].turnoTitularOpciones;
    delete userStates[from].turnoTitularBusqueda;
    await sendMenuList(from, true);
    userStates[from].step = 'MAIN_MENU';
    return;
  }

  const opciones = userStates[from].turnoTitularOpciones || [];
  const titularBusqueda = userStates[from].turnoTitularBusqueda || userStates[from].lastTitular || '';

  if (!opciones.length) {
    await sendMessageAndSave(from, '❌ No hay opciones pendientes para seleccionar. Volvé a buscar por titular.');
    userStates[from].step = 'AWAITING_TURNO_TITULAR';
    return;
  }

  const index = Number.parseInt(raw, 10);
  if (Number.isNaN(index) || index < 1 || index > opciones.length) {
    await sendMessageAndSave(from, `⚠️ Opción inválida. Ingresá un número del 1 al ${opciones.length}.`);
    return;
  }

  const opcionSeleccionada = opciones[index - 1];
  const result = await resolverTurnoTitularDesdeOpcion(titularBusqueda, opcionSeleccionada);
  logTurnoSource(from, 'titular/opcion_api', result);

  if (!result.success) {
    const errorMsg = buildTurnoLookupFailedMessage('el titular', getServiceErrorMessage(result, 'No encontramos turnos para ese titular.'));
    await sendMessageAndSave(from, errorMsg);
    userStates[from].step = 'AWAITING_TURNO_TITULAR';
    return;
  }

  const data = result.data || {};
  if (!hasUsableTurnoData(data)) {
    const noDataMsg = buildTurnoLookupFailedMessage('el titular', 'No encontramos datos de turno para ese titular.');
    await sendMessageAndSave(from, noDataMsg);
    userStates[from].step = 'AWAITING_TURNO_TITULAR';
    return;
  }

  userStates[from].lastTurnoMode = 'titular';
  if (data.ccpp) {
    userStates[from].lastCCPP = data.ccpp;
    await clienteService.guardarUltimoCCPP(from, data.ccpp);
  }

  const response = buildTurnoResponse({
    data,
    titularFallback: titularBusqueda || 'No disponible',
    ccppFallback: opcionSeleccionada?.ccpp || opcionSeleccionada?.ccpp_oculto || 'No disponible',
    includeHijuela: true
  });

  delete userStates[from].turnoTitularOpciones;
  delete userStates[from].turnoTitularBusqueda;

  await sendMessageAndSave(from, response);
  await sendMenuList(from, true);
  userStates[from].step = 'MAIN_MENU';
};

/**
 * Maneja ingreso de C.C.-P.P. para búsqueda de turnos
 */
const handleTurnoCCPPInput = async (from, messageBody) => {
  const raw = (messageBody || '').trim();
  const lower = raw.toLowerCase();

  if (!raw) {
    await sendMessageAndSave(from, '⚠️ Por favor ingresá el C.C.-P.P. (Ej: 8234-1).\n\n_📌 Para cancelar, escribí *SALIR*_');
    return;
  }

  if (lower === 'volver' || lower === 'menu' || lower === 'salir' || lower === 'cancelar') {
    await sendMenuList(from, true);
    userStates[from].step = 'MAIN_MENU';
    return;
  }

  // Normalizar formato flexible: 8234-1, 82341, 8234 1, 8234-1710, etc.
  let normalized;
  
  // Opción 1: Ya tiene guion (8234-1 o 8234-1710)
  if (raw.includes('-')) {
    const parts = raw.split('-');
    const pref = parts[0]?.trim() || '';
    const sufRaw = parts[1]?.trim() || '';
    
    if (!pref || !sufRaw) {
      await sendMessageAndSave(from, '⚠️ C.C.-P.P. inválido. Ej: 8234-1 o 8234-1710');
      return;
    }
    
    // Si el sufijo tiene 4 dígitos (1710), reducir a 1
    const suf = sufRaw.length === 4 ? sufRaw.replace(/^0+/, '') : sufRaw;
    normalized = `${pref}-${suf}`;
  } else {
    // Opción 2: Sin guion (82341 o 8234 1)
    const cleaned = raw.replace(/\s+/g, '');
    
    if (cleaned.length < 4) {
      await sendMessageAndSave(from, '⚠️ C.C.-P.P. inválido. Ej: 8234-1 o 82341');
      return;
    }
    
    // Si tiene más de 4 dígitos, es probablemente 82341710 → 8234-1
    if (cleaned.length > 4) {
      const pref = cleaned.substring(0, 4);
      const sufRaw = cleaned.substring(4);
      const suf = sufRaw.replace(/^0+/, '') || '0';
      normalized = `${pref}-${suf}`;
    } else {
      normalized = `${cleaned}-0`;
    }
  }

  // Guardar en memoria y BD
  userStates[from].lastCCPP = normalized;
  await clienteService.guardarUltimoCCPP(from, normalized);

  await sendMessageAndSave(from, `🔎 Buscando turno para C.C.-P.P. ${normalized}...`);

  // Intentar API primero
  console.log(`🧭 [FLOW] Turno por CCPP: intentando API directa primero para ${normalized}`);
  let result = await turnadoApiService.obtenerDetalleTurnoCompleto(normalized);
  let source = 'api-direct';

  // Si API falla, fallback a scraper
  if (!result.success) {
    console.log(`⚠️ API de turno falló para ${normalized}, activando fallback scraping`);
    result = await turnadoScraperService.buscarPorCCPP(normalized);
    source = 'scraper-fallback';
  } else {
    console.log(`✅ [FLOW] Turno por CCPP resuelta por API directa`);
  }

  result = { ...result, source };
  logTurnoSource(from, 'ccpp/nuevo', result);

  if (!result.success) {
    const errorMsg = buildTurnoLookupFailedMessage('el C.C.-P.P.', getServiceErrorMessage(result, 'No encontramos turnos para ese servicio.'));
    await sendMessageAndSave(from, errorMsg);
    return;
  }

  const data = result.data || {};
  if (!hasUsableTurnoData(data)) {
    const noDataMsg = buildTurnoLookupFailedMessage('el C.C.-P.P.', 'No encontramos datos de turno para ese servicio.');
    await sendMessageAndSave(from, noDataMsg);
    return;
  }

  userStates[from].lastTurnoMode = 'ccpp';
  const response = buildTurnoResponse({
    data,
    titularFallback: 'No disponible',
    ccppFallback: normalized,
    includeHijuela: true
  });

  await sendMessageAndSave(from, response);
  await sendMenuList(from, true);
  userStates[from].step = 'MAIN_MENU';
};

module.exports = {
  verifyWebhook,
  receiveMessage,
  // Exported for unit testing only
  _testHelpers: {
    extractLikelyNameFromInput,
    isLikelyValidPersonName,
    formatPersonName,
    normalizePersonName,
    handleOperatorSurveyResponse,
    handleOpinionChoice,
    handleOpinionText,
    handleOperatorPostFollowUp,
    userStates,
  }
};
