const whatsappService = require('../services/whatsappService');
const userService = require('../services/userService');
const scraperService = require('../services/scraperService');
const mensajeService = require('../services/mensajeService');
const clienteService = require('../services/clienteService');

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
        const pushName = body.entry[0].changes[0].value.contacts?.[0]?.profile?.name || 'Sin Nombre';
        
        let cliente = null;
        let esClienteNuevo = false;
        try {
          cliente = await clienteService.obtenerOCrearCliente(from, pushName);
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
          if (message.interactive.type === 'list_reply') {
            messageBody = message.interactive.list_reply.id;
          } else if (message.interactive.type === 'button_reply') {
            messageBody = message.interactive.button_reply.id;
          }
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

        // Helper para guardar/emitir el mensaje del cliente DESPUÉS de responder
        const persistIncoming = async () => {
          try {
            await mensajeService.guardarMensaje({
              telefono: from,
              tipo: tipoMensaje,
              cuerpo: messageBody,
              url_archivo: mediaUrl
            });

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
        };

        // ============================================
        // VERIFICAR ESTADO DEL BOT ANTES DE RESPONDER
        // ============================================
        const botActivo = await clienteService.esBotActivo(from);
        
        if (!botActivo) {
          console.log(`⏸️ Bot pausado para ${from} - Mensaje guardado sin respuesta automática`);
          
          // Emitir solo para que el operador vea el mensaje
          if (global.io) {
            global.io.emit('bot_pausado', {
              telefono: from,
              mensaje: messageBody,
              timestamp: new Date()
            });
          }
          
          // Guardar mensaje (aunque el bot esté pausado)
          await persistIncoming();
          
          // No enviar respuesta automática
          return res.sendStatus(200);
        }

        // Inicializar estado del usuario si no existe
        if (!userStates[from]) {
          userStates[from] = { step: 'START', padron: null, nombreCliente: cliente?.nombre_whatsapp || pushName, esClienteNuevo };
        }

        // Procesar mensaje según el estado actual
        await handleUserMessage(from, messageBody);

        // Guardar mensaje del cliente EN BACKGROUND (sin bloquear respuesta)
        // Se ejecuta async pero no esperamos su resultado
        persistIncoming().catch(error => {
          console.error('❌ Error en persistIncoming background:', error);
        });
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
    await whatsappService.sendMessage(from, changeDniMsg);
    await saveBotMessage(from, changeDniMsg);
    userStates[from].step = 'AWAITING_DNI';
    console.log(`🔄 Usuario ${from} solicita cambiar DNI`);
    return;
  }

  switch (currentState) {
    case 'START':
    default:
      // Enviar bienvenida + menú (personalizado si es cliente conocido)
      await sendWelcomeMessage(from, userStates[from].nombreCliente, userStates[from].esClienteNuevo);
      await sendMenuList(from);
      userStates[from].step = 'MAIN_MENU';
      break;

    case 'MAIN_MENU':
      await handleMainMenu(from, messageBody);
      break;

    case 'AWAITING_DNI':
      await handleDniInput(from, messageBody);
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
          title: '� Consultar Deuda',
          description: 'Ver estado de cuenta y boleto'
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
      await saveBotMessage(from, infoText);
      // Reenviar solo la lista, sin bienvenida
      await sendMenuList(from);
      console.log(`📋 Info de empadronamiento enviada a ${from}`);
      break;

    case '3':
    case 'option_3':
      // Consultar Deuda: Verificar si tiene DNI vinculado
      await handleConsultarDeuda(from);
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
 * Manejar consulta de deuda (option_3)
 */
const handleConsultarDeuda = async (from) => {
  try {
    // Verificar si ya tiene DNI vinculado
    const dni = await clienteService.obtenerDni(from);
    
    if (dni) {
      // Tiene DNI: Ejecutar scraper directamente
      const searchingMsg = `🔍 Buscando deuda para el DNI vinculado *${dni}*...\n\n⏳ Por favor espera, esto puede tardar unos segundos.`;
      await whatsappService.sendMessage(from, searchingMsg);
      await saveBotMessage(from, searchingMsg);
      
      // Ejecutar scraper
      await ejecutarScraper(from, dni);
      
    } else {
      // No tiene DNI: Solicitar DNI
      const askDniText = `📝 Para consultar tu deuda, por favor ingresa tu *DNI o CUIT* (sin puntos ni guiones).

_Ejemplo: 12345678_

Este número quedará vinculado a tu WhatsApp para futuras consultas.`;
      
      await whatsappService.sendMessage(from, askDniText);
      await saveBotMessage(from, askDniText);
      userStates[from].step = 'AWAITING_DNI';
      console.log(`📝 Solicitando DNI a ${from}`);
    }
    
  } catch (error) {
    console.error('❌ Error en handleConsultarDeuda:', error);
    const errorMsg = '❌ Ocurrió un error al procesar tu solicitud. Por favor intenta más tarde.';
    await whatsappService.sendMessage(from, errorMsg);
    await saveBotMessage(from, errorMsg);
    await sendMenuList(from);
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
      await whatsappService.sendMessage(from, errorMsg);
      await saveBotMessage(from, errorMsg);
      return;
    }
    
    // Guardar DNI en BD
    await clienteService.actualizarDni(from, dni);
    
    const confirmMsg = `✅ DNI *${dni}* vinculado correctamente a tu WhatsApp.\n\n🔍 Buscando tu deuda...`;
    await whatsappService.sendMessage(from, confirmMsg);
    await saveBotMessage(from, confirmMsg);
    
    // Ejecutar scraper
    await ejecutarScraper(from, dni);
    
    // Volver al menú principal
    userStates[from].step = 'MAIN_MENU';
    
  } catch (error) {
    console.error('❌ Error en handleDniInput:', error);
    const errorMsg = '❌ Ocurrió un error al vincular tu DNI. Por favor intenta más tarde.';
    await whatsappService.sendMessage(from, errorMsg);
    await saveBotMessage(from, errorMsg);
    await sendMenuList(from);
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
      await whatsappService.sendMessage(from, noPdfMsg);
      await saveBotMessage(from, noPdfMsg);
      await sendMenuList(from);
      return;
    }
    
    // Verificar si el archivo existe
    if (!fs.existsSync(pdfPath)) {
      const expiredMsg = '⚠️ El boleto ha expirado o ya fue descargado.\n\nPor favor realiza una nueva consulta.';
      await whatsappService.sendMessage(from, expiredMsg);
      await saveBotMessage(from, expiredMsg);
      
      // Limpiar estado
      delete userStates[from].tempPdf;
      
      await sendMenuList(from);
      return;
    }
    
    // Enviar mensaje de procesamiento
    const sendingMsg = '📤 Enviando boleto de pago...';
    await whatsappService.sendMessage(from, sendingMsg);
    await saveBotMessage(from, sendingMsg);
    
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
    await whatsappService.sendMessage(from, successMsg);
    await saveBotMessage(from, successMsg);
    await sendMenuList(from);
    
  } catch (error) {
    console.error('❌ Error al enviar boleto:', error);
    const errorMsg = '❌ Ocurrió un error al enviar el boleto. Por favor intenta más tarde.';
    await whatsappService.sendMessage(from, errorMsg);
    await saveBotMessage(from, errorMsg);
    await sendMenuList(from);
  }
};

