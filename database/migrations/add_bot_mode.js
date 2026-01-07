require('dotenv').config();
const mysql = require('mysql2/promise');

async function addBotModeColumn() {
  let connection;
  
  try {
    console.log('🔌 Conectando a MySQL...');
    
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'irrigacion'
    });
    
    console.log('✅ Conectado a MySQL');
    
    // Verificar si la columna ya existe
    const [columns] = await connection.query(
      "SHOW COLUMNS FROM usuarios LIKE 'bot_mode'"
    );
    
    if (columns.length > 0) {
      console.log('⚠️ La columna bot_mode ya existe');
      await connection.end();
      return;
    }
    
    // Agregar columna bot_mode
    await connection.query(`
      ALTER TABLE usuarios 
      ADD COLUMN bot_mode ENUM('active', 'paused') DEFAULT 'active' NOT NULL
      AFTER dni
    `);
    
    console.log('✅ Columna bot_mode agregada exitosamente');
    
    // Verificar
    const [rows] = await connection.query('SELECT telefono, dni, bot_mode FROM usuarios LIMIT 5');
    console.log('\n📊 Usuarios actualizados:');
    console.table(rows);
    
    await connection.end();
    console.log('\n🎉 Migración completada!');
    
  } catch (error) {
    console.error('❌ Error en migración:', error.message);
    if (connection) await connection.end();
    process.exit(1);
  }
}

addBotModeColumn();
