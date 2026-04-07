const whatsappService = require('../services/whatsappService');
const mensajeService = require('../services/mensajeService');
const { getPool } = require('../config/db');

/**
 * Obtiene el estado de la ventana de 24h para un chat
 * GET /api/chats/:phone/window-status
 */
const getWindowStatus = async (req, res) => {
  try {
    const { phone } = req.params;
    const pool = getPool();

    // Buscar el último mensaje del usuario (emisor='usuario')
    const [rows] = await pool.execute(
      `SELECT fecha 
       FROM mensajes 
       WHERE cliente_telefono = ? AND emisor = 'usuario' 
       ORDER BY fecha DESC 
       LIMIT 1`,
      [phone]
    );

    if (rows.length === 0) {
      return res.json({
        success: true,
        phone,
        hasMessages: false,
        inWindow: false,
        message: 'No hay mensajes del usuario'
      });
    }

    const lastUserMessageDate = new Date(rows[0].fecha);
    const now = new Date();
    const diffMs = now.getTime() - lastUserMessageDate.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    const windowLimit = 24;
    const inWindow = diffHours < windowLimit;
    const hoursRemaining = inWindow ? Math.max(0, windowLimit - diffHours) : 0;

    return res.json({
      success: true,
      phone,
      hasMessages: true,
      inWindow,
      lastUserMessageDate: lastUserMessageDate.toISOString(),
      hoursElapsed: Math.round(diffHours * 100) / 100,
      hoursRemaining: Math.round(hoursRemaining * 100) / 100,
      windowLimitHours: windowLimit,
      message: inWindow 
        ? `Dentro de ventana. ${Math.round(hoursRemaining)} horas restantes.`
        : `Fuera de ventana. Hace ${Math.round(diffHours)} horas del último mensaje.`
    });
  } catch (error) {
    console.error('❌ Error obteniendo estado de ventana:', error);
    return res.status(500).json({
      success: false,
      error: 'Error al obtener estado de ventana'
    });
  }
};

/**
 * Reactiva una conversación vencida (>24hs) enviando una plantilla
 * POST /api/chats/:phone/reactivate
 * Body opcional: { templateName, languageCode, components }
 */
const reactivate = async (req, res) => {
  try {
    const { phone } = req.params;
    const {
      templateName = 'hello_world',
      languageCode = templateName === 'hello_world' ? 'en_US' : 'es',
      components
    } = req.body || {};

    // Enviar plantilla por WhatsApp
    const sendResult = await whatsappService.sendTemplate(
      phone,
      templateName,
      languageCode,
      components
    );

    // Guardar en DB el envío como mensaje de tipo 'template' emitido por el 'bot'
    await mensajeService.guardarMensaje({
      telefono: phone,
      tipo: 'template',
      cuerpo: `Template: ${templateName} (${languageCode})`,
      url_archivo: null,
      emisor: 'bot'
    });

    return res.status(201).json({
      success: true,
      message: 'Template enviado para reactivar conversación',
      result: sendResult
    });
  } catch (error) {
    console.error('❌ Error reactivando conversación:', error.response?.data || error.message);
    console.error('Stack:', error.stack);
    return res.status(500).json({ 
      success: false, 
      error: 'No se pudo reactivar la conversación',
      details: error.response?.data || error.message
    });
  }
};

module.exports = { reactivate, getWindowStatus };
