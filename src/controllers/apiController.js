const mensajeService = require('../services/mensajeService');
const whatsappService = require('../services/whatsappService');
const userService = require('../services/userService');
const clienteService = require('../services/clienteService');
const { getMediaInfo, fetchMediaStream } = require('../services/whatsappService');
const fs = require('fs');

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
      url_archivo: null
    });

    // Emitir evento en tiempo real
    if (global.io) {
      global.io.emit('nuevo_mensaje', {
        telefono,
        mensaje: mensajeGuardado,
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
    if (global.io) {
      global.io.emit('bot_mode_changed', {
        telefono: phone,
        bot_activo: true
      });
    }

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

module.exports = {
  listarChats,
  obtenerMensajes,
  enviarMensaje,
  marcarLeido,
  obtenerEstadisticas,
  pausarBot,
  activarBot,
  descargarMedia
};
