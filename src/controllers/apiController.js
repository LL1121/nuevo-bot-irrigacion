const mensajeService = require('../services/mensajeService');
const whatsappService = require('../services/whatsappService');
const clienteService = require('../services/clienteService');
const { getMediaInfo, fetchMediaStream } = require('../services/whatsappService');
const fs = require('fs');
const path = require('path');
const { validateFileIntegrity } = require('../services/fileValidator');

const emitToTenantRoom = async (phone, eventName, payload) => {
  if (!global.io) return;

  const subdelegacionInfo = await clienteService.obtenerSubdelegacionInfo(phone);
  const room = subdelegacionInfo?.id ? `zona_${subdelegacionInfo.id}` : null;
  if (room) {
    global.io.to(room).emit(eventName, payload);
  } else {
    global.io.emit(eventName, payload);
  }
};

const emitMessageToFrontend = (mensajeGuardado, telefono, cuerpo, tipo = 'text', extra = {}) => {
  if (!global.io || !mensajeGuardado?.id) return;

  global.io.emit('nuevo_mensaje', {
    id: mensajeGuardado.id,
    telefono,
    mensaje: cuerpo,
    emisor: extra.emisor || 'bot',
    tipo,
    timestamp: mensajeGuardado.fecha,
    ...extra
  });
};

const sendTextAndSave = async (telefono, texto, emisor = 'bot') => {
  await whatsappService.sendMessage(telefono, texto);

  const mensajeGuardado = await mensajeService.guardarMensaje({
    telefono,
    tipo: 'text',
    cuerpo: texto,
    url_archivo: null,
    emisor
  });

  emitMessageToFrontend(mensajeGuardado, telefono, texto, 'text', { emisor });
  return mensajeGuardado;
};

const sendButtonsAndSave = async (telefono, body, buttons) => {
  await whatsappService.sendButtonReply(telefono, body, buttons);

  const payload = {
    type: 'interactive_buttons',
    body,
    buttons
  };

  const mensajeGuardado = await mensajeService.guardarMensaje({
    telefono,
    tipo: 'interactive',
    cuerpo: JSON.stringify(payload),
    url_archivo: null,
    emisor: 'bot'
  });

  emitMessageToFrontend(mensajeGuardado, telefono, JSON.stringify(payload), 'interactive', { emisor: 'bot' });
  return mensajeGuardado;
};

const sendListAndSave = async (telefono, header, body, buttonText, sections) => {
  await whatsappService.sendInteractiveList(telefono, header, body, buttonText, sections);

  const payload = {
    type: 'interactive_list',
    header,
    body,
    buttonText,
    sections
  };

  const mensajeGuardado = await mensajeService.guardarMensaje({
    telefono,
    tipo: 'interactive',
    cuerpo: JSON.stringify(payload),
    url_archivo: null,
    emisor: 'bot'
  });

  emitMessageToFrontend(mensajeGuardado, telefono, JSON.stringify(payload), 'interactive', { emisor: 'bot' });
  return mensajeGuardado;
};

const resolveOperatorSubdelegacionId = async (user = {}) => {
  if (user?.subdelegacion_id) {
    return Number(user.subdelegacion_id);
  }

  if (!user?.id && !user?.username && !user?.email) {
    return null;
  }

  const { get } = require('../config/db');
  const operador = await get(
    `SELECT id, subdelegacion_id
     FROM operadores
     WHERE id = ? OR username = ? OR email = ?
     LIMIT 1`,
    [user.id || null, user.username || null, user.email || null]
  );

  return operador?.subdelegacion_id ? Number(operador.subdelegacion_id) : null;
};

/**
 * Lista todas las conversaciones activas (chats)
 */
const listarChats = async (req, res) => {
  try {
    const clientes = await clienteService.obtenerTodosLosClientes();
    
    res.json({
      success: true,
      chats: clientes,
      total: clientes.length
    });
  } catch (error) {
    console.error('❌ Error en listarChats:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener conversaciones'
    });
  }
};

