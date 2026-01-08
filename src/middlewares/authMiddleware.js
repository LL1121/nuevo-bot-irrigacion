const jwt = require('jsonwebtoken');
const logService = require('../services/logService');

/**
 * Middleware para verificar JWT token
 * Requiere: Authorization: Bearer <token>
 */
const verifyToken = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token no proporcionado',
        timestamp: new Date().toISOString()
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.user = decoded;

    // OPTIMIZACIÓN: Sin log en cada request (reduce I/O)
    // Solo loggear en desarrollo si es necesario
    // logService.info(`✅ Token verificado para usuario: ${decoded.username || decoded.email || 'desconocido'}`);
    next();
  } catch (error) {
    logService.error(`❌ Error verificando token: ${error.message}`);
    
    return res.status(403).json({
      success: false,
      message: 'Token inválido o expirado',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Middleware para verificar roles
 * Uso: verifyRole(['admin', 'supervisor'])(req, res, next)
 */
const verifyRole = (allowedRoles) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado'
        });
      }

      if (!allowedRoles.includes(req.user.role)) {
        logService.warn(`⚠️ Acceso denegado para ${req.user.email} a ${req.path}`);
        
        return res.status(403).json({
          success: false,
          message: 'Permisos insuficientes',
          requiredRoles: allowedRoles,
          userRole: req.user.role
        });
      }

      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Error validando rol',
        error: error.message
      });
    }
  };
};

module.exports = {
  verifyToken,
  verifyRole
};
