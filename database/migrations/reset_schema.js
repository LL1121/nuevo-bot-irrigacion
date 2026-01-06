require('dotenv').config();
const mysql = require('mysql2/promise');

async function resetSchema() {
  const dbName = process.env.DB_NAME || 'irrigacion_bot';
  let connection;
  try {
    console.log(`🔌 Conectando a MySQL (DB: ${dbName})...`);
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: dbName
    });

    console.log('✅ Conectado');
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');

    // Drop tablas en orden seguro
    await connection.query('DROP TABLE IF EXISTS mensajes');
    await connection.query('DROP TABLE IF EXISTS notas_internas');
    await connection.query('DROP TABLE IF EXISTS clientes');

    // Crear clientes
    await connection.query(`
      CREATE TABLE clientes (
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

    // Crear mensajes
    await connection.query(`
      CREATE TABLE mensajes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        cliente_telefono VARCHAR(20) NOT NULL,
        tipo VARCHAR(30) NOT NULL,
        cuerpo TEXT NOT NULL,
        url_archivo VARCHAR(500),
        fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_cliente_fecha (cliente_telefono, fecha),
        CONSTRAINT fk_mensajes_cliente FOREIGN KEY (cliente_telefono) REFERENCES clientes(telefono) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Crear notas_internas
    await connection.query(`
      CREATE TABLE notas_internas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        cliente_telefono VARCHAR(20) NOT NULL,
        texto TEXT NOT NULL,
        autor VARCHAR(100),
        fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_cliente_fecha_notas (cliente_telefono, fecha),
        CONSTRAINT fk_notas_cliente FOREIGN KEY (cliente_telefono) REFERENCES clientes(telefono) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Mantener usuarios legacy para compatibilidad
    await connection.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        telefono VARCHAR(20) PRIMARY KEY,
        dni VARCHAR(20),
        bot_mode ENUM('active','paused') DEFAULT 'active',
        last_update DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await connection.query('SET FOREIGN_KEY_CHECKS = 1');

    console.log('✅ Esquema recreado con éxito');
  } catch (err) {
    console.error('❌ Error en reset_schema:', err.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

resetSchema();
