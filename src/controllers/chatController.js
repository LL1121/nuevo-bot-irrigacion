const whatsappService = require('../services/whatsappService');
const mensajeService = require('../services/mensajeService');

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
    return res.status(500).json({ success: false, error: 'No se pudo reactivar la conversación' });
  }
};

module.exports = { reactivate };
