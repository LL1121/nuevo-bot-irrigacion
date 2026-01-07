const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'tu_clave_secreta_muy_segura_change_in_production';

/**
 * Middleware para verificar JWT en los headers
 * Espera: Authorization: Bearer <token>
 */
const verifyToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Token no proporcionado o formato inválido'
      });
    }

    const token = authHeader.slice(7); // Quitar "Bearer "
    const decoded = jwt.verify(token, JWT_SECRET);

    // Adjuntar datos del operador al request
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expirado'
      });
    }

    console.error('❌ Error en verifyToken:', error);
    return res.status(401).json({
      success: false,
      message: 'Token inválido'
    });
  }
};

module.exports = {
  verifyToken
};
