require('dotenv').config();
const mysql = require('mysql2/promise');

/**
 * Pool de conexiones a MySQL
 * Permite reutilizar conexiones y mejorar el rendimiento
 */
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'irrigacion',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Test de conexión
pool.getConnection()
  .then(connection => {
    console.log('✅ Conexión a MySQL establecida correctamente');
    connection.release();
  })
  .catch(err => {
    console.error('❌ Error conectando a MySQL:', err.message);
  });

module.exports = pool;
