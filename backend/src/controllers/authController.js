const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { getPool } = require('../config/db');
const clienteService = require('../services/clienteService');

const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_EXPIRY = process.env.JWT_EXPIRY || '8h';

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET no configurado');
}

/**
 * Login: valida username/password y retorna JWT
 */
const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Usuario y contraseña son requeridos'
      });
    }

    const pool = getPool();
    const rows = await pool.query(
      `SELECT
        o.id,
        o.username,
        o.email,
        o.password_hash,
        o.role,
        o.subdelegacion_id,
        s.nombre AS subdelegacion_nombre,
        s.codigo AS subdelegacion_codigo
      FROM operadores o
      LEFT JOIN subdelegaciones s ON s.id = o.subdelegacion_id
      WHERE o.username = ?`,
      [username]
    );

    if (!rows || rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Usuario o contraseña incorrectos'
      });
    }

    const operador = rows[0];
    const passwordMatch = await bcrypt.compare(password, operador.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Usuario o contraseña incorrectos'
      });
    }

    // Generar JWT
    const token = jwt.sign(
      {
        id: operador.id,
        username: operador.username,
        email: operador.email,
        role: operador.role,
        subdelegacion_id: operador.subdelegacion_id || null
      },
      JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY }
    );

    return res.status(200).json({
      success: true,
      token,
      user: {
        id: operador.id,
        username: operador.username,
        email: operador.email,
        role: operador.role,
        subdelegacion_id: operador.subdelegacion_id || null,
        subdelegacion_nombre: operador.subdelegacion_nombre || null,
        subdelegacion_codigo: operador.subdelegacion_codigo || null
      }
    });
  } catch (error) {
    console.error('❌ Error en login:', error);
    return res.status(500).json({
      success: false,
      message: 'Error en el servidor'
    });
  }
};

const me = async (req, res) => {
  try {
    const operador = await clienteService.obtenerContextoOperador(req.user || {});
    if (!operador?.id) {
      return res.status(404).json({
        success: false,
        message: 'Operador no encontrado'
      });
    }

    const role = String(operador.role || 'operador').toLowerCase();
    const userData = {
      id: operador.id,
      username: operador.username,
      email: operador.email,
      role,
      subdelegacion_id: operador.subdelegacion_id || null,
      subdelegacion_nombre: operador.subdelegacion_nombre || null,
      subdelegacion_codigo: operador.subdelegacion_codigo || null,
      permissions: {
        canViewAllQueues: role === 'admin',
        canAssignSubdelegacion: role === 'admin',
        queueScope: role === 'admin' ? 'all' : 'subdelegacion'
      }
    };

    return res.status(200).json({
      success: true,
      // Campos en la raíz para que el frontend pueda hacer spread directo
      ...userData,
      // También en user{} para compatibilidad con código existente
      user: userData,
      data: userData
    });
  } catch (error) {
    console.error('❌ Error en auth.me:', error);
    return res.status(500).json({
      success: false,
      message: 'Error en el servidor'
    });
  }
};

module.exports = {
  login,
  me
};
