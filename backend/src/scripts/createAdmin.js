const bcrypt = require('bcrypt');
const { initializeDB, getPool } = require('../config/db');

const createAdmin = async () => {
  try {
    await initializeDB();
    const pool = getPool();

    const username = process.env.ADMIN_USERNAME;
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;
    const role = process.env.ADMIN_ROLE || 'admin';

    if (!username || !email || !password) {
      throw new Error('Faltan variables ADMIN_USERNAME, ADMIN_EMAIL o ADMIN_PASSWORD');
    }

    // Hash de la contraseña
    const passwordHash = await bcrypt.hash(password, 10);

    // Verificar si el admin ya existe
    const existing = await pool.query(
      'SELECT id FROM operadores WHERE email = ? OR username = ?',
      [email, username]
    );

    if (existing.length > 0) {
      console.log('✅ Admin ya existe:', email);
      process.exit(0);
    }

    // Insertar admin
    await pool.query(
      'INSERT INTO operadores (username, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [username, email, passwordHash, role]
    );

    console.log('✅ Admin creado exitosamente');
    console.log('Username:', username);
    console.log('Email:', email);
    console.log('Role:', role);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error al crear admin:', error);
    process.exit(1);
  }
};

createAdmin();