/**
 * Proxy para descargar/ver media de WhatsApp por mediaId
 */
const descargarMedia = async (req, res) => {
  try {
    const { mediaId } = req.params;
    if (!mediaId) {
      return res.status(400).json({ success: false, error: 'mediaId requerido' });
    }

    const info = await getMediaInfo(mediaId); // { url, mime_type }
    if (!info?.url) {
      return res.status(404).json({ success: false, error: 'Media no encontrada' });
    }

    const { stream, contentType } = await fetchMediaStream(info.url);
    res.setHeader('Content-Type', info.mime_type || contentType || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store');
    stream.pipe(res);
  } catch (error) {
    console.error('❌ Error en descargarMedia:', error);
    res.status(500).json({ success: false, error: 'Error al descargar media' });
  }
};

/**
 * Obtiene el historial de mensajes de un teléfono
 */
const obtenerMensajes = async (req, res) => {
  try {
    const { telefono } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit) : 100;
    const offset = req.query.offset ? parseInt(req.query.offset) : 0;

    const mensajes = await mensajeService.obtenerMensajes(telefono, limit, offset);
    
    res.json({
      success: true,
      messages: mensajes,
      telefono,
      total: mensajes.length,
      limit,
      offset
    });
  } catch (error) {
    console.error('❌ Error en obtenerMensajes:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener mensajes'
    });
  }
};

/**
 * Maneja subida de archivos desde el operador
 */
const subirArchivo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No se envió archivo' });
    }

    try {
      await validateFileIntegrity(req.file.path);
    } catch (err) {
      return res.status(400).json({ success: false, error: 'Archivo rechazado por seguridad' });
    }

    const relativeUrl = `/uploads/${req.file.filename}`;

    res.json({
      success: true,
      url: relativeUrl,
      filename: req.file.filename,
      size: req.file.size
    });
  } catch (error) {
    console.error('❌ Error en subirArchivo:', error);
    res.status(500).json({ success: false, error: 'Error al subir archivo' });
  }
};

/**
 * Envía un mensaje desde el operador al cliente
 */
const enviarMensaje = async (req, res) => {
  try {
    const { telefono, mensaje, operador = 'Sistema' } = req.body;

    if (!telefono || !mensaje) {
      return res.status(400).json({
        success: false,
        error: 'Teléfono y mensaje son requeridos'
      });
    }

    // Enviar mensaje por WhatsApp
    await whatsappService.sendMessage(telefono, mensaje);

    // Guardar en base de datos con el nuevo schema
    const mensajeGuardado = await mensajeService.guardarMensaje({
      telefono,
      tipo: 'text',
      cuerpo: mensaje,
      url_archivo: null,
      emisor: 'operador'
    });

    // Emitir evento en tiempo real CON ID
    if (global.io) {
      global.io.emit('nuevo_mensaje', {
        id: mensajeGuardado.id,
        telefono,
        mensaje: mensajeGuardado.cuerpo,
        emisor: 'operador',
        tipo: 'text',
        timestamp: mensajeGuardado.fecha,
        operador
      });
    }

    res.json({
      success: true,
      message: mensajeGuardado,
      status: 'Mensaje enviado correctamente'
    });
  } catch (error) {
    console.error('❌ Error en enviarMensaje:', error);
    res.status(500).json({
      success: false,
      error: 'Error al enviar mensaje'
    });
  }
};

/**
 * Marca una conversación como leída
 */
const marcarLeido = async (req, res) => {
  try {
    const { telefono } = req.params;
    
    await mensajeService.marcarComoLeido(telefono);

    // Notificar a otros clientes conectados
    if (global.io) {
      global.io.emit('mensajes_leidos', { telefono });
    }

    res.json({
      success: true,
      message: 'Mensajes marcados como leídos'
    });
  } catch (error) {
    console.error('❌ Error en marcarLeido:', error);
    res.status(500).json({
      success: false,
      error: 'Error al marcar como leído'
    });
  }
};

