const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '../../irrigacion.db');

const createDatabase = () => {
  const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
      console.error('❌ Error conectando a la base de datos:', err.message);
      return;
    }
    console.log('✅ Conectado a la base de datos SQLite');
  });

  db.serialize(() => {
    // Tabla de padrones
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
    `, (err) => {
      if (err) {
        console.error('❌ Error creando tabla padrones:', err.message);
      } else {
        console.log('✅ Tabla "padrones" creada/verificada');
      }
    });

    // Tabla de deudas
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
    `, (err) => {
      if (err) {
        console.error('❌ Error creando tabla deudas:', err.message);
      } else {
        console.log('✅ Tabla "deudas" creada/verificada');
      }
    });

    // Tabla de mensajes (opcional, para registro)
    db.run(`
      CREATE TABLE IF NOT EXISTS mensajes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        telefono TEXT NOT NULL,
        mensaje TEXT NOT NULL,
        tipo TEXT NOT NULL,
        fecha DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) {
        console.error('❌ Error creando tabla mensajes:', err.message);
      } else {
        console.log('✅ Tabla "mensajes" creada/verificada');
      }
    });

    // Insertar datos de ejemplo
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

// Ejecutar si se llama directamente
if (require.main === module) {
  createDatabase();
}

module.exports = { createDatabase, DB_PATH };
