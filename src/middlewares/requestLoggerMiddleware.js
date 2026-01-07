const logger = require('../services/logService');

/**
 * Middleware para loguear todos los requests HTTP
 * Registra: método, ruta, usuario, status, latencia, IP
 */
const requestLogger = (req, res, next) => {
  const startTime = Date.now();

  // Interceptar el método send de response para loguear cuando termina
  const originalSend = res.send;
  res.send = function (data) {
    const latency = Date.now() - startTime;

    // Solo loguear requests a API (no assets estáticos)
    if (req.path.startsWith('/api') || req.path.startsWith('/webhook')) {
      logger.http(req, res, latency);

      // Loguear si es lento (> 100ms)
      if (latency > 100) {
        logger.warn(`Request lento detectado`, {
          method: req.method,
          path: req.path,
          latency: `${latency}ms`,
          user: req.user?.email || 'anonymous'
        });
      }

      // Loguear errores (status >= 400)
      if (res.statusCode >= 400) {
        logger.warn(`Request error`, {
          method: req.method,
          path: req.path,
          status: res.statusCode,
          user: req.user?.email || 'anonymous'
        });
      }
    }

    return originalSend.call(this, data);
  };

  next();
};

module.exports = requestLogger;
