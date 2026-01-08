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
      foto_perfil VARCHAR(500),
      padron VARCHAR(50),
      estado_deuda VARCHAR(50),
      bot_activo BOOLEAN DEFAULT TRUE,
      ultima_interaccion DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Agregar columna foto_perfil si no existe (migración)
  await pool.query(`
    ALTER TABLE clientes 
    ADD COLUMN IF NOT EXISTS foto_perfil VARCHAR(500) AFTER nombre_asignado;
  `).catch(() => {});

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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS operadores (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(100) NOT NULL UNIQUE,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role ENUM('admin', 'operador') DEFAULT 'operador',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_username (username),
      INDEX idx_email (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id INT AUTO_INCREMENT PRIMARY KEY,
      usuario VARCHAR(255) NOT NULL,
      accion VARCHAR(50) NOT NULL,
      tabla VARCHAR(50) NOT NULL,
      id_registro VARCHAR(255) NOT NULL,
      valores_anteriores JSON,
      valores_nuevos JSON,
      ip_address VARCHAR(45),
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_usuario_timestamp (usuario, timestamp),
      INDEX idx_tabla_id (tabla, id_registro),
      INDEX idx_accion (accion),
      INDEX idx_timestamp (timestamp)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log('✅ Tablas clientes, mensajes, notas_internas, operadores y audit_log listas');

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
