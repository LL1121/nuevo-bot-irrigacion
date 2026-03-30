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
    const subdelegacionId = req.user?.subdelegacion_id;
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
      total: tickets.length
    });
  } catch (error) {
    console.error('❌ Error en listarTickets:', error);
    return res.status(500).json({
      success: false,
      error: 'Error al obtener tickets'
    });
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
  asignarSubdelegacionOperador
};
