const crypto = require('crypto');

function getSignatureHeader(req) {
  const headers = req.headers || {};
  return headers['x-hub-signature-256'] || headers['x-hub-signature'] || null;
}

/**
 * Verifica la firma X-Hub-Signature-256 de Meta/WhatsApp
 * @param {string} payload - Body raw del request (string)
 * @param {string} signature - Header X-Hub-Signature-256
 * @param {string} secret - APP_SECRET de Meta
 * @returns {boolean}
 */
function verifyWebhookSignature(payload, signature, secret) {
  if (!payload || !signature || !secret) {
    return false;
  }

  // La firma viene como "sha256=HASH"
  const [algorithm, hash] = signature.split('=');
  
  if (algorithm !== 'sha256' || !hash) {
    return false;
  }

  // Calcular HMAC del payload
  const expectedHash = crypto
    .createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('hex');

  // Comparación segura contra timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(hash, 'hex'),
      Buffer.from(expectedHash, 'hex')
    );
  } catch (error) {
    // timingSafeEqual falla si los buffers tienen diferente longitud
    return false;
  }
}

/**
 * Middleware para verificar firma de webhook de Meta
 */
function verifyMetaWebhook(req, res, next) {
  // Solo verificar POST (no GET de verificación inicial)
  if (req.method !== 'POST') {
    return next();
  }

  const signature = getSignatureHeader(req);
  const secret = process.env.WEBHOOK_APP_SECRET || process.env.WHATSAPP_APP_SECRET || process.env.META_APP_SECRET;

  if (!secret) {
    console.error('❌ Webhook secret no configurado');
    return res.status(503).json({
      success: false,
      error: 'Webhook signature verification is not configured'
    });
  }

  if (!signature) {
    return res.status(403).json({
      success: false,
      error: 'Missing signature header'
    });
  }

  // Evitamos usar req.body serializado para no romper la firma por cambios de formato.
  if (typeof req.rawBody !== 'string' || !req.rawBody.length) {
    console.error('❌ rawBody no disponible para verificar firma webhook');
    return res.status(400).json({
      success: false,
      error: 'Missing raw body for signature verification'
    });
  }

  const rawBody = req.rawBody;

  const isValid = verifyWebhookSignature(rawBody, signature, secret);

  if (!isValid) {
    console.error('❌ Firma de webhook inválida');
    return res.status(403).json({
      success: false,
      error: 'Invalid signature'
    });
  }

  console.log('✅ Firma de webhook verificada');
  next();
}

module.exports = {
  verifyWebhookSignature,
  verifyMetaWebhook,
  getSignatureHeader
};
