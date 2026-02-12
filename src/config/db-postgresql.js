require('dotenv').config();
const { Pool } = require('pg');

// Nombre de la base de datos objetivo
const DB_NAME = process.env.DB_NAME || 'irrigacion_bot';

let pool = null;

/**
 * Inicializa la base de datos PostgreSQL y crea tablas si no existen
 */
const initializeDB = async () => {
  if (pool) return pool;

  // Crear pool de conexiones PostgreSQL
  pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: DB_NAME,
    max: 50, // Aumentado de 10 a 50 para múltiples usuarios
    idleTimeoutMillis: 60000, // 60 segundos timeout para conexiones idle
    connectionTimeoutMillis: 10000, // 10 segundos timeout para conectar
    statement_timeout: 30000, // 30 segundos timeout para queries
  });

  // Registrar eventos del pool
  pool.on('error', (err) => {
    console.error('❌ Error no previsto en pool de conexiones:', err);
  });

  pool.on('connect', () => {
    console.log('✅ Nueva conexión PostgreSQL establecida');
  });

  console.log(`✅ Pool de conexiones PostgreSQL inicializado (${DB_NAME})`);

  try {
    // Verificar conexión
    const client = await pool.connect();
    const res = await client.query('SELECT NOW()');
    console.log(`✅ Conexión a PostgreSQL verificada: ${res.rows[0].now}`);
    client.release();

    // Crear tablas necesarias
    await createTables();

    return pool;
  } catch (error) {
    console.error('❌ Error inicializando base de datos:', error);
    throw error;
  }
};

/**
 * Crea las tablas necesarias si no existen
 */
async function createTables() {
  try {
    await pool.query(`
      -- Tabla de clientes (usuarios de WhatsApp)
      CREATE TABLE IF NOT EXISTS clientes (
        telefono VARCHAR(20) PRIMARY KEY,
        nombre_whatsapp VARCHAR(255) DEFAULT 'Sin Nombre',
        nombre_asignado VARCHAR(255),
        foto_perfil VARCHAR(500),
        padron VARCHAR(50),
        estado_deuda VARCHAR(50) DEFAULT 'Desconocido',
        padron_superficial VARCHAR(50),
        padron_subterraneo VARCHAR(50),
        padron_contaminacion VARCHAR(50),
        tipo_consulta_preferido VARCHAR(50),
        ultima_consulta TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        activo BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_clientes_activo ON clientes(activo);
      CREATE INDEX IF NOT EXISTS idx_clientes_created_at ON clientes(created_at);

      -- Tabla de mensajes (historial de conversaciones)
      CREATE TABLE IF NOT EXISTS mensajes (
        id SERIAL PRIMARY KEY,
        telefono VARCHAR(20) NOT NULL REFERENCES clientes(telefono) ON DELETE CASCADE,
        tipo VARCHAR(20), -- 'usuario' o 'bot'
        contenido TEXT,
        respuesta TEXT,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (telefono) REFERENCES clientes(telefono) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_mensajes_telefono ON mensajes(telefono);
      CREATE INDEX IF NOT EXISTS idx_mensajes_tipo ON mensajes(tipo);
      CREATE INDEX IF NOT EXISTS idx_mensajes_created_at ON mensajes(created_at);

      -- Tabla de deudas (historial de consultas de deuda)
      CREATE TABLE IF NOT EXISTS deudas (
        id SERIAL PRIMARY KEY,
        telefono VARCHAR(20) NOT NULL REFERENCES clientes(telefono) ON DELETE CASCADE,
        dni_consultado VARCHAR(20),
        padron_consultado VARCHAR(50),
        tipo_padron VARCHAR(20), -- 'superficial', 'subterraneo', 'contaminacion'
        titular VARCHAR(255),
        cuit VARCHAR(15),
        hectareas DECIMAL(10, 2),
        capital DECIMAL(12, 2),
        interes DECIMAL(12, 2),
        apremio DECIMAL(12, 2),
        eventuales DECIMAL(12, 2),
        total DECIMAL(12, 2),
        pdf_path VARCHAR(500),
        estado VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (telefono) REFERENCES clientes(telefono) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_deudas_telefono ON deudas(telefono);
      CREATE INDEX IF NOT EXISTS idx_deudas_dni ON deudas(dni_consultado);
      CREATE INDEX IF NOT EXISTS idx_deudas_padron ON deudas(padron_consultado);
      CREATE INDEX IF NOT EXISTS idx_deudas_created_at ON deudas(created_at);

      -- Tabla de estadísticas
      CREATE TABLE IF NOT EXISTS estadisticas (
        id SERIAL PRIMARY KEY,
        fecha DATE DEFAULT CURRENT_DATE,
        consultas_totales INTEGER DEFAULT 0,
        usuarios_activos INTEGER DEFAULT 0,
        errores_scraping INTEGER DEFAULT 0,
        tiempo_promedio_respuesta DECIMAL(10, 2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(fecha)
      );

      CREATE INDEX IF NOT EXISTS idx_estadisticas_fecha ON estadisticas(fecha);

      -- Tabla de logs de auditoría
      CREATE TABLE IF NOT EXISTS auditoria (
        id SERIAL PRIMARY KEY,
        accion VARCHAR(100),
        tabla VARCHAR(100),
        registro_id VARCHAR(255),
        usuario VARCHAR(100),
        detalles JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_auditoria_tabla ON auditoria(tabla);
      CREATE INDEX IF NOT EXISTS idx_auditoria_created_at ON auditoria(created_at);
    `);

    console.log('✅ Tablas PostgreSQL verificadas/creadas');
  } catch (error) {
    console.error('❌ Error creando tablas:', error);
    throw error;
  }
}

/**
 * Obtiene el pool de conexiones
 */
const getPool = () => {
  if (!pool) {
    throw new Error('Pool no inicializado. Llama a initializeDB() primero.');
  }
  return pool;
};

/**
 * Ejecuta una query directamente
 */
const query = async (text, params) => {
  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
};

/**
 * Cierra el pool de conexiones
 */
const closePool = async () => {
  if (pool) {
    await pool.end();
    console.log('✅ Pool de conexiones PostgreSQL cerrado');
    pool = null;
  }
};

module.exports = {
  initializeDB,
  getPool,
  query,
  closePool,
  Pool
};
