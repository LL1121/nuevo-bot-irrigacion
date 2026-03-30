require('dotenv').config();
const path = require('path');
const { AsyncLocalStorage } = require('async_hooks');

const DB_CLIENT = String(process.env.DB_CLIENT || 'sqlite').toLowerCase();
const isPostgres = DB_CLIENT === 'pg' || DB_CLIENT === 'postgres' || DB_CLIENT === 'postgresql';

let sqliteDb = null;
let pgPool = null;
const pgTxStorage = new AsyncLocalStorage();

function transformSqlForPg(sql) {
  let index = 0;
  return String(sql || '').replace(/\?/g, () => `$${++index}`);
}

function getPgExecutor() {
  const store = pgTxStorage.getStore();
  return store?.client || pgPool;
}

async function initializePostgres() {
  if (pgPool) return pgPool;

  const { Pool } = require('pg');

  pgPool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'irrigacion_db',
    max: Number(process.env.DB_POOL_MAX || 20),
    min: Number(process.env.DB_POOL_MIN || 2),
    idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT || 60000),
    connectionTimeoutMillis: Number(process.env.DB_CONNECT_TIMEOUT || 10000)
  });

  pgPool.on('error', (err) => {
    console.error('❌ Error no previsto en pool PostgreSQL:', err);
  });

  const client = await pgPool.connect();
  try {
    await client.query('SELECT 1');
  } finally {
    client.release();
  }

  await createPostgresSchema();
  console.log('✅ Base de datos PostgreSQL inicializada');

  return pgPool;
}