/**
 * Ejecutar scraper y enviar resultado (OPTIMIZADO)
 */
const ejecutarScraper = async (from, dni) => {
  try {
    // Ejecutar scraping (retorna datos extendidos)
    const resultado = await scraperService.obtenerDatosDeuda(dni);
    
    if (!resultado.success) {
      // Error en scraping
      const errorMsg = `❌ ${resultado.error || 'No se pudo consultar la deuda'}.\n\nPor favor intenta más tarde o comunícate con nuestras oficinas.`;
      await whatsappService.sendMessage(from, errorMsg);
      await saveBotMessage(from, errorMsg);
      await sendMenuList(from);
      return;
    }
    
    // ============================================
    // RESPUESTA CON DATOS ENRIQUECIDOS
    // ============================================
    const { titular, cuit, hectareas, deuda, servicio } = resultado.data;
    
    const datosMsg = `✅ *Consulta Exitosa*

👤 *Titular:* ${titular}
🆔 *CUIT:* ${cuit}
🌾 *Finca:* ${hectareas}
📋 *Servicio:* ${servicio}

💰 *DEUDA TOTAL:* ${deuda}`;
    
    await whatsappService.sendMessage(from, datosMsg);
    await saveBotMessage(from, datosMsg);
    
    // Guardar PDF path en el estado para descarga a demanda
    if (resultado.pdfPath) {
      userStates[from].tempPdf = resultado.pdfPath;
      console.log(`💾 PDF guardado en estado: ${resultado.pdfPath}`);
    }
    
    // ============================================
    // BOTONES DE ACCIÓN
    // ============================================
    const buttons = [
      { id: 'btn_descargar_boleto', title: '📄 Descargar Boleto' },
      { id: 'btn_cambiar_dni', title: '🔄 Consultar otro' }
    ];
    
    await whatsappService.sendButtonReply(
      from,
      'Selecciona una opción:',
      buttons
    );
    
    console.log(`✅ Consulta de deuda completada para ${from}`);
    
  } catch (error) {
    console.error('❌ Error en ejecutarScraper:', error);
    const errorMsg = '❌ Ocurrió un error al consultar la deuda. Por favor intenta más tarde.';
    await whatsappService.sendMessage(from, errorMsg);
    await saveBotMessage(from, errorMsg);
    await sendMenuList(from);
  }
};

/**
 * Guarda el mensaje del bot en la base de datos y emite evento Socket.io
 */
const saveBotMessage = async (telefono, contenido) => {
  try {
    await mensajeService.guardarMensaje({
      telefono,
      tipo: 'bot',
      cuerpo: contenido
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
