const whatsappService = require('../services/whatsappService');
const reganteService = require('../services/reganteService');
const mensajeService = require('../services/mensajeService');

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
        
        // Extraer el mensaje: puede ser texto o respuesta interactiva
        let messageBody = '';
        
        if (message.type === 'text') {
          messageBody = message.text?.body?.trim() || '';
        } else if (message.type === 'interactive') {
          // Puede ser list_reply o button_reply
          if (message.interactive.type === 'list_reply') {
            messageBody = message.interactive.list_reply.id;
          } else if (message.interactive.type === 'button_reply') {
            messageBody = message.interactive.button_reply.id;
          }
        }

        console.log(`💬 Mensaje de ${from}: ${messageBody} (tipo: ${message.type})`);

        // Guardar mensaje del cliente en la base de datos
        try {
          await mensajeService.guardarMensaje({
            telefono: from,
            padron: userStates[from]?.padron || null,
            remitente: 'cliente',
            contenido: messageBody
          });
          
          // Emitir evento Socket.io para actualizar dashboard en tiempo real
          if (global.io) {
            global.io.emit('nuevo_mensaje', {
              telefono: from,
              mensaje: messageBody,
              remitente: 'cliente',
              timestamp: new Date()
            });
          }
        } catch (error) {
          console.error('❌ Error al guardar mensaje del cliente:', error);
        }

        // Inicializar estado del usuario si no existe
        if (!userStates[from]) {
          userStates[from] = { step: 'START', padron: null };
        }

        // Procesar mensaje según el estado actual
        await handleUserMessage(from, messageBody);
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
const handleUserMessage = async (from, messageBody) => {
  const currentState = userStates[from].step;

  console.log(`🔄 Estado actual de ${from}: ${currentState}`);

  switch (currentState) {
    case 'START':
    default:
      // Enviar bienvenida + menú
      await sendWelcomeMessage(from);
      await sendMenuList(from);
      userStates[from].step = 'MAIN_MENU';
      break;

    case 'MAIN_MENU':
      await handleMainMenu(from, messageBody);
      break;

    case 'AWAITING_PADRON':
      await handlePadronInput(from, messageBody);
      break;

    case 'AUTH_MENU':
      await handleAuthMenu(from, messageBody);
      break;
  }
};

/**
 * Envía el mensaje de bienvenida institucional
 */
const sendWelcomeMessage = async (from) => {
  const welcomeMessage = `👋 ¡Hola! Te damos la bienvenida.

Estás comunicado con la Jefatura de Zona de Riego de ríos Malargüe, Grande, Barranca y Colorado.

Soy tu asistente virtual, diseñado para ayudarte con tus gestiones hídricas de forma rápida y sencilla. 💧`;
  
  await whatsappService.sendMessage(from, welcomeMessage);
  await saveBotMessage(from, welcomeMessage);
  console.log(`👋 Mensaje de bienvenida enviado a ${from}`);
};

/**
 * Envía la lista interactiva del menú principal
 */
const sendMenuList = async (from) => {
  const sections = [
    {
      title: 'Servicios Disponibles',
      rows: [
        {
          id: 'option_1',
          title: '📍 Ubicación y Horarios',
          description: 'Dirección y horarios de atención'
        },
        {
          id: 'option_2',
          title: '📋 Empadronamiento',
          description: 'Requisitos para registro de usuarios'
        },
        {
          id: 'option_3',
          title: '🔐 Soy Regante (Login)',
          description: 'Acceso a consultas de cuenta'
        },
        {
          id: 'option_4',
          title: '👤 Hablar con Operador',
          description: 'Atención personalizada'
        }
      ]
    }
  ];

  await whatsappService.sendInteractiveList(
    from,
    'Atención al Ciudadano',
    '¿Qué trámite desea realizar hoy?',
    'Ver Opciones',
    sections
  );
  
  // Guardar representación textual del menú
  await saveBotMessage(from, 'Menú interactivo: ¿Qué trámite desea realizar hoy? (Ubicación, Empadronamiento, Regante, Operador)');
  
  console.log(`📋 Lista de menú enviada a ${from}`);
};