/**
 * Obtiene estadísticas del panel
 */
const obtenerEstadisticas = async (req, res) => {
  try {
    const conversaciones = await mensajeService.listarConversaciones();
    
    const stats = {
      total_conversaciones: conversaciones.length,
      conversaciones_activas: conversaciones.filter(c => c.estado === 'activa').length,
      mensajes_pendientes: conversaciones.reduce((sum, c) => sum + c.mensajes_no_leidos, 0),
      ultima_actualizacion: new Date()
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('❌ Error en obtenerEstadisticas:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener estadísticas'
    });
  }
};

/**
 * Pausar el bot para un usuario específico
 */
const pausarBot = async (req, res) => {
  try {
    const { phone } = req.params;

    if (!phone) {
      return res.status(400).json({
        success: false,
        error: 'Número de teléfono requerido'
      });
    }

    // Cambiar estado del bot a inactivo
    await clienteService.cambiarEstadoBot(phone, false);

    // Emitir evento en tiempo real
    if (global.io) {
      global.io.emit('bot_mode_changed', {
        telefono: phone,
        bot_activo: false
      });
    }

    res.json({
      success: true,
      message: `Bot pausado para ${phone}`,
      bot_activo: false
    });
  } catch (error) {
    console.error('❌ Error en pausarBot:', error);
    res.status(500).json({
      success: false,
      error: 'Error al pausar bot'
    });
  }
};

/**
 * Activar el bot para un usuario específico
 */
const activarBot = async (req, res) => {
  try {
    const { phone } = req.params;
    const { mensaje_despedida } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        error: 'Número de teléfono requerido'
      });
    }

    // Cambiar estado del bot a activo
    await clienteService.cambiarEstadoBot(phone, true);

    // Enviar mensaje de despedida/cierre (opcional)
    if (mensaje_despedida) {
      await whatsappService.sendMessage(phone, mensaje_despedida);
      
      // Guardar mensaje de despedida con nuevo schema
      await mensajeService.guardarMensaje({
        telefono: phone,
        tipo: 'text',
        cuerpo: mensaje_despedida,
        url_archivo: null
      });
    }

    // Emitir evento en tiempo real
    await emitToTenantRoom(phone, 'bot_mode_changed', {
      telefono: phone,
      bot_activo: true
    });

    res.json({
      success: true,
      message: `Bot activado para ${phone}`,
      bot_activo: true,
      mensaje_enviado: mensaje_despedida || null
    });
  } catch (error) {
    console.error('❌ Error en activarBot:', error);
    res.status(500).json({
      success: false,
      error: 'Error al activar bot'
    });
  }
};

const listarTickets = async (req, res) => {
  try {
    const role = String(req.user?.role || '').toLowerCase();

    if (role === 'admin') {
      const tickets = await clienteService.listarTicketsEnEspera();
      return res.json({
        success: true,
        tickets,
        total: tickets.length,
        scope: 'all_waiting'
      });
    }

    const subdelegacionId = await resolveOperatorSubdelegacionId(req.user);
    if (!subdelegacionId) {
      return res.status(403).json({
        success: false,
        error: 'Operador sin subdelegación asignada'
      });
    }

    const tickets = await clienteService.listarTicketsPorSubdelegacion(subdelegacionId);
    return res.json({
      success: true,
      tickets,
      total: tickets.length,
      scope: 'subdelegacion',
      subdelegacion_id: subdelegacionId
    });
  } catch (error) {
    console.error('❌ Error en listarTickets:', error);
    return res.status(500).json({
      success: false,
      error: 'Error al obtener tickets'
    });
  }
};

