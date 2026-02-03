const rateLimit = require('express-rate-limit');

/**
 * Rate limiter general para API (por IP)
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per window
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Rate limiter para login (por IP)
 */
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // limit each IP to 5 login requests per window
  message: 'Too many login attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Rate limiter por operador para envío de mensajes
 * Usa el ID del operador del JWT como clave (fallback a IP)
 */
const operatorRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 10, // máximo 10 mensajes por minuto por operador
  keyGenerator: (req) => {
    // Usar ID del operador del JWT si está disponible
    return req.user?.id ? `operator_${req.user.id}` : req.ip;
  },
  message: 'Demasiados mensajes enviados. Por favor espera un momento.',
  standardHeaders: true,
  legacyHeaders: false,
  // Handler personalizado para debugging
  handler: (req, res) => {
    console.log(`⛔ Rate limit excedido para operador ${req.user?.id || req.ip}`);
    res.status(429).json({
      success: false,
      error: 'Demasiados mensajes enviados. Por favor espera un momento.'
    });
  }
});

module.exports = {
  apiLimiter,
  authLimiter,
  operatorRateLimiter
};
