const whatsappService = require('../services/whatsappService');
const debtScraperService = require('../services/debtScraperService');
const mensajeService = require('../services/mensajeService');
const clienteService = require('../services/clienteService');
const fs = require('fs');
const path = require('path');

// Memoria temporal para estados de usuarios
const userStates = {};

// Memoria para deduplicación de mensajes
const processedMessageIds = new Set();

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
            messageBody = message.interactive.list_reply.title || message.interactive.list_reply.id;
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
          userStates[from] = { 
            step: 'START', 
            padron: null, 
            nombreCliente: cliente?.nombre_whatsapp || pushName, 
            esClienteNuevo,
            lastMessageTime: now
          };
        } else {
          // Usuario existente: verificar tiempo de inactividad
          const timeSinceLastMessage = now - (userStates[from].lastMessageTime || 0);
          
          if (timeSinceLastMessage > TWELVE_HOURS) {
            // Pasaron más de 12 horas: saludar de nuevo pero mantener datos del cliente
            console.log(`⏰ Han pasado ${Math.round(timeSinceLastMessage / (60 * 60 * 1000))} horas desde el último mensaje de ${from}`);
            userStates[from].step = 'START';
            userStates[from].shouldGreet = true; // Flag para indicar que debe saludar
          }
          
          // Actualizar el timestamp del último mensaje
          userStates[from].lastMessageTime = now;
        }

        // Procesar mensaje según el estado actual
        const optionId = message._optionId || messageBody;
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
      await sendMenuList(from, false); // false = es la primera vez
      userStates[from].step = 'MAIN_MENU';
      break;

    case 'MAIN_MENU':
      await handleMainMenu(from, optionToProcess);
      break;

    case 'AWAITING_DNI':
      await handleDniInput(from, messageBody);
      break;

    case 'AWAITING_DNI_BOLETO':
      await handleDniInputBoleto(from, messageBody);
      break;

    case 'AWAITING_MODO_CONSULTA':
      await handleModoConsulta(from, optionToProcess);
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

    case 'AWAITING_TIPO_CUOTA':
      await handleTipoCuota(from, optionToProcess);
      break;

    case 'AWAITING_TIPO_CUOTA_PADRON':
      await handleTipoCuotaPadron(from, optionToProcess);
      break;

    case 'AWAITING_BOLETO_POST_DEUDA':
      await handlePostDeudaBoletoChoice(from, optionToProcess);
      break;

    case 'AWAITING_OPCION_BOLETO_PADRON':
      await handleOpcionBoletoPadron(from, optionToProcess);
      break;

    case 'AWAITING_PADRON':
      await handlePadronInput(from, messageBody);
      break;

    case 'AUTH_MENU':
      await handleAuthMenu(from, messageBody);
      break;

    case 'AWAITING_OPERATOR_CHOICE':
      // Handle operator choice buttons
      console.log(`🔵 Opción recibida en AWAITING_OPERATOR_CHOICE: "${optionToProcess}"`);
      if (optionToProcess === 'op_si_operador') {
        // User wants to talk with operator
        const operatorMsg = `👤 Derivando a un Agente\n\nUn operador humano te atenderá en breve.`;
        await sendMessageAndSave(from, operatorMsg);
        await clienteService.cambiarEstadoBot(from, false);
        if (global.io) {
          global.io.emit('bot_mode_changed', { telefono: from, bot_activo: false });
        }
        userStates[from].step = 'MAIN_MENU';
        console.log(`👤 Usuario ${from} conectado con operador por error en scraper`);
      } else if (optionToProcess === 'op_no_operador') {
        // User wants to do another transaction
        await sendMenuList(from, true);
        userStates[from].step = 'MAIN_MENU';
        console.log(`📋 Usuario ${from} continúa con menú principal después de error`);
      } else if (optionToProcess === 'op_reintentar_dni') {
        // User wants to retry with a different DNI
        const retryMsg = `📝 Ingresa tu DNI/CUIT nuevamente.\n\nPor favor, verifica que sea correcto.`;
        await sendMessageAndSave(from, retryMsg);
        userStates[from].step = 'AWAITING_DNI';
        console.log(`🔄 Usuario ${from} reintentando con nuevo DNI`);
      } else {
        console.warn(`⚠️ Opción no reconocida en AWAITING_OPERATOR_CHOICE: "${optionToProcess}"`);
        const invalidMsg = '❌ Opción no válida. Por favor, elige una de las opciones disponibles.';
        await sendMessageAndSave(from, invalidMsg);
      }
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
    welcomeMessage = `👋 ¡Hola! Te damos la bienvenida.

Estás comunicado con la Jefatura de Zona de Riego de ríos Malargüe, Grande, Barranca y Colorado.

Soy tu asistente virtual, diseñado para ayudarte con tus gestiones hídricas de forma rápida y sencilla. 💧`;
  } else {
    // Saludo personalizado para clientes conocidos
    const nombre = nombreCliente ? nombreCliente.split(' ')[0] : 'amigo'; // Usar solo el primer nombre
    welcomeMessage = `👋 ¡Hola ${nombre}! ¿Qué necesitas el día de hoy?`;
  }
  
  await sendMessageAndSave(from, welcomeMessage);
  console.log(`👋 Mensaje de bienvenida enviado a ${from}`);
};

