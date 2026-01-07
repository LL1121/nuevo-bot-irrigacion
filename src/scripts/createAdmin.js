const bcrypt = require('bcrypt');
const { initializeDB, getPool } = require('../config/db');

const createAdmin = async () => {
  try {
    const pool = await initializeDB();

    const email = 'admin@irrigacion.com';
    const password = 'admin123';
    const role = 'admin';

    // Hash de la contraseña
    const passwordHash = await bcrypt.hash(password, 10);

    // Verificar si el admin ya existe
    const [existing] = await pool.query(
      'SELECT id FROM operadores WHERE email = ?',
      [email]
    );

    if (existing.length > 0) {
      console.log('✅ Admin ya existe:', email);
      process.exit(0);
    }

    // Insertar admin
    await pool.query(
      'INSERT INTO operadores (email, password_hash, role) VALUES (?, ?, ?)',
      [email, passwordHash, role]
    );

    console.log('✅ Admin creado exitosamente');
    console.log('Email:', email);
    console.log('Password:', password);
    console.log('Role:', role);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error al crear admin:', error);
    process.exit(1);
  }
};

createAdmin();