const aceptarTicketOperador = async (req, res) => {
  try {
    const { phone } = req.params;
    const operadorCtx = await clienteService.obtenerContextoOperador(req.user || {});
    const operador = req.body?.operador || operadorCtx?.username || req.user?.username || req.user?.email || 'Operador';
    const role = String(operadorCtx?.role || req.user?.role || 'operador').toLowerCase();
    const isAdmin = role === 'admin';

    if (!phone) {
      return res.status(400).json({ success: false, error: 'Número de teléfono requerido' });
    }

    if (!operadorCtx?.id) {
      return res.status(403).json({ success: false, error: 'Operador no identificado' });
    }

    if (!isAdmin && !operadorCtx?.subdelegacion_id) {
      return res.status(403).json({ success: false, error: 'Operador sin subdelegación asignada' });
    }

    const ticket = await clienteService.tomarTicketEnEspera({
      telefono: phone,
      operadorId: operadorCtx.id,
      operadorNombre: operador,
      subdelegacionId: operadorCtx.subdelegacion_id || null,
      isAdmin
    });

    if (!ticket?.id) {
      const clienteActual = await clienteService.obtenerCliente(phone);
      return res.status(409).json({
        success: false,
        error: 'El chat ya fue tomado por otro operador o no está en espera',
        telefono: phone,
        estado_conversacion: clienteActual?.estado_conversacion || null
      });
    }

    await clienteService.actualizarEstadoConversacion(phone, 'HUMANO');
    await clienteService.cambiarEstadoBot(phone, false, operador);

    await emitToTenantRoom(phone, 'operator_handoff_accepted', {
      telefono: phone,
      ticket_id: ticket?.id || null,
      operador,
      accepted_at: new Date().toISOString()
    });

    await emitToTenantRoom(phone, 'bot_mode_changed', {
      telefono: phone,
      bot_activo: false,
      estado_conversacion: 'HUMANO',
      ticket_id: ticket?.id || null
    });

    await sendTextAndSave(phone, `✅ Tu solicitud fue tomada por *${operador}*. Ya podés continuar la conversación con el operador.`);

    return res.json({
      success: true,
      message: 'Atención de operador iniciada',
      telefono: phone,
      ticket,
      operador,
      bot_activo: false,
      estado_conversacion: 'HUMANO'
    });
  } catch (error) {
    console.error('❌ Error en aceptarTicketOperador:', error);
    return res.status(500).json({ success: false, error: 'Error al aceptar ticket' });
  }
};