/**
 * Envía la lista interactiva del menú principal
 * @param {string} from - Número de teléfono del usuario
 * @param {boolean} isFollowUp - Si es true, muestra mensaje de seguimiento en lugar del inicial
 */
const sendMenuList = async (from, isFollowUp = false) => {
  const sections = [
    {
      title: 'Información y Consultas',
      rows: [
        { 
          id: 'ubicacion', 
          title: '📍 Ubicación y Horarios',
          description: 'Dirección, horarios de atención y contacto'
        },
        { 
          id: 'deuda', 
          title: '💳 Consultar Deuda',
          description: 'Verificar estado de cuenta y montos adeudados'
        },
        { 
          id: 'vencimientos', 
          title: '📅 Consultar Vencimientos',
          description: 'Ver fechas de vencimiento de pagos'
        },
        { 
          id: 'turnos', 
          title: '🗓️ Consultar Turnos',
          description: 'Información sobre turnos disponibles'
        }
      ]
    },
    {
      title: 'Trámites y Gestiones',
      rows: [
        { 
          id: 'empadronamiento', 
          title: '🧾 Empadronamiento',
          description: 'Registrar nuevo padrón o actualizar datos'
        },
        { 
          id: 'perforacion', 
          title: '🔧 Solicitar Perforación',
          description: 'Tramitar autorización para perforación'
        },
        { 
          id: 'renuncia', 
          title: '🧾 Tramitar Renuncia',
          description: 'Gestionar renuncia a derechos de riego'
        }
      ]
    },
    {
      title: 'Asistencia',
      rows: [
        { 
          id: 'operador', 
          title: '👤 Hablar con Operador',
          description: 'Conectar con un agente humano'
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

/**
 * Maneja las opciones del menú principal
 */
const handleMainMenu = async (from, option) => {
  switch (option) {
    case '1':
    case 'option_1':
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
      const infoText = `� Empadronamiento / Pedido de Agua

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

    case '3':
    case 'option_3':
    case 'deuda':
      // Consultar Deuda: Verificar si tiene DNI vinculado
      await handleConsultarDeuda(from);
      break;

    case 'boleto':
      // Unificado: primero consultar deuda y luego ofrecer boleto
      await sendMessageAndSave(from, '📄 Para solicitar un boleto primero debemos consultar tu deuda.');
      await handleConsultarDeuda(from);
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

    case 'turnos': {
      const turnosText = `🗓️ Turnos

La gestión de turnos se realiza en Inspección de Cauce.`;
      await sendMessageAndSave(from, turnosText);
      await sendMessageAndSave(from, 'Contacto: +54 9 260 432-0807');
      await sendMenuList(from, true);
      console.log(`🗓️ Info de turnos enviada a ${from}`);
      break;
    }

    case '4':
    case 'option_4':
    case 'operador': {
      const operatorText = `👤 Derivando a un Agente

Un operador humano te atenderá en breve.`;
      await sendMessageAndSave(from, operatorText);
      await clienteService.cambiarEstadoBot(from, false);
      if (global.io) {
        global.io.emit('bot_mode_changed', { telefono: from, bot_activo: false });
      }
      console.log(`👤 Derivado a operador y bot pausado para ${from}`);
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
  // Extraer números del mensaje usando RegEx
  const match = messageBody.match(/\d+/);
  const padron = match ? match[0] : null;

  // Validar que se encontró un número
  if (!padron) {
    await whatsappService.sendMessage(
      from,
      '⚠️ No detectamos un número válido. Por favor escribí solo tu número de padrón (Ej: 1234).'
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
        `❌ No encontramos el padrón ${padron} en nuestra base de datos. Por favor verifique el número.`
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

    await whatsappService.sendInteractiveButtons(from, bodyText, buttons);
    
    // Enviar más opciones (contactar operador y salir)
    setTimeout(async () => {
      const moreButtons = [
        { id: 'auth_contact', title: '👤 Contactar Operador' },
        { id: 'auth_salir', title: '🚪 Salir' }
      ];
      await whatsappService.sendInteractiveButtons(
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
      const contactText = `👤 Derivando a un Agente

Su consulta ha sido registrada. Un operador humano se pondrá en contacto a la brevedad.

⏳ Tiempo de espera estimado: 5 minutos.`;
      
      await whatsappService.sendMessage(from, contactText);
      console.log(`👤 Mensaje de contacto enviado a ${from}`);
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
    // Verificar si ya tiene padrón guardado
    const cliente = await clienteService.obtenerCliente(from);
    
    if (cliente && cliente.padron_superficial) {
      // Tiene padrón superficial: Usar padrón
      const searchingMsg = `🔍 Buscando deuda para tu padrón superficial...\n\n⏳ Por favor espera, esto puede tardar unos segundos.`;
      await sendMessageAndSave(from, searchingMsg);
      await ejecutarScraperPadron(from, cliente, 'superficial');
      
    } else if (cliente && cliente.padron_subterraneo) {
      // Tiene padrón subterráneo: Usar padrón
      const searchingMsg = `🔍 Buscando deuda para tu padrón subterráneo...\n\n⏳ Por favor espera, esto puede tardar unos segundos.`;
      await sendMessageAndSave(from, searchingMsg);
      await ejecutarScraperPadron(from, cliente, 'subterraneo');
      
    } else if (cliente && cliente.padron_contaminacion) {
      // Tiene padrón contaminación: Usar padrón
      const searchingMsg = `🔍 Buscando deuda para tu padrón de contaminación...\n\n⏳ Por favor espera, esto puede tardar unos segundos.`;
      await sendMessageAndSave(from, searchingMsg);
      await ejecutarScraperPadron(from, cliente, 'contaminacion');
      
    } else if (cliente && cliente.dni) {
      // Tiene DNI: Ejecutar scraper directamente
      const searchingMsg = `🔍 Buscando deuda para el DNI vinculado *${cliente.dni}*...\n\n⏳ Por favor espera, esto puede tardar unos segundos.`;
      await sendMessageAndSave(from, searchingMsg);
      await ejecutarScraper(from, cliente.dni);
      
    } else {
      // No tiene nada: Ofrecer elección inicial DNI vs Padrón
      const preguntaMsg = `📝 *¿Cómo deseas consultar tu deuda?*`;
      await sendMessageAndSave(from, preguntaMsg);
      
      const buttons = [
        { id: 'modo_dni', title: '🆔 Por DNI' },
        { id: 'modo_padron', title: '📋 Por Padrón' }
      ];
      
      await whatsappService.sendButtonReply(
        from,
        'Elige una opción:',
        buttons
      );
      
      userStates[from].step = 'AWAITING_MODO_CONSULTA';
      userStates[from].operacion = 'deuda';
      console.log(`📝 Esperando elección de modo (DNI vs Padrón) para ${from}`);
    }
    
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
    // Verificar si ya tiene padrón o DNI guardado
    const cliente = await clienteService.obtenerCliente(from);
    
    if (cliente && cliente.padron_superficial) {
      // Tiene padrón superficial: Preguntar tipo de cuota
      const preguntaMsg = `📄 *Selecciona el tipo de boleto que deseas generar:*`;
      await sendMessageAndSave(from, preguntaMsg);
      
      const buttons = [
        { id: 'cuota_anual', title: '📅 Cuota Anual' },
        { id: 'cuota_bimestral', title: '📆 Cuota Bimestral' }
      ];
      
      await whatsappService.sendButtonReply(
        from,
        'Elige el tipo de cuota:',
        buttons
      );
      
      userStates[from].tempPadron = cliente.padron_superficial;
      userStates[from].tempTipoPadron = 'superficial';
      userStates[from].step = 'AWAITING_TIPO_CUOTA_PADRON';
      console.log(`📝 Esperando tipo de cuota para padrón superficial de ${from}`);
      
    } else if (cliente && cliente.padron_subterraneo) {
      const preguntaMsg = `📄 *Selecciona el tipo de boleto que deseas generar:*`;
      await sendMessageAndSave(from, preguntaMsg);
      
      const buttons = [
        { id: 'cuota_anual', title: '📅 Cuota Anual' },
        { id: 'cuota_bimestral', title: '📆 Cuota Bimestral' }
      ];
      
      await whatsappService.sendButtonReply(
        from,
        'Elige el tipo de cuota:',
        buttons
      );
      
      userStates[from].tempPadron = cliente.padron_subterraneo;
      userStates[from].tempTipoPadron = 'subterraneo';
      userStates[from].step = 'AWAITING_TIPO_CUOTA_PADRON';
      console.log(`📝 Esperando tipo de cuota para padrón subterráneo de ${from}`);
      
    } else if (cliente && cliente.padron_contaminacion) {
      const preguntaMsg = `📄 *Selecciona el tipo de boleto que deseas generar:*`;
      await sendMessageAndSave(from, preguntaMsg);
      
      const buttons = [
        { id: 'cuota_anual', title: '📅 Cuota Anual' },
        { id: 'cuota_bimestral', title: '📆 Cuota Bimestral' }
      ];
      
      await whatsappService.sendButtonReply(
        from,
        'Elige el tipo de cuota:',
        buttons
      );
      
      userStates[from].tempPadron = cliente.padron_contaminacion;
      userStates[from].tempTipoPadron = 'contaminacion';
      userStates[from].step = 'AWAITING_TIPO_CUOTA_PADRON';
      console.log(`📝 Esperando tipo de cuota para padrón de contaminación de ${from}`);
      
    } else if (cliente && cliente.dni) {
      // Tiene DNI: Preguntar tipo de cuota
      const preguntaMsg = `📄 *Selecciona el tipo de boleto que deseas generar:*`;
      await sendMessageAndSave(from, preguntaMsg);
      
      const buttons = [
        { id: 'cuota_anual', title: '📅 Cuota Anual' },
        { id: 'cuota_bimestral', title: '📆 Cuota Bimestral' }
      ];
      
      await whatsappService.sendButtonReply(
        from,
        'Elige el tipo de cuota:',
        buttons
      );
      
      userStates[from].tempDni = cliente.dni;
      userStates[from].step = 'AWAITING_TIPO_CUOTA';
      console.log(`📝 Esperando tipo de cuota para ${from}`);
      
    } else {
      // No tiene nada: Ofrecer elección inicial DNI vs Padrón
      const preguntaMsg = `📄 *¿Cómo deseas obtener tu boleto?*`;
      await sendMessageAndSave(from, preguntaMsg);
      
      const buttons = [
        { id: 'modo_dni', title: '🆔 Por DNI' },
        { id: 'modo_padron', title: '📋 Por Padrón' }
      ];
      
      await whatsappService.sendButtonReply(
        from,
        'Elige una opción:',
        buttons
      );
      
      userStates[from].step = 'AWAITING_MODO_CONSULTA';
      userStates[from].operacion = 'boleto';
      console.log(`📝 Esperando elección de modo (DNI vs Padrón) para boleto de ${from}`);
    }
    
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
    // Validar que sea solo números
    const dni = messageBody.replace(/\D/g, ''); // Eliminar todo lo que no sea número
    
    if (!dni || dni.length < 7 || dni.length > 11) {
      const errorMsg = '⚠️ Por favor ingresa un DNI o CUIT válido (7 a 11 dígitos numéricos).\n\n_Ejemplo: 12345678_';
      await sendMessageAndSave(from, errorMsg);
      return;
    }
    
    // Guardar DNI en BD
    await clienteService.actualizarDni(from, dni);
    
    const confirmMsg = `✅ DNI *${dni}* vinculado correctamente a tu WhatsApp.\n\n🔍 Buscando tu deuda...`;
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
    // Validar que sea solo números
    const dni = messageBody.replace(/\D/g, ''); // Eliminar todo lo que no sea número
    
    if (!dni || dni.length < 7 || dni.length > 11) {
      const errorMsg = '⚠️ Por favor ingresa un DNI o CUIT válido (7 a 11 dígitos numéricos).\n\n_Ejemplo: 12345678_';
      await sendMessageAndSave(from, errorMsg);
      return;
    }
    
    // Guardar DNI en BD
    await clienteService.actualizarDni(from, dni);
    
    const confirmMsg = `✅ DNI *${dni}* vinculado correctamente a tu WhatsApp.\n\n📄 *Selecciona el tipo de boleto:*`;
    await sendMessageAndSave(from, confirmMsg);
    
    // Preguntar tipo de cuota
    const buttons = [
      { id: 'cuota_anual', title: '📅 Cuota Anual' },
      { id: 'cuota_bimestral', title: '📆 Cuota Bimestral' }
    ];
    
    await whatsappService.sendButtonReply(
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
      tipoCuotaTexto = 'Cuota Anual';
    } else if (option === 'cuota_bimestral') {
      tipoCuota = 'bimestral';
      tipoCuotaTexto = 'Cuota Bimestral';
    } else {
      const errorMsg = '❌ Opción no válida. Por favor intenta nuevamente.';
      await sendMessageAndSave(from, errorMsg);
      await sendMenuList(from, true);
      return;
    }
    
    const searchingMsg = `📄 Generando boleto de *${tipoCuotaTexto}* para el DNI *${dni}*...\n\n⏳ Por favor espera, esto puede tardar unos segundos.`;
    await sendMessageAndSave(from, searchingMsg);
    
    // Ejecutar scraper con tipo de cuota
    await ejecutarScraperBoleto(from, dni, tipoCuota);
    
    // Volver al menú principal
    userStates[from].step = 'MAIN_MENU';
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
      tipoCuotaTexto = 'Cuota Anual';
    } else if (option === 'cuota_bimestral') {
      tipoCuota = 'bimestral';
      tipoCuotaTexto = 'Cuota Bimestral';
    } else {
      const errorMsg = '❌ Opción no válida. Por favor intenta nuevamente.';
      await sendMessageAndSave(from, errorMsg);
      await sendMenuList(from, true);
      return;
    }
    
    const searchingMsg = `📄 Generando boleto de *${tipoCuotaTexto}* para padrón *${tipoPadron}* (${padronData})...\n\n⏳ Por favor espera, esto puede tardar unos segundos.`;
    await sendMessageAndSave(from, searchingMsg);
    
    // Ejecutar scraper con padrón y tipo de cuota
    await ejecutarScraperBoletoPadron(from, padronData, tipoPadron, tipoCuota);
    
    // Volver al menú principal
    userStates[from].step = 'MAIN_MENU';
    delete userStates[from].tempPadron;
    delete userStates[from].tempTipoPadron;
    
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
    
    // Extraer DNI del nombre del archivo
    const dniMatch = pdfPath.match(/boleto_(\d+)\.pdf/);
    const dni = dniMatch ? dniMatch[1] : 'usuario';
    
    // Enviar documento
    await whatsappService.sendDocument(
      from,
      mediaId,
      `Boleto_${dni}.pdf`,
      `Boleto de pago - DNI ${dni}`
    );
    
    console.log(`📄 PDF enviado a ${from}`);
    
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

    await whatsappService.sendButtonReply(
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
const ejecutarScraper = async (from, dni) => {
  try {
    // Ejecutar scraping con el nuevo servicio
    const resultado = await debtScraperService.obtenerDeudaYBoleto(dni);
    
    if (!resultado.success) {
      // Error en scraping - Ofrecer al usuario hablar con operador
      const errorMsg = `⚠️ Tuvimos problemas buscando tu padrón.\n\n¿Deseas comunicarte con un operador para que te ayude?`;
      await sendMessageAndSave(from, errorMsg);
      
      // Enviar botones con opciones
      const buttons = [
        { id: 'op_si_operador', title: 'Sí, con operador' },
        { id: 'op_reintentar_dni', title: 'Reintentar DNI' },
        { id: 'op_no_operador', title: 'Otro trámite' }
      ];
      
      await whatsappService.sendButtonReply(
        from,
        'Elige una opción:',
        buttons
      );
      
      // Cambiar estado a esperar respuesta del operador
      userStates[from].step = 'AWAITING_OPERATOR_CHOICE';
      console.log(`⚠️ Error en scraper, ofreciendo operador a ${from}`);
      return;
    }
    
    // ============================================
    // RESPUESTA CON DATOS ENRIQUECIDOS
    // ============================================
    const { titular, cuit, hectareas, capital, interes, apremio, eventuales, total } = resultado.data;
    
    const datosMsg = `✅ *Consulta Exitosa*

👤 *Titular:* ${titular}
🆔 *CUIT:* ${cuit}
🌾 *Hectáreas:* ${hectareas}

💵 *Detalle de Deuda:*
• Capital: ${capital}
• Interés: ${interes}
• Apremio: ${apremio}
• Eventuales: ${eventuales}

💰 *TOTAL: ${total}*`;
    
    await sendMessageAndSave(from, datosMsg);
    
    // Guardar PDF path en el estado para descarga a demanda
    if (resultado.pdfPath) {
      userStates[from].tempPdf = resultado.pdfPath;
      console.log(`💾 PDF guardado en estado: ${resultado.pdfPath}`);
    }

    // Guardar DNI para posible generación de boleto
    userStates[from].tempDni = dni;
    
    console.log(`✅ Consulta de deuda completada para ${from}`);

    // Ofrecer generar boleto o volver al menú
    const opcionesMsg = `📄 *¿Deseas generar un boleto de pago?*`;
    await sendMessageAndSave(from, opcionesMsg);

    const buttons = [
      { id: 'pedir_boleto', title: '📄 Pedir boleto' },
      { id: 'volver_menu', title: '↩️ Volver' }
    ];

    await whatsappService.sendButtonReply(from, 'Elige una opción:', buttons);
    userStates[from].step = 'AWAITING_BOLETO_POST_DEUDA';
    
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
    // Ejecutar scraping solo para boleto
    const resultado = await debtScraperService.obtenerSoloBoleto(dni, tipoCuota);
    
    if (!resultado.success) {
      const errorMsg = `⚠️ No pudimos generar el boleto para el DNI ${dni}.\n\nPor favor verifica que el DNI sea correcto o intenta más tarde.`;
      await sendMessageAndSave(from, errorMsg);
      await sendMenuList(from, true);
      return;
    }
    
    // Enviar el PDF directamente si existe
    if (resultado.pdfPath && fs.existsSync(resultado.pdfPath)) {
      const sendingMsg = '📤 Enviando boleto de pago...';
      await sendMessageAndSave(from, sendingMsg);
      
      // Subir PDF a WhatsApp
      const mediaId = await whatsappService.uploadMedia(resultado.pdfPath, 'application/pdf');
      
      // Enviar documento
      await whatsappService.sendDocument(
        from,
        mediaId,
        `Boleto_${tipoCuota}_${dni}.pdf`,
        `Boleto de pago ${tipoCuota} - DNI ${dni}`
      );
      
      const successMsg = `✅ *Boleto Enviado*\n\nTu boleto de ${tipoCuota === 'anual' ? 'Cuota Anual' : 'Cuota Bimestral'} ha sido generado exitosamente.`;
      await sendMessageAndSave(from, successMsg);
      
      // Limpiar archivo después de enviar
      try {
        fs.unlinkSync(resultado.pdfPath);
        console.log(`🗑️ Archivo ${resultado.pdfPath} eliminado`);
      } catch (e) {
        console.warn(`⚠️ No se pudo eliminar ${resultado.pdfPath}:`, e.message);
      }
    } else {
      const noPdfMsg = '⚠️ No se pudo generar el boleto.\n\nPor favor intenta más tarde.';
      await sendMessageAndSave(from, noPdfMsg);
    }
    
    console.log(`✅ Boleto enviado a ${from}`);
    
    // Mostrar menú principal nuevamente
    await sendMenuList(from, true);
    
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

/**
 * Manejar selección de método de consulta (DNI vs Padrón)
 */
const handleModoConsulta = async (from, option) => {
  try {
    const operacion = userStates[from].operacion || 'deuda';
    
    if (option === 'modo_dni') {
      // El usuario eligió consultar por DNI
      const msg = '🆔 *Ingresa tu número de DNI (sin puntos ni espacios)*\n\nEj: 12345678';
      await sendMessageAndSave(from, msg);
      
      if (operacion === 'boleto') {
        userStates[from].step = 'AWAITING_DNI_BOLETO';
      } else {
        userStates[from].step = 'AWAITING_DNI';
      }
      console.log(`📝 Esperando DNI para ${operacion} de ${from}`);
      
    } else if (option === 'modo_padron') {
      // El usuario eligió consultar por Padrón
      const msg = '📋 *Selecciona el tipo de padrón:*';
      await sendMessageAndSave(from, msg);
      
      const buttons = [
        { id: 'tipo_padron_a', title: '🌾 A) Superficial' },
        { id: 'tipo_padron_b', title: '💧 B) Subterráneo' },
        { id: 'tipo_padron_c', title: '🛢️ C) Contaminación' }
      ];
      
      await whatsappService.sendButtonReply(
        from,
        'Elige el tipo de padrón:',
        buttons
      );
      
      userStates[from].step = 'AWAITING_TIPO_PADRON';
      console.log(`📝 Esperando selección de tipo de padrón de ${from}`);
    }
  } catch (error) {
    console.error('❌ Error en handleModoConsulta:', error);
    const errorMsg = '❌ Ocurrió un error. Por favor intenta de nuevo.';
    await sendMessageAndSave(from, errorMsg);
  }
};

/**
 * Manejar selección de tipo de padrón (A, B o C)
 */
const handleTipoPadron = async (from, option) => {
  try {
    const operacion = userStates[from].operacion || 'deuda';
    
    if (option === 'tipo_padron_a') {
      // Padrón Superficial
      const msg = '🌾 *Padrón Superficial*\n\nIngresa el código de cauce y número de padrón\n\n_Formato: código de cauce (espacio) número de padrón_\n\nEj: 8234 1710';
      await sendMessageAndSave(from, msg);
      userStates[from].step = 'AWAITING_PADRON_SUPERFICIAL';
      userStates[from].tempTipoPadron = 'superficial';
      
    } else if (option === 'tipo_padron_b') {
      // Padrón Subterráneo
      const msg = '💧 *Padrón Subterráneo*\n\nIngresa el código de departamento y número de pozo\n\n_Formato: código de departamento (espacio) número de pozo_\n\nEj: 10 5';
      await sendMessageAndSave(from, msg);
      userStates[from].step = 'AWAITING_PADRON_SUBTERRANEO';
      userStates[from].tempTipoPadron = 'subterraneo';
      
    } else if (option === 'tipo_padron_c') {
      // Padrón Contaminación
      const msg = '🛢️ *Padrón Contaminación*\n\nIngresa el número de contaminación\n\nEj: 12345';
      await sendMessageAndSave(from, msg);
      userStates[from].step = 'AWAITING_PADRON_CONTAMINACION';
      userStates[from].tempTipoPadron = 'contaminacion';
    }
    
    console.log(`📝 Esperando datos de padrón tipo ${userStates[from].tempTipoPadron} de ${from}`);
  } catch (error) {
    console.error('❌ Error en handleTipoPadron:', error);
    const errorMsg = '❌ Ocurrió un error. Por favor intenta de nuevo.';
    await sendMessageAndSave(from, errorMsg);
  }
};

/**
 * Manejar input de padrón superficial
 */
const handlePadronSuperficial = async (from, messageBody) => {
  try {
    const operacion = userStates[from].operacion || 'deuda';
    const partes = messageBody.trim().split(/\s+/);
    
    if (partes.length !== 2) {
      const msg = '❌ Formato incorrecto. Por favor ingresa:\n\nCódigo de cauce (espacio) Número de padrón\n\nEj: 8234 1710';
      await sendMessageAndSave(from, msg);
      return;
    }
    
    const codigoCauce = partes[0];
    const numeroPadron = partes[1];
    
    // Guardar en base de datos
    await clienteService.actualizarPadronSuperficial(from, codigoCauce, numeroPadron);
    console.log(`✅ Padrón superficial guardado: ${from} -> ${codigoCauce} ${numeroPadron}`);
    
    // Ejecutar la operación
    if (operacion === 'boleto') {
      userStates[from].tempPadron = `${codigoCauce} ${numeroPadron}`;
      
      // Preguntar tipo de cuota
      const preguntaMsg = `📄 *Selecciona el tipo de boleto que deseas generar:*`;
      await sendMessageAndSave(from, preguntaMsg);
      
      const buttons = [
        { id: 'cuota_anual', title: '📅 Cuota Anual' },
        { id: 'cuota_bimestral', title: '📆 Cuota Bimestral' }
      ];
      
      await whatsappService.sendButtonReply(
        from,
        'Elige el tipo de cuota:',
        buttons
      );
      
      userStates[from].step = 'AWAITING_TIPO_CUOTA_PADRON';
    } else {
      // Operación: deuda
      const cliente = { padron_superficial: `${codigoCauce} ${numeroPadron}` };
      await ejecutarScraperPadron(from, cliente, 'superficial');
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
    const operacion = userStates[from].operacion || 'deuda';
    const partes = messageBody.trim().split(/\s+/);
    
    if (partes.length !== 2) {
      const msg = '❌ Formato incorrecto. Por favor ingresa:\n\nCódigo de departamento (espacio) Número de pozo\n\nEj: 10 5';
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
        { id: 'cuota_bimestral', title: '📆 Cuota Bimestral' }
      ];
      
      await whatsappService.sendButtonReply(
        from,
        'Elige el tipo de cuota:',
        buttons
      );
      
      userStates[from].step = 'AWAITING_TIPO_CUOTA_PADRON';
    } else {
      // Operación: deuda
      const cliente = { padron_subterraneo: `${codigoDepartamento} ${numeroPozo}` };
      await ejecutarScraperPadron(from, cliente, 'subterraneo');
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
    const operacion = userStates[from].operacion || 'deuda';
    const numeroContaminacion = messageBody.trim();
    
    if (!numeroContaminacion || numeroContaminacion.length === 0) {
      const msg = '❌ Por favor ingresa un número de contaminación válido.\n\nEj: 12345';
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
        { id: 'cuota_bimestral', title: '📆 Cuota Bimestral' }
      ];
      
      await whatsappService.sendButtonReply(
        from,
        'Elige el tipo de cuota:',
        buttons
      );
      
      userStates[from].step = 'AWAITING_TIPO_CUOTA_PADRON';
    } else {
      // Operación: deuda
      const cliente = { padron_contaminacion: numeroContaminacion };
      await ejecutarScraperPadron(from, cliente, 'contaminacion');
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
const ejecutarScraperPadron = async (from, cliente, tipoPadron) => {
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
    
    console.log(`⚙️ Ejecutando scraper de deuda con padrón ${tipoPadron}:`, padronData);
    
    const msg = `⏳ Consultando deuda con padrón ${tipoPadron}...`;
    await sendMessageAndSave(from, msg);
    
    // Llamar al scraper con padrón
    const resultado = await debtScraperService.obtenerDeudaPadron(tipoPadron, padronData);
    
    if (!resultado.success) {
      await sendMessageAndSave(from, `❌ Error: ${resultado.error}`);
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
    const deudaMsg = `📊 *DEUDA ENCONTRADA - Padrón ${tipoPadron.toUpperCase()}*\n\n` +
      `👤 *Titular:* ${datos.titular}\n` +
      `🆔 *CUIT:* ${datos.cuit}\n` +
      `🌾 *Hectáreas:* ${datos.hectareas}\n\n` +
      `💰 *DEUDA:*\n` +
      `Capital: ${datos.capital}\n` +
      `Interés: ${datos.interes}\n` +
      `Apremio: ${datos.apremio}\n` +
      `Eventuales: ${datos.eventuales}\n\n` +
      `*💵 TOTAL A PAGAR: ${datos.total}*`;
    
    await sendMessageAndSave(from, deudaMsg);
    
    // Ofrecer generar boleto o volver al menú
    const opcionesMsg = `📄 *¿Deseas generar un boleto de pago?*`;
    await sendMessageAndSave(from, opcionesMsg);

    const buttons = [
      { id: 'pedir_boleto', title: '📄 Pedir boleto' },
      { id: 'volver_menu', title: '↩️ Volver' }
    ];

    await whatsappService.sendButtonReply(from, 'Elige una opción:', buttons);
    userStates[from].step = 'AWAITING_BOLETO_POST_DEUDA';
    
  } catch (error) {
    console.error('❌ Error en ejecutarScraperPadron:', error);
    const errorMsg = '❌ Ocurrió un error al consultar la deuda. Por favor intenta más tarde.';
    await sendMessageAndSave(from, errorMsg);
    await sendMenuList(from, true);
  }
};

/**
 * Ejecutar scraper de boleto con padrón
 */
const ejecutarScraperBoletoPadron = async (from, padronData, tipoPadron, tipoCuota) => {
  try {
    console.log(`⚙️ Ejecutando scraper de boleto con padrón ${tipoPadron} - ${tipoCuota}`);
    
    const msg = `📄 Generando boleto de *${tipoCuota === 'anual' ? 'Cuota Anual' : 'Cuota Bimestral'}* con padrón ${tipoPadron}...\n\n⏳ Por favor espera, esto puede tardar unos segundos.`;
    await sendMessageAndSave(from, msg);
    
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
    
    const resultado = await debtScraperService.obtenerBoletoPadron(tipoPadron, datosParaScrap, tipoCuota);
    
    if (!resultado.success) {
      await sendMessageAndSave(from, `❌ Error: ${resultado.error}`);
      await sendMenuList(from, true);
      return;
    }
    
    if (resultado.pdfPath) {
      // Enviar PDF
      await whatsappService.sendDocument(from, resultado.pdfPath, `boleto_${tipoCuota}.pdf`);
      console.log(`✅ Boleto PDF enviado: ${resultado.pdfPath}`);
    } else {
      await sendMessageAndSave(from, '⚠️ No se pudo descargar el boleto, pero la consulta fue exitosa.');
    }
    
    // Volver al menú
    await sendMenuList(from, true);
    userStates[from].step = 'MAIN_MENU';
    
  } catch (error) {
    console.error('❌ Error en ejecutarScraperBoletoPadron:', error);
    const errorMsg = '❌ Ocurrió un error al generar el boleto. Por favor intenta más tarde.';
    await sendMessageAndSave(from, errorMsg);
    await sendMenuList(from, true);
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
    await sendMenuList(from, true);
    
    console.log(`🔧 Info de perforación de subterránea enviada a ${from}`);
  } catch (error) {
    console.error('Error en handleIniciarPerforacion:', error);
    await sendMessageAndSave(from, '❌ Error al mostrar información. Intenta de nuevo.');
  }
};

module.exports = {
  verifyWebhook,
  receiveMessage
};
