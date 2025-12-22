require('dotenv').config();
const axios = require('axios');

const WHATSAPP_API_URL = 'https://graph.facebook.com/v21.0';

/**
 * Envía un mensaje de texto a través de WhatsApp Cloud API
 * @param {string} to - Número de teléfono del destinatario
 * @param {string} text - Mensaje a enviar
 */
const sendMessage = async (to, text) => {
  // Parche para Argentina en Sandbox (quita el 9 después del 54)
  if (to.includes('549')) {
    to = to.replace('549', '54');
  }

  try {
    const url = `${WHATSAPP_API_URL}/${process.env.WHATSAPP_PHONE_ID}/messages`;
    
    const data = {
      messaging_product: 'whatsapp',
      to: to,
      type: 'text',
      text: {
        body: text
      }
    };

    const config = {
      headers: {
        'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json'
      }
    };

    const response = await axios.post(url, data, config);
    console.log('✅ Mensaje enviado correctamente:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Error enviando mensaje:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Envía un mensaje interactivo tipo Lista
 * @param {string} to - Número de teléfono del destinatario
 * @param {string} headerText - Texto del encabezado
 * @param {string} bodyText - Texto del cuerpo del mensaje
 * @param {string} buttonText - Texto del botón
 * @param {Array} sections - Array de secciones con rows (id, title, description)
 * @param {string} headerImageUrl - URL de imagen para el header (opcional)
 */
const sendInteractiveList = async (to, headerText, bodyText, buttonText, sections, headerImageUrl = null) => {
  // Parche para Argentina en Sandbox (quita el 9 después del 54)
  if (to.includes('549')) {
    to = to.replace('549', '54');
  }

  try {
    const url = `${WHATSAPP_API_URL}/${process.env.WHATSAPP_PHONE_ID}/messages`;
    
    // Construir el header según si hay imagen o no
    let header;
    if (headerImageUrl) {
      header = {
        type: 'image',
        image: {
          link: headerImageUrl
        }
      };
    } else {
      header = {
        type: 'text',
        text: headerText
      };
    }
    
    const data = {
      messaging_product: 'whatsapp',
      to: to,
      type: 'interactive',
      interactive: {
        type: 'list',
        header: header,
        body: {
          text: bodyText
        },
        action: {
          button: buttonText,
          sections: sections
        }
      }
    };

    const config = {
      headers: {
        'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json'
      }
    };

    const response = await axios.post(url, data, config);
    console.log('✅ Lista interactiva enviada correctamente:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Error enviando lista interactiva:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Envía un mensaje interactivo tipo Botones (máximo 3)
 * @param {string} to - Número de teléfono del destinatario
 * @param {string} bodyText - Texto del cuerpo del mensaje
 * @param {Array} buttons - Array de botones (id, title) - máximo 3
 */
const sendInteractiveButtons = async (to, bodyText, buttons) => {
  // Parche para Argentina en Sandbox (quita el 9 después del 54)
  if (to.includes('549')) {
    to = to.replace('549', '54');
  }

  try {
    const url = `${WHATSAPP_API_URL}/${process.env.WHATSAPP_PHONE_ID}/messages`;
    
    const data = {
      messaging_product: 'whatsapp',
      to: to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: {
          text: bodyText
        },
        action: {
          buttons: buttons.map(btn => ({
            type: 'reply',
            reply: {
              id: btn.id,
              title: btn.title
            }
          }))
        }
      }
    };

    const config = {
      headers: {
        'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json'
      }
    };

    const response = await axios.post(url, data, config);
    console.log('✅ Botones interactivos enviados correctamente:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Error enviando botones interactivos:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Envía una imagen a través de WhatsApp Cloud API
 * @param {string} to - Número de teléfono del destinatario
 * @param {string} imageUrl - URL de la imagen a enviar
 * @param {string} caption - Texto descriptivo de la imagen (opcional)
 */
const sendImage = async (to, imageUrl, caption = '') => {
  // Parche para Argentina en Sandbox (quita el 9 después del 54)
  if (to.includes('549')) {
    to = to.replace('549', '54');
  }

  try {
    const url = `${WHATSAPP_API_URL}/${process.env.WHATSAPP_PHONE_ID}/messages`;
    
    const data = {
      messaging_product: 'whatsapp',
      to: to,
      type: 'image',
      image: {
        link: imageUrl,
        caption: caption
      }
    };

    const config = {
      headers: {
        'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json'
      }
    };

    const response = await axios.post(url, data, config);
    console.log('✅ Imagen enviada correctamente:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Error enviando imagen:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Marca un mensaje como leído
 * @param {string} messageId - ID del mensaje a marcar como leído
 */
const markAsRead = async (messageId) => {
  try {
    const url = `${WHATSAPP_API_URL}/${process.env.WHATSAPP_PHONE_ID}/messages`;
    
    const data = {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId
    };

    const config = {
      headers: {
        'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json'
      }
    };

    const response = await axios.post(url, data, config);
    console.log('✅ Mensaje marcado como leído');
    return response.data;
  } catch (error) {
    console.error('❌ Error marcando mensaje como leído:', error.response?.data || error.message);
    throw error;
  }
};

module.exports = {
  sendMessage,
  sendImage,
  sendInteractiveList,
  sendInteractiveButtons,
  markAsRead
};
