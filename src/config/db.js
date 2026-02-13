require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Ruta del archivo SQLite
const DB_PATH = process.env.DB_FILENAME || path.join(__dirname, '../../data/irrigacion.db');

let db = null;

/**
 * Inicializa la base de datos SQLite y crea tablas si no existen
 */
const initializeDB = async () => {
  if (db) return db;

  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('❌ Error al conectar a SQLite:', err);
        reject(err);
      } else {
        console.log(`✅ Base de datos SQLite "${DB_PATH}" inicializada`);
        
        // Habilitar foreign keys
        db.run('PRAGMA foreign_keys = ON', async (err) => {
          if (err) {
            console.error('Error al habilitar foreign keys:', err);
            reject(err);
          } else {
            try {
              await createTables();
              resolve(db);
            } catch (error) {
              reject(error);
            }
          }
        });
      }
    });
  });
};

/**
 * Crea las tablas necesarias
 */
const createTables = async () => {
  const queries = [
    // Tabla clientes
    `CREATE TABLE IF NOT EXISTS clientes (
      telefono TEXT PRIMARY KEY,
      nombre_whatsapp TEXT DEFAULT 'Sin Nombre',
      nombre_asignado TEXT,
      foto_perfil TEXT,
      padron TEXT,
      padron_superficial TEXT,
      padron_subterraneo TEXT,
      padron_contaminacion TEXT,
      tipo_consulta_preferido TEXT,
      estado_deuda TEXT,
      bot_activo INTEGER DEFAULT 1,
      ultima_interaccion DATETIME DEFAULT CURRENT_TIMESTAMP,
      fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    // Crear índice para clientes
    `CREATE INDEX IF NOT EXISTS idx_ultima_interaccion ON clientes(ultima_interaccion)`,

    // Tabla usuarios (legacy)
    `CREATE TABLE IF NOT EXISTS usuarios (
      telefono TEXT PRIMARY KEY,
      dni TEXT,
      bot_mode TEXT DEFAULT 'active',
      last_update DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    // Tabla mensajes
    `CREATE TABLE IF NOT EXISTS mensajes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id TEXT UNIQUE,
      cliente_telefono TEXT NOT NULL,
      tipo TEXT NOT NULL,
      cuerpo TEXT NOT NULL,
      url_archivo TEXT,
      emisor TEXT DEFAULT 'usuario',
      fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (cliente_telefono) REFERENCES clientes(telefono) ON DELETE CASCADE
    )`,

    // Índices para mensajes
    `CREATE INDEX IF NOT EXISTS idx_cliente_fecha ON mensajes(cliente_telefono, fecha)`,
    `CREATE INDEX IF NOT EXISTS idx_message_id ON mensajes(message_id)`,

    // Tabla notas_internas
    `CREATE TABLE IF NOT EXISTS notas_internas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente_telefono TEXT NOT NULL,
      texto TEXT NOT NULL,
      autor TEXT,
      fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (cliente_telefono) REFERENCES clientes(telefono) ON DELETE CASCADE
    )`,

    // Índice para notas
    `CREATE INDEX IF NOT EXISTS idx_cliente_fecha_notas ON notas_internas(cliente_telefono, fecha)`,

    // Tabla operadores
    `CREATE TABLE IF NOT EXISTS operadores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'operador',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    // Índices para operadores
    `CREATE INDEX IF NOT EXISTS idx_username ON operadores(username)`,
    `CREATE INDEX IF NOT EXISTS idx_email ON operadores(email)`,

    // Tabla audit_log
    `CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario TEXT NOT NULL,
      accion TEXT NOT NULL,
      tabla TEXT NOT NULL,
      id_registro TEXT NOT NULL,
      valores_anteriores TEXT,
      valores_nuevos TEXT,
      ip_address TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    // Índices para audit_log
    `CREATE INDEX IF NOT EXISTS idx_usuario_timestamp ON audit_log(usuario, timestamp)`,
    `CREATE INDEX IF NOT EXISTS idx_tabla_id ON audit_log(tabla, id_registro)`,
    `CREATE INDEX IF NOT EXISTS idx_accion ON audit_log(accion)`,
    `CREATE INDEX IF NOT EXISTS idx_timestamp ON audit_log(timestamp)`
  ];

  for (const query of queries) {
    await new Promise((resolve, reject) => {
      db.run(query, (err) => {
        if (err && !err.message.includes('already exists')) {
          console.error('❌ Error en query:', query);
          console.error(err);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  console.log('✅ Tablas clientes, mensajes, notas_internas, operadores y audit_log listas');
};

/**
 * Ejecuta una query de lectura (SELECT)
 */
const query = async (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

/**
 * Ejecuta una query de escritura (INSERT, UPDATE, DELETE)
 */
const run = async (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

/**
 * Obtiene una única fila
 */
const get = async (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const getDB = () => {
  if (!db) throw new Error('Base de datos no inicializada. Llama a initializeDB() primero.');
  return db;
};

const getPool = () => {
  // Compatibilidad con código existente que usa getPool()
  return {
    query: (sql) => query(sql),
    execute: (sql, params) => run(sql, params)
  };
};

// Exportar
module.exports = {
  initializeDB,
  query,
  run,
  get,
  getDB,
  getPool
};