async function createPostgresSchema() {
  const statements = [
    `CREATE TABLE IF NOT EXISTS subdelegaciones (
      id SERIAL PRIMARY KEY,
      nombre TEXT NOT NULL UNIQUE,
      codigo TEXT,
      display_phone_number TEXT NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS clientes (
      telefono VARCHAR(30) PRIMARY KEY,
      nombre_whatsapp TEXT DEFAULT 'Sin Nombre',
      nombre_asignado TEXT,
      foto_perfil TEXT,
      padron TEXT,
      subdelegacion TEXT,
      estado_conversacion TEXT DEFAULT 'BOT',
      padron_superficial TEXT,
      padron_subterraneo TEXT,
      padron_contaminacion TEXT,
      tipo_consulta_preferido TEXT,
      estado_deuda TEXT,
      last_titular TEXT,
      last_ccpp TEXT,
      bot_activo INTEGER DEFAULT 1,
      ultima_interaccion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS tickets (
      id SERIAL PRIMARY KEY,
      cliente_telefono VARCHAR(30) NOT NULL REFERENCES clientes(telefono) ON DELETE CASCADE,
      subdelegacion_id INTEGER REFERENCES subdelegaciones(id),
      estado TEXT NOT NULL DEFAULT 'ABIERTO',
      motivo TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      closed_at TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS horarios_atencion (
      id SERIAL PRIMARY KEY,
      subdelegacion_id INTEGER REFERENCES subdelegaciones(id) ON DELETE CASCADE,
      dia_semana INTEGER NOT NULL,
      hora_inicio TEXT NOT NULL,
      hora_fin TEXT NOT NULL,
      habilitado INTEGER NOT NULL DEFAULT 1,
      mensaje_fuera_horario TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (subdelegacion_id, dia_semana)
    )`,

    `CREATE TABLE IF NOT EXISTS mensajes (
      id SERIAL PRIMARY KEY,
      message_id TEXT UNIQUE,
      cliente_telefono VARCHAR(30) NOT NULL REFERENCES clientes(telefono) ON DELETE CASCADE,
      tipo TEXT NOT NULL,
      cuerpo TEXT NOT NULL,
      url_archivo TEXT,
      emisor TEXT DEFAULT 'usuario',
      leido INTEGER DEFAULT 0,
      fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS notas_internas (
      id SERIAL PRIMARY KEY,
      cliente_telefono VARCHAR(30) NOT NULL REFERENCES clientes(telefono) ON DELETE CASCADE,
      texto TEXT NOT NULL,
      autor TEXT,
      fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS operadores (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      subdelegacion_id INTEGER,
      role TEXT DEFAULT 'operador',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS audit_log (
      id SERIAL PRIMARY KEY,
      usuario TEXT NOT NULL,
      accion TEXT NOT NULL,
      tabla TEXT NOT NULL,
      id_registro TEXT NOT NULL,
      valores_anteriores TEXT,
      valores_nuevos TEXT,
      ip_address TEXT,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE INDEX IF NOT EXISTS idx_subdelegaciones_display_phone ON subdelegaciones(display_phone_number)`,
    `CREATE INDEX IF NOT EXISTS idx_subdelegaciones_nombre ON subdelegaciones(nombre)`,
    `CREATE INDEX IF NOT EXISTS idx_ultima_interaccion ON clientes(ultima_interaccion)`,
    `CREATE INDEX IF NOT EXISTS idx_tickets_cliente ON tickets(cliente_telefono, created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_tickets_estado ON tickets(estado)`,
    `CREATE INDEX IF NOT EXISTS idx_horarios_lookup ON horarios_atencion(subdelegacion_id, dia_semana, habilitado)`,
    `CREATE INDEX IF NOT EXISTS idx_cliente_fecha ON mensajes(cliente_telefono, fecha)`,
    `CREATE INDEX IF NOT EXISTS idx_message_id ON mensajes(message_id)`,
    `CREATE INDEX IF NOT EXISTS idx_cliente_fecha_notas ON notas_internas(cliente_telefono, fecha)`,
    `CREATE INDEX IF NOT EXISTS idx_username ON operadores(username)`,
    `CREATE INDEX IF NOT EXISTS idx_email ON operadores(email)`,
    `CREATE INDEX IF NOT EXISTS idx_usuario_timestamp ON audit_log(usuario, timestamp)`,
    `CREATE INDEX IF NOT EXISTS idx_tabla_id ON audit_log(tabla, id_registro)`,
    `CREATE INDEX IF NOT EXISTS idx_accion ON audit_log(accion)`,
    `CREATE INDEX IF NOT EXISTS idx_timestamp ON audit_log(timestamp)`,

    `ALTER TABLE clientes ADD COLUMN IF NOT EXISTS last_titular TEXT`,
    `ALTER TABLE clientes ADD COLUMN IF NOT EXISTS last_ccpp TEXT`,
    `ALTER TABLE clientes ADD COLUMN IF NOT EXISTS subdelegacion TEXT`,
    `ALTER TABLE clientes ADD COLUMN IF NOT EXISTS estado_conversacion TEXT DEFAULT 'BOT'`,
    `ALTER TABLE clientes ADD COLUMN IF NOT EXISTS padron_superficial TEXT`,
    `ALTER TABLE clientes ADD COLUMN IF NOT EXISTS padron_subterraneo TEXT`,
    `ALTER TABLE clientes ADD COLUMN IF NOT EXISTS padron_contaminacion TEXT`,
    `ALTER TABLE clientes ADD COLUMN IF NOT EXISTS tipo_consulta_preferido TEXT`,
    `ALTER TABLE clientes ADD COLUMN IF NOT EXISTS bot_activo INTEGER DEFAULT 1`,
    `ALTER TABLE clientes ADD COLUMN IF NOT EXISTS fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP`,
    `ALTER TABLE clientes ADD COLUMN IF NOT EXISTS ultima_interaccion TIMESTAMP DEFAULT CURRENT_TIMESTAMP`,
    `ALTER TABLE mensajes ADD COLUMN IF NOT EXISTS leido INTEGER DEFAULT 0`,
    `ALTER TABLE mensajes ADD COLUMN IF NOT EXISTS message_id TEXT`,
    `ALTER TABLE operadores ADD COLUMN IF NOT EXISTS subdelegacion_id INTEGER`
  ];

  for (const sql of statements) {
    await pgPool.query(sql);
  }

  const defaultScheduleRows = [1, 2, 3, 4, 5];
  for (const dia of defaultScheduleRows) {
    await pgPool.query(
      `INSERT INTO horarios_atencion (subdelegacion_id, dia_semana, hora_inicio, hora_fin, habilitado, mensaje_fuera_horario)
       VALUES (NULL, $1, '08:00', '13:30', 1, '👤 En este momento no hay operadores disponibles. Probá mañana de 8:00 a 13:30.')
       ON CONFLICT (subdelegacion_id, dia_semana) DO NOTHING`,
      [dia]
    );
  }
}

function initializeSqlite() {
  if (sqliteDb) return Promise.resolve(sqliteDb);

  const sqlite3 = require('sqlite3').verbose();
  const DB_PATH = process.env.DB_FILENAME || path.join(__dirname, '../../data/irrigacion.db');

  return new Promise((resolve, reject) => {
    sqliteDb = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('❌ Error al conectar a SQLite:', err);
        reject(err);
      } else {
        console.log(`✅ Base de datos SQLite "${DB_PATH}" inicializada`);

        sqliteDb.run('PRAGMA foreign_keys = ON', async (pragmaErr) => {
          if (pragmaErr) {
            reject(pragmaErr);
            return;
          }

          try {
            await createSqliteSchema();
            resolve(sqliteDb);
          } catch (schemaErr) {
            reject(schemaErr);
          }
        });
      }
    });
  });
}

