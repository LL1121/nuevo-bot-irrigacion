const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { getPool } = require('../config/db');

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
      'SELECT id, username, email, password_hash, role FROM operadores WHERE username = ?',
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
        role: operador.role
      },
      JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY }
    );

    return res.status(200).json({
      success: true,
      token,
      user: {
        id: operador.id,
        email: operador.email,
        role: operador.role
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

module.exports = {
  login
};