/**
 * Maneja las opciones del menú principal
 */
const handleMainMenu = async (from, option) => {
  switch (option) {
    case '1':
    case 'option_1':
      const locationText = `📍 Nuestras Oficinas

🏛️ Dirección: Av. San Martín 123, Malargüe (Mendoza)

🕒 Horarios de Atención:
• Lunes a Viernes: 08:00 a 13:00 hs
• Sábados y Domingos: Cerrado

🗺️ Te esperamos para resolver tus consultas presenciales.`;
      
      await whatsappService.sendMessage(from, locationText);
      // Reenviar solo la lista, sin bienvenida
      await sendMenuList(from);
      console.log(`📍 Info de ubicación enviada a ${from}`);
      break;

    case '2':
    case 'option_2':
      const infoText = `📋 Requisitos de Empadronamiento

Para darte de alta como usuario del sistema hídrico, acercate con:

✅ DNI del Titular (Original y Copia)
✅ Escritura de la Propiedad (Copia certificada)
✅ Plano de Mensura (Si posee)

ℹ️ El trámite es personal y presencial.`;
      
      await whatsappService.sendMessage(from, infoText);
      // Reenviar solo la lista, sin bienvenida
      await sendMenuList(from);
      console.log(`📋 Info de empadronamiento enviada a ${from}`);
      break;

    case '3':
    case 'option_3':
      const askPadronText = `🔐 Acceso a Cuenta de Regante

Para consultar su deuda o estado, por favor ingrese su Número de Padrón (sin puntos ni guiones).

_Ejemplo: 12345_`;
      
      await whatsappService.sendMessage(from, askPadronText);
      userStates[from].step = 'AWAITING_PADRON';
      console.log(`🔑 Solicitando padrón a ${from}`);
      break;

    case '4':
    case 'option_4':
      const operatorText = `👤 Derivando a un Agente

Su consulta ha sido registrada. Un operador humano se pondrá en contacto a la brevedad.

⏳ Tiempo de espera estimado: 5 minutos.`;
      
      await whatsappService.sendMessage(from, operatorText);
      // Reenviar solo la lista, sin bienvenida
      await sendMenuList(from);
      console.log(`👤 Mensaje de operador enviado a ${from}`);
      break;

    default:
      // Opción no válida, reenviar solo la lista
      await whatsappService.sendMessage(from, '❌ Opción no válida. Por favor elegí una opción del menú:');
      await sendMenuList(from);
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
      
      await whatsappService.sendMessage(from, goodbyeText);
      await saveBotMessage(from, goodbyeText);
      userStates[from] = { step: 'START', padron: null };
      console.log(`👋 Usuario ${from} salió del sistema`);
      break;

    default:
      // Opción no válida
      await whatsappService.sendMessage(from, '❌ Opción no válida. Por favor elegí una opción del menú:');
      await saveBotMessage(from, '❌ Opción no válida. Por favor elegí una opción del menú:');
      await handlePadronInput(from, padron);
      console.log(`⚠️ Opción inválida en AUTH_MENU de ${from}`);
      break;
  }
};

/**
 * Guarda el mensaje del bot en la base de datos y emite evento Socket.io
 */
const saveBotMessage = async (telefono, contenido) => {
  try {
    await mensajeService.guardarMensaje({
      telefono,
      padron: userStates[telefono]?.padron || null,
      remitente: 'bot',
      contenido
    });
    
    // Emitir evento Socket.io
    if (global.io) {
      global.io.emit('nuevo_mensaje', {
        telefono,
        mensaje: contenido,
        remitente: 'bot',
        timestamp: new Date()
      });
    }
  } catch (error) {
    console.error('❌ Error al guardar mensaje del bot:', error);
  }
};

module.exports = {
  verifyWebhook,
  receiveMessage
};
