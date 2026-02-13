require('dotenv').config();
const axios = require('axios');
const axiosRetry = require('axios-retry').default;
const { isNetworkOrIdempotentRequestError } = require('axios-retry');
const { validateFileIntegrity } = require('./fileValidator');
const { withWhatsAppRetry } = require('./retryService');

const WHATSAPP_API_URL = 'https://graph.facebook.com/v21.0';

// Create axios instance with timeout and retry logic
const axiosClient = axios.create({
  timeout: 15000, // 15 seconds - prevent hanging requests
  maxContentLength: 50 * 1024 * 1024, // 50MB max file size
  maxBodyLength: 50 * 1024 * 1024
});

// Auto-retry on network errors or 5xx responses (3 retries with exponential backoff)
axiosRetry(axiosClient, {
  retries: 3,
  retryDelay: (retryCount) => retryCount * 1000, // 1s, 2s, 3s
  retryCondition: (error) => {
    // Retry on network errors or server errors (5xx), but not client errors (4xx)
    return isNetworkOrIdempotentRequestError(error) ||
           (error.response?.status >= 500);
  }
});

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

  return withWhatsAppRetry(async () => {
    const url = `${WHATSAPP_API_URL}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
    
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
        'Authorization': `Bearer ${process.env.META_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    };

    const response = await axiosClient.post(url, data, config);
    console.log('✅ Mensaje enviado correctamente:', response.data);
    return response.data;
  }, `sendMessage to ${to}`);
};

/**
 * Envía una Plantilla (Template) para reactivar conversaciones >24hs
 * @param {string} to - Número de teléfono del destinatario
 * @param {string} templateName - Nombre de la plantilla (ej: 'hello_world')
 * @param {string} languageCode - Código de idioma (ej: 'en_US', 'es', 'es_AR')
 * @param {Array} components - Componentes opcionales (header/body/button) según template
 */
