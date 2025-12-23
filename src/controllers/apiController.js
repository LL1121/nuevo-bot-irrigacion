const mensajeService = require('../services/mensajeService');
const whatsappService = require('../services/whatsappService');

/**
 * Lista todas las conversaciones activas
 */
const listarChats = async (req, res) => {
  try {
    const conversaciones = await mensajeService.listarConversaciones();
    res.json({
      success: true,
      data: conversaciones,
      total: conversaciones.length
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
 * Obtiene el historial de mensajes de un teléfono
 */
const obtenerMensajes = async (req, res) => {
  try {
    const { telefono } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit) : 100;

    const mensajes = await mensajeService.obtenerMensajes(telefono, limit);
    
    res.json({
      success: true,
      data: mensajes,
      telefono,
      total: mensajes.length
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

    // Guardar en base de datos
    const mensajeGuardado = await mensajeService.guardarMensaje({
      telefono,
      remitente: 'operador',
      contenido: mensaje,
      tipo_mensaje: 'text'
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
      data: mensajeGuardado,
      message: 'Mensaje enviado correctamente'
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

module.exports = {
  listarChats,
  obtenerMensajes,
  enviarMensaje,
  marcarLeido,
  obtenerEstadisticas
};
