const path = require('path');

// This setup is optional. To enable SQLite DB creation/run locally set USE_SQLITE=true
const DB_PATH = path.join(__dirname, '../../irrigacion.db');

let createDatabase = () => {
  console.log('ℹ️ SQLite support disabled. Set USE_SQLITE=true to enable local SQLite setup.');
};

if (process.env.USE_SQLITE === 'true') {
  try {
    const sqlite3 = require('sqlite3').verbose();
    createDatabase = () => {
      const db = new sqlite3.Database(DB_PATH, (err) => {
        if (err) {
          console.error('❌ Error conectando a la base de datos:', err.message);
          return;
        }
        console.log('✅ Conectado a la base de datos SQLite');
      });

      db.serialize(() => {
        // Table creation and sample insertion (same as before)
        db.run(`
          CREATE TABLE IF NOT EXISTS padrones (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            numero_padron TEXT UNIQUE NOT NULL,
            nombre_titular TEXT NOT NULL,
            telefono TEXT,
            direccion TEXT,
            hectareas REAL,
            tipo_cultivo TEXT,
            activo INTEGER DEFAULT 1,
            fecha_alta DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        db.run(`
          CREATE TABLE IF NOT EXISTS deudas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            numero_padron TEXT NOT NULL,
            periodo TEXT NOT NULL,
            monto REAL NOT NULL,
            estado TEXT DEFAULT 'pendiente',
            fecha_vencimiento DATE,
            fecha_pago DATE,
            observaciones TEXT,
            fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (numero_padron) REFERENCES padrones(numero_padron)
          )
        `);

        db.run(`
          CREATE TABLE IF NOT EXISTS mensajes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            telefono TEXT NOT NULL,
            mensaje TEXT NOT NULL,
            tipo TEXT NOT NULL,
            fecha DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        const insertSample = db.prepare(`
          INSERT OR IGNORE INTO padrones 
          (numero_padron, nombre_titular, telefono, direccion, hectareas, tipo_cultivo) 
          VALUES (?, ?, ?, ?, ?, ?)
        `);

        insertSample.run('001', 'Juan Pérez', '5491112345678', 'Calle Falsa 123', 10.5, 'Soja');
        insertSample.run('002', 'María González', '5491187654321', 'Av. Siempreviva 742', 15.0, 'Maíz');
        insertSample.finalize();

        const insertDeuda = db.prepare(`
          INSERT OR IGNORE INTO deudas 
          (numero_padron, periodo, monto, estado, fecha_vencimiento) 
          VALUES (?, ?, ?, ?, ?)
        `);

        insertDeuda.run('001', '2024-01', 15000, 'pendiente', '2024-01-31');
        insertDeuda.run('001', '2024-02', 15000, 'pagada', '2024-02-28');
        insertDeuda.run('002', '2024-01', 22500, 'pendiente', '2024-01-31');
        insertDeuda.finalize();

        console.log('✅ Datos de ejemplo insertados');
      });

      db.close((err) => {
        if (err) {
          console.error('❌ Error cerrando la base de datos:', err.message);
        } else {
          console.log('✅ Base de datos configurada correctamente');
        }
      });
    };

    // If run directly
    if (require.main === module) {
      createDatabase();
    }
  } catch (err) {
    console.warn('⚠️ sqlite3 not installed or failed to load. Skipping SQLite setup.');
  }
}

module.exports = { createDatabase, DB_PATH };
