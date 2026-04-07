const logger = require('../services/logService');

/**
 * Middleware para loguear todos los requests HTTP
 * Registra: método, ruta, usuario, status, latencia, IP
 * OPTIMIZADO: Solo log críticos y errores (reduce I/O)
 */
const requestLogger = (req, res, next) => {
  const startTime = Date.now();

  // Interceptar el método send de response para loguear cuando termina
  const originalSend = res.send;
  res.send = function (data) {
    const latency = Date.now() - startTime;

    // Solo loguear requests a API (no assets estáticos)
    if (req.path.startsWith('/api') || req.path.startsWith('/webhook')) {
      // OPTIMIZACIÓN: Solo log si es lento o error (reduce escrituras)
      if (latency > 200 || res.statusCode >= 400) {
        logger.warn(`Request ${res.statusCode >= 400 ? 'error' : 'lento'}`, {
          method: req.method,
          path: req.path,
          status: res.statusCode,
          latency: `${latency}ms`,
          user: req.user?.username || req.user?.email || 'anonymous'
        });
      }
    }

    return originalSend.call(this, data);
  };

  next();
};

module.exports = requestLogger;
