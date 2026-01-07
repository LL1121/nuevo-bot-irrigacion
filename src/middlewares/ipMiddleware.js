/**
 * Middleware para capturar IP del cliente en requests
 * Útil para auditoría: obtener IP real incluso detrás de proxies
 */
const getClientIp = (req) => {
  return (
    req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.headers['x-real-ip'] ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    'UNKNOWN'
  );
};

/**
 * Middleware que agrega la IP del cliente al objeto req para usar en auditoría
 */
const ipMiddleware = (req, res, next) => {
  req.clientIp = getClientIp(req);
  next();
};

module.exports = {
  getClientIp,
  ipMiddleware
};