const finalizarTicketOperador = async (req, res) => {
  try {
    const { phone } = req.params;
    const operadorCtx = await clienteService.obtenerContextoOperador(req.user || {});
    const operador = req.body?.operador || operadorCtx?.username || req.user?.username || req.user?.email || 'Operador';
    const role = String(operadorCtx?.role || req.user?.role || 'operador').toLowerCase();
    const isAdmin = role === 'admin';

    if (!phone) {
      return res.status(400).json({ success: false, error: 'Número de teléfono requerido' });
    }

    const clienteActual = await clienteService.obtenerCliente(phone);
    const ticketAbierto = await clienteService.obtenerTicketAbiertoPorTelefono(phone);

    if (!isAdmin) {
      if (!operadorCtx?.id) {
        return res.status(403).json({ success: false, error: 'Operador no identificado' });
      }

      if (!ticketAbierto?.id) {
        return res.status(409).json({ success: false, error: 'No hay ticket abierto para finalizar' });
      }

      if (ticketAbierto.assigned_operator_id && Number(ticketAbierto.assigned_operator_id) !== Number(operadorCtx.id)) {
        return res.status(409).json({
          success: false,
          error: 'El chat está asignado a otro operador',
          assigned_operator_id: ticketAbierto.assigned_operator_id,
          assigned_operator_username: ticketAbierto.assigned_operator_username || null
        });
      }
    }

    if (clienteActual?.estado_conversacion === 'ENCUESTA_POST_OPERADOR' || clienteActual?.estado_conversacion === 'FOLLOWUP_POST_OPERADOR') {
      return res.json({
        success: true,
        message: 'La atención ya fue finalizada',
        telefono: phone,
        bot_activo: true,
        estado_conversacion: clienteActual.estado_conversacion,
        already_processed: true
      });
    }

    const ticketCerrado = await clienteService.cerrarTicketHumano(phone, 'FINALIZADO_OPERADOR');
    await clienteService.cambiarEstadoBot(phone, true, operador);
    await clienteService.actualizarEstadoConversacion(phone, 'ENCUESTA_POST_OPERADOR');

    await emitToTenantRoom(phone, 'operator_handoff_completed', {
      telefono: phone,
      ticket_id: ticketCerrado?.id || null,
      operador,
      completed_at: new Date().toISOString()
    });

    await emitToTenantRoom(phone, 'bot_mode_changed', {
      telefono: phone,
      bot_activo: true,
      estado_conversacion: 'ENCUESTA_POST_OPERADOR',
      ticket_id: ticketCerrado?.id || null
    });

    await sendTextAndSave(phone, '🙏 Gracias por comunicarte con nuestro operador. Antes de cerrar, te pedimos una breve encuesta.');
    await sendListAndSave(phone, 'Encuesta de satisfacción', '¿Cómo calificarías la atención recibida?', 'Elegir calificación', [
      {
        title: 'Calificación',
        rows: [
          { id: 'op_satisfaccion_1', title: '1 ⭐' },
          { id: 'op_satisfaccion_2', title: '2 ⭐' },
          { id: 'op_satisfaccion_3', title: '3 ⭐' },
          { id: 'op_satisfaccion_4', title: '4 ⭐' },
          { id: 'op_satisfaccion_5', title: '5 ⭐' }
        ]
      }
    ]);

    return res.json({
      success: true,
      message: 'Atención finalizada y encuesta enviada',
      telefono: phone,
      ticket: ticketCerrado,
      bot_activo: true,
      estado_conversacion: 'ENCUESTA_POST_OPERADOR'
    });
  } catch (error) {
    console.error('❌ Error en finalizarTicketOperador:', error);
    return res.status(500).json({ success: false, error: 'Error al finalizar ticket' });
  }
};

const asignarSubdelegacionOperador = async (req, res) => {
  try {
    const operatorId = Number(req.params.operatorId);
    const subdelegacionId = Number(req.params.subdelegacionId);

    if (!Number.isInteger(operatorId) || operatorId <= 0 || !Number.isInteger(subdelegacionId) || subdelegacionId <= 0) {
      return res.status(400).json({
        success: false,
        error: 'operatorId y subdelegacionId deben ser enteros positivos'
      });
    }

    const { run, get } = require('../config/db');
    const targetSubdelegacion = await get('SELECT id, nombre FROM subdelegaciones WHERE id = ? LIMIT 1', [subdelegacionId]);
    if (!targetSubdelegacion?.id) {
      return res.status(404).json({ success: false, error: 'Subdelegación no encontrada' });
    }

    const op = await get('SELECT id, username, subdelegacion_id FROM operadores WHERE id = ? LIMIT 1', [operatorId]);
    if (!op?.id) {
      return res.status(404).json({ success: false, error: 'Operador no encontrado' });
    }

    await run(
      'UPDATE operadores SET subdelegacion_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [subdelegacionId, operatorId]
    );

    return res.json({
      success: true,
      operador: {
        id: operatorId,
        username: op.username,
        subdelegacion_id: subdelegacionId,
        subdelegacion_nombre: targetSubdelegacion.nombre
      }
    });
  } catch (error) {
    console.error('❌ Error en asignarSubdelegacionOperador:', error);
    return res.status(500).json({ success: false, error: 'Error al asignar subdelegación al operador' });
  }
};

module.exports = {
  listarChats,
  obtenerMensajes,
  enviarMensaje,
  marcarLeido,
  obtenerEstadisticas,
  pausarBot,
  activarBot,
  descargarMedia,
  subirArchivo,
  listarTickets,
  aceptarTicketOperador,
  finalizarTicketOperador,
  asignarSubdelegacionOperador
};