async function createSqliteSchema() {
  const statements = [
    `CREATE TABLE IF NOT EXISTS subdelegaciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL UNIQUE,
      codigo TEXT,
      display_phone_number TEXT NOT NULL UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE INDEX IF NOT EXISTS idx_subdelegaciones_display_phone ON subdelegaciones(display_phone_number)`,
    `CREATE INDEX IF NOT EXISTS idx_subdelegaciones_nombre ON subdelegaciones(nombre)`,

    `CREATE TABLE IF NOT EXISTS clientes (
      telefono TEXT PRIMARY KEY,
      nombre_whatsapp TEXT DEFAULT 'Sin Nombre',
      nombre_asignado TEXT,
      foto_perfil TEXT,
      padron TEXT,
      subdelegacion TEXT,
      estado_conversacion TEXT DEFAULT 'BOT',
      padron_superficial TEXT,
      padron_subterraneo TEXT,
      padron_contaminacion TEXT,
      tipo_consulta_preferido TEXT,
      estado_deuda TEXT,
      last_titular TEXT,
      last_ccpp TEXT,
      bot_activo INTEGER DEFAULT 1,
      ultima_interaccion DATETIME DEFAULT CURRENT_TIMESTAMP,
      fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE INDEX IF NOT EXISTS idx_ultima_interaccion ON clientes(ultima_interaccion)`,

    `CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente_telefono TEXT NOT NULL,
      subdelegacion_id INTEGER,
      estado TEXT NOT NULL DEFAULT 'ABIERTO',
      motivo TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      closed_at DATETIME,
      FOREIGN KEY (cliente_telefono) REFERENCES clientes(telefono) ON DELETE CASCADE,
      FOREIGN KEY (subdelegacion_id) REFERENCES subdelegaciones(id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_tickets_cliente ON tickets(cliente_telefono, created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_tickets_estado ON tickets(estado)`,

    `CREATE TABLE IF NOT EXISTS horarios_atencion (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subdelegacion_id INTEGER,
      dia_semana INTEGER NOT NULL,
      hora_inicio TEXT NOT NULL,
      hora_fin TEXT NOT NULL,
      habilitado INTEGER NOT NULL DEFAULT 1,
      mensaje_fuera_horario TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (subdelegacion_id, dia_semana),
      FOREIGN KEY (subdelegacion_id) REFERENCES subdelegaciones(id) ON DELETE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS idx_horarios_lookup ON horarios_atencion(subdelegacion_id, dia_semana, habilitado)`,

    `CREATE TABLE IF NOT EXISTS mensajes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id TEXT UNIQUE,
      cliente_telefono TEXT NOT NULL,
      tipo TEXT NOT NULL,
      cuerpo TEXT NOT NULL,
      url_archivo TEXT,
      emisor TEXT DEFAULT 'usuario',
      leido INTEGER DEFAULT 0,
      fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (cliente_telefono) REFERENCES clientes(telefono) ON DELETE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS idx_cliente_fecha ON mensajes(cliente_telefono, fecha)`,
    `CREATE INDEX IF NOT EXISTS idx_message_id ON mensajes(message_id)`,

    `CREATE TABLE IF NOT EXISTS notas_internas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente_telefono TEXT NOT NULL,
      texto TEXT NOT NULL,
      autor TEXT,
      fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (cliente_telefono) REFERENCES clientes(telefono) ON DELETE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS idx_cliente_fecha_notas ON notas_internas(cliente_telefono, fecha)`,

    `CREATE TABLE IF NOT EXISTS operadores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      subdelegacion_id INTEGER,
      role TEXT DEFAULT 'operador',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE INDEX IF NOT EXISTS idx_username ON operadores(username)`,
    `CREATE INDEX IF NOT EXISTS idx_email ON operadores(email)`,

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
    `CREATE INDEX IF NOT EXISTS idx_usuario_timestamp ON audit_log(usuario, timestamp)`,
    `CREATE INDEX IF NOT EXISTS idx_tabla_id ON audit_log(tabla, id_registro)`,
    `CREATE INDEX IF NOT EXISTS idx_accion ON audit_log(accion)`,
    `CREATE INDEX IF NOT EXISTS idx_timestamp ON audit_log(timestamp)`
  ];

  for (const sql of statements) {
    await sqliteRun(sql, []);
  }

  const sqliteMigrations = [
    `ALTER TABLE clientes ADD COLUMN subdelegacion TEXT`,
    `ALTER TABLE clientes ADD COLUMN estado_conversacion TEXT DEFAULT 'BOT'`,
    `ALTER TABLE operadores ADD COLUMN subdelegacion_id INTEGER`
  ];

  for (const migrationSql of sqliteMigrations) {
    try {
      await sqliteRun(migrationSql, []);
    } catch (error) {
      if (!/duplicate column name/i.test(String(error?.message || ''))) {
        throw error;
      }
    }
  }

  const defaultScheduleRows = [1, 2, 3, 4, 5];
  for (const dia of defaultScheduleRows) {
    await sqliteRun(
      `INSERT OR IGNORE INTO horarios_atencion (subdelegacion_id, dia_semana, hora_inicio, hora_fin, habilitado, mensaje_fuera_horario)
       VALUES (NULL, ?, '08:00', '13:30', 1, '👤 En este momento no hay operadores disponibles. Probá mañana de 8:00 a 13:30.')`,
      [dia]
    );
  }
}

