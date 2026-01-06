require('dotenv').config();
const mysql = require('mysql2/promise');

// Nombre de la base de datos objetivo
const DB_NAME = process.env.DB_NAME || 'irrigacion_bot';

let pool = null;

/**
 * Inicializa la base de datos y crea tablas si no existen
 */
const initializeDB = async () => {
  if (pool) return pool;

  // Conexión sin base seleccionada para poder crearla
  const tempConnection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || ''
  });

  // Crear base de datos si no existe
  await tempConnection.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\``);
  console.log(`✅ Base de datos "${DB_NAME}" verificada/creada`);

  // Crear pool apuntando a la base ya existente
  pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  // Crear tablas necesarias
  await pool.query(`
    CREATE TABLE IF NOT EXISTS clientes (
      telefono VARCHAR(20) PRIMARY KEY,
      nombre_whatsapp VARCHAR(255) DEFAULT 'Sin Nombre',
      nombre_asignado VARCHAR(255),
      padron VARCHAR(50),
      estado_deuda VARCHAR(50),
      bot_activo BOOLEAN DEFAULT TRUE,
      ultima_interaccion DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Tabla legacy para compatibilidad con flujos existentes
  await pool.query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      telefono VARCHAR(20) PRIMARY KEY,
      dni VARCHAR(20),
      bot_mode ENUM('active','paused') DEFAULT 'active',
      last_update DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS mensajes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      cliente_telefono VARCHAR(20) NOT NULL,
      tipo VARCHAR(30) NOT NULL,
      cuerpo TEXT NOT NULL,
      url_archivo VARCHAR(500),
      emisor ENUM('bot', 'usuario', 'operador') DEFAULT 'usuario',
      fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_cliente_fecha (cliente_telefono, fecha),
      CONSTRAINT fk_mensajes_cliente FOREIGN KEY (cliente_telefono) REFERENCES clientes(telefono) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS notas_internas (
      id INT AUTO_INCREMENT PRIMARY KEY,
      cliente_telefono VARCHAR(20) NOT NULL,
      texto TEXT NOT NULL,
      autor VARCHAR(100),
      fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_cliente_fecha_notas (cliente_telefono, fecha),
      CONSTRAINT fk_notas_cliente FOREIGN KEY (cliente_telefono) REFERENCES clientes(telefono) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log('✅ Tablas clientes, mensajes y notas_internas listas');

  await tempConnection.end();
  return pool;
};

const getPool = () => {
  if (!pool) throw new Error('Pool no inicializado. Llama a initializeDB() primero.');
  return pool;
};

// Exportar manteniendo compatibilidad: pool (luego de init) y helpers
module.exports = {
  initializeDB,
  getPool
};
