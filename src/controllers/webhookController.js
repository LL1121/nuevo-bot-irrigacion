const whatsappService = require('../services/whatsappService');

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

  // Guardar el padrón en la memoria del usuario
  userStates[from].padron = padron;

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

  const bodyText = `✅ Bienvenido al Sistema

Padrón: *${padron}*

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
};

/**
 * Maneja las opciones del menú autenticado
 */
const handleAuthMenu = async (from, option) => {
  const padron = userStates[from].padron;

  switch (option) {
    case '1':
    case 'auth_deuda':
      const deudaText = `💰 *Estado de Cuenta - Padrón ${padron}*

*Deudas pendientes:*
• Enero 2024: $15.000
• Febrero 2024: $15.000

*Total adeudado: $30.000*

Vencimiento: 31/03/2024

Para abonar, acercate a nuestras oficinas o transferí a:
CBU: 0000000000000000000000`;
      
      await whatsappService.sendMessage(from, deudaText);
      console.log(`💰 Consulta de deuda enviada a ${from}`);
      break;

    case '2':
    case 'auth_estado':
      const estadoText = `🌊 *Estado Derecho de Riego - Padrón ${padron}*

*Estado:* ✅ HABILITADO

*Hectáreas registradas:* 10.5 ha
*Tipo de cultivo:* Soja
*Último turno:* 15/12/2024

Tu derecho de riego está al día.`;
      
      await whatsappService.sendMessage(from, estadoText);
      console.log(`🌾 Estado de riego enviado a ${from}`);
      break;

    case '3':
    case 'auth_turno':
      const turnoText = `📅 *Solicitud de Turno - Padrón ${padron}*

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
      userStates[from] = { step: 'START', padron: null };
      console.log(`👋 Usuario ${from} salió del sistema`);
      break;

    default:
      // Opción no válida
      await whatsappService.sendMessage(from, '❌ Opción no válida. Por favor elegí una opción del menú:');
      await handlePadronInput(from, padron);
      console.log(`⚠️ Opción inválida en AUTH_MENU de ${from}`);
      break;
  }
};

module.exports = {
  verifyWebhook,
  receiveMessage
};
