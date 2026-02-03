const crypto = require('crypto');

/**
 * Verifica la firma X-Hub-Signature-256 de Meta/WhatsApp
 * @param {string} payload - Body raw del request (string)
 * @param {string} signature - Header X-Hub-Signature-256
 * @param {string} secret - APP_SECRET de Meta
 * @returns {boolean}
 */
function verifyWebhookSignature(payload, signature, secret) {
  if (!signature || !secret) {
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

  const signature = req.headers['x-hub-signature-256'];
  const secret = process.env.WEBHOOK_APP_SECRET || process.env.WHATSAPP_APP_SECRET;

  if (!secret) {
    console.warn('⚠️ WEBHOOK_APP_SECRET no configurado, saltando verificación de firma');
    return next();
  }

  // El body debe estar en raw (string o buffer) para verificar la firma
  const rawBody = req.rawBody || JSON.stringify(req.body);

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
  verifyMetaWebhook
};
