const logger = require('../services/logService');

const isProd = process.env.NODE_ENV === 'production';

/**
 * Middleware Express de errores (4 argumentos). Debe registrarse después de todas las rutas.
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  const status = Number(err.status || err.statusCode) || 500;
  const safeStatus = status >= 400 && status < 600 ? status : 500;

  logger.exception(err, {
    path: req.originalUrl,
    method: req.method,
    status: safeStatus
  });

  if (res.headersSent) {
    return;
  }

  const body = {
    success: false,
    error: safeStatus === 500 && isProd
      ? 'Error interno del servidor'
      : (err.message || 'Error')
  };

  if (!isProd && err.stack) {
    body.detail = err.stack;
  }

  res.status(safeStatus).json(body);
};

module.exports = { errorHandler };