const sendTemplate = async (to, templateName, languageCode = 'en_US', components = undefined) => {
  // Parche para Argentina en Sandbox (quita el 9 después del 54)
  if (to.includes('549')) {
    to = to.replace('549', '54');
  }

  return withWhatsAppRetry(async () => {
    const url = `${WHATSAPP_API_URL}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

    const templatePayload = {
      name: templateName,
      language: { code: languageCode }
    };
    if (components && Array.isArray(components) && components.length > 0) {
      templatePayload.components = components;
    }

    const data = {
      messaging_product: 'whatsapp',
      to: to,
      type: 'template',
      template: templatePayload
    };

    const config = {
      headers: {
        'Authorization': `Bearer ${process.env.META_ACCESS_TOKEN}`,
        'Content-Type': 'application/json; charset=utf-8'
      }
    };

    const response = await axiosClient.post(url, data, config);
    console.log('✅ Template enviado correctamente:', response.data);
    return response.data;
  }, `sendTemplate ${templateName} to ${to}`);
};

/**
 * Obtiene metadata de un media (url temporal, mime, etc.)
 * @param {string} mediaId
 */
const getMediaInfo = async (mediaId) => {
  const url = `${WHATSAPP_API_URL}/${mediaId}`;
  const config = {
    headers: {
      'Authorization': `Bearer ${process.env.META_ACCESS_TOKEN}`
    }
  };
  try {
    const response = await axiosClient.get(url, config);
    return response.data; // { url, mime_type, ... }
  } catch (error) {
    console.error('❌ Error obteniendo media info:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Descarga media de WhatsApp y lo guarda localmente en public/uploads
 * @param {string} mediaId - ID del media en WhatsApp
 * @returns {Promise<string>} - URL local relativa (ej: /uploads/123.jpg)
 */
const downloadMedia = async (mediaId) => {
  const fs = require('fs');
  const path = require('path');
  const mime = require('mime-types');

  try {
    const info = await getMediaInfo(mediaId);
    if (!info?.url) {
      throw new Error('No se encontró URL para el media');
    }

    // Obtener stream y content-type
    const { stream, contentType } = await fetchMediaStream(info.url);
    const uploadsDir = path.join(__dirname, '../../public/uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const ext = mime.extension(contentType || info.mime_type || '') || 'bin';
    const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext}`;
    const filePath = path.join(uploadsDir, filename);

    const writeStream = fs.createWriteStream(filePath);
    await new Promise((resolve, reject) => {
      stream.pipe(writeStream);
      stream.on('error', reject);
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    // Validar integridad (magic numbers)
    await validateFileIntegrity(filePath);

    // Retornar URL relativa
    return `/uploads/${filename}`;
  } catch (error) {
    console.error('❌ Error descargando media:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Descarga un media desde una URL firmada como stream
 * @param {string} mediaUrl
 * @returns {Promise<{stream: any, contentType: string}>}
 */
const fetchMediaStream = async (mediaUrl) => {
  const config = {
    responseType: 'stream',
    headers: {
      'Authorization': `Bearer ${process.env.META_ACCESS_TOKEN}`
    }
  };
  try {
    const response = await axiosClient.get(mediaUrl, config);
    return { stream: response.data, contentType: response.headers['content-type'] || 'application/octet-stream' };
  } catch (error) {
    console.error('❌ Error descargando media:', error.response?.data || error.message);
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
    const url = `${WHATSAPP_API_URL}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
    
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
        'Authorization': `Bearer ${process.env.META_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    };

    const response = await axiosClient.post(url, data, config);
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
    const url = `${WHATSAPP_API_URL}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
    
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
        'Authorization': `Bearer ${process.env.META_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    };

    const response = await axiosClient.post(url, data, config);
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
    const url = `${WHATSAPP_API_URL}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
    
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
        'Authorization': `Bearer ${process.env.META_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    };

    const response = await axiosClient.post(url, data, config);
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
    const url = `${WHATSAPP_API_URL}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
    
    const data = {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId
    };

    const config = {
      headers: {
        'Authorization': `Bearer ${process.env.META_ACCESS_TOKEN}`,
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

/**
 * Subir un archivo local a WhatsApp Media API
 * @param {string} filePath - Ruta local del archivo
 * @param {string} mimeType - Tipo MIME (ej: 'application/pdf')
 * @returns {Promise<string>} - Media ID
 */
const uploadMedia = async (filePath, mimeType) => {
  const fs = require('fs');
  const FormData = require('form-data');
  
  try {
    const url = `${WHATSAPP_API_URL}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/media`;
    
    const formData = new FormData();
    formData.append('messaging_product', 'whatsapp');
    formData.append('file', fs.createReadStream(filePath), {
      contentType: mimeType
    });
    
    const config = {
      headers: {
        'Authorization': `Bearer ${process.env.META_ACCESS_TOKEN}`,
        ...formData.getHeaders()
      }
    };
    
    const response = await axiosClient.post(url, formData, config);
    console.log('📤 Media subido, ID:', response.data.id);
    return response.data.id;
    
  } catch (error) {
    console.error('❌ Error subiendo media:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Enviar documento PDF
 * @param {string} to - Número del destinatario
 * @param {string} mediaId - ID del media subido
 * @param {string} fileName - Nombre del archivo
 * @param {string} caption - Texto opcional
 */
const sendDocument = async (to, mediaId, fileName, caption = '') => {
  // Parche Argentina
  if (to.includes('549')) {
    to = to.replace('549', '54');
  }
  
  try {
    const url = `${WHATSAPP_API_URL}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
    
    const data = {
      messaging_product: 'whatsapp',
      to: to,
      type: 'document',
      document: {
        id: mediaId,
        filename: fileName,
        caption: caption
      }
    };
    
    const config = {
      headers: {
        'Authorization': `Bearer ${process.env.META_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    };
    
    await axiosClient.post(url, data, config);
    console.log(`📄 Documento enviado a ${to}`);
    
  } catch (error) {
    console.error('❌ Error enviando documento:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Enviar botones de respuesta rápida (máximo 3)
 * @param {string} to - Número del destinatario
 * @param {string} text - Texto del mensaje
 * @param {Array} buttons - Array de botones [{id, title}, ...]
 */
const sendButtonReply = async (to, text, buttons) => {
  // Parche Argentina
  if (to.includes('549')) {
    to = to.replace('549', '54');
  }
  
  // Validar máximo 3 botones
  if (buttons.length > 3) {
    throw new Error('Máximo 3 botones permitidos');
  }
  
  try {
    const url = `${WHATSAPP_API_URL}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
    
    const data = {
      messaging_product: 'whatsapp',
      to: to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: {
          text: text
        },
        action: {
          buttons: buttons.map((btn, index) => ({
            type: 'reply',
            reply: {
              id: btn.id || `btn_${index}`,
              title: btn.title.substring(0, 20) // Máximo 20 caracteres
            }
          }))
        }
      }
    };
    
    const config = {
      headers: {
        'Authorization': `Bearer ${process.env.META_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    };
    
    await axiosClient.post(url, data, config);
    console.log(`🔘 Botones enviados a ${to}`);
    
  } catch (error) {
    console.error('❌ Error enviando botones:', error.response?.data || error.message);
    throw error;
  }
};

module.exports = {
  sendMessage,
  sendTemplate,
  sendImage,
  sendInteractiveList,
  sendInteractiveButtons,
  markAsRead,
  uploadMedia,
  sendDocument,
  sendButtonReply,
  getMediaInfo,
  fetchMediaStream,
  downloadMedia
};