async function initializeDB() {
  if (isPostgres) {
    return initializePostgres();
  }
  return initializeSqlite();
}

function ensureInitialized() {
  if (isPostgres && !pgPool) {
    throw new Error('Pool PostgreSQL no inicializado. Llama a initializeDB() primero.');
  }
  if (!isPostgres && !sqliteDb) {
    throw new Error('Base de datos SQLite no inicializada. Llama a initializeDB() primero.');
  }
}

async function pgQuery(sql, params = []) {
  ensureInitialized();
  const executor = getPgExecutor();
  const transformed = transformSqlForPg(sql);
  const result = await executor.query(transformed, params);
  return result.rows || [];
}

async function pgGet(sql, params = []) {
  const rows = await pgQuery(sql, params);
  return rows[0] || null;
}

async function pgRun(sql, params = []) {
  ensureInitialized();
  const executor = getPgExecutor();
  const transformedBase = transformSqlForPg(sql);
  let transformed = transformedBase;

  if (/^\s*insert\s+/i.test(transformedBase) && !/\sreturning\s+/i.test(transformedBase)) {
    transformed = `${transformedBase} RETURNING *`;
  }

  const result = await executor.query(transformed, params);
  const firstRow = result.rows && result.rows.length ? result.rows[0] : null;

  return {
    lastID: firstRow?.id || null,
    changes: Number(result.rowCount || 0)
  };
}

function sqliteQuery(sql, params = []) {
  ensureInitialized();
  return new Promise((resolve, reject) => {
    sqliteDb.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

function sqliteRun(sql, params = []) {
  ensureInitialized();
  return new Promise((resolve, reject) => {
    sqliteDb.run(sql, params, function onRun(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function sqliteGet(sql, params = []) {
  ensureInitialized();
  return new Promise((resolve, reject) => {
    sqliteDb.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row || null);
    });
  });
}

async function query(sql, params = []) {
  return isPostgres ? pgQuery(sql, params) : sqliteQuery(sql, params);
}

async function run(sql, params = []) {
  return isPostgres ? pgRun(sql, params) : sqliteRun(sql, params);
}

async function get(sql, params = []) {
  return isPostgres ? pgGet(sql, params) : sqliteGet(sql, params);
}

async function runInTransaction(callback) {
  ensureInitialized();

  if (!isPostgres) {
    return new Promise((resolve, reject) => {
      sqliteDb.serialize(() => {
        sqliteDb.run('BEGIN TRANSACTION', async (beginErr) => {
          if (beginErr) return reject(beginErr);

          try {
            const result = await callback();
            sqliteDb.run('COMMIT', (commitErr) => {
              if (commitErr) return reject(commitErr);
              resolve(result);
            });
          } catch (error) {
            sqliteDb.run('ROLLBACK', () => reject(error));
          }
        });
      });
    });
  }

  const client = await pgPool.connect();
  try {
    await client.query('BEGIN');
    const result = await pgTxStorage.run({ client }, async () => callback());
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {
      // ignore rollback errors
    }
    throw error;
  } finally {
    client.release();
  }
}

function getPool() {
  ensureInitialized();

  if (isPostgres) {
    return {
      query: async (sql, params = []) => ({ rows: await pgQuery(sql, params) }),
      execute: async (sql, params = []) => pgRun(sql, params),
      getConnection: async () => {
        const client = await pgPool.connect();
        return {
          query: async (sql, params = []) => {
            const transformed = transformSqlForPg(sql);
            return client.query(transformed, params);
          },
          release: () => client.release()
        };
      }
    };
  }

  return {
    query: (sql, params = []) => sqliteQuery(sql, params),
    execute: (sql, params = []) => sqliteRun(sql, params),
    getConnection: async () => ({
      query: async (sql, params = []) => sqliteQuery(sql, params),
      release: () => {}
    })
  };
}

function getDB() {
  ensureInitialized();
  return isPostgres ? pgPool : sqliteDb;
}

module.exports = {
  initializeDB,
  query,
  run,
  get,
  getPool,
  getDB,
  runInTransaction,
  isPostgres
};
