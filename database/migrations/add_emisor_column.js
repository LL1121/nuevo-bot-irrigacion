require('dotenv').config();
const mysql = require('mysql2/promise');

const migrate = async () => {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'irrigacion_bot'
    });

    console.log('🔌 Conectando a MySQL...');
    console.log('✅ Conectado');

    // Verificar si la columna ya existe
    const [columns] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_NAME = 'mensajes' AND COLUMN_NAME = 'emisor' AND TABLE_SCHEMA = ?`,
      [process.env.DB_NAME || 'irrigacion_bot']
    );

    if (columns.length === 0) {
      console.log('📝 Agregando columna emisor a tabla mensajes...');
      await connection.query(
        `ALTER TABLE mensajes ADD COLUMN emisor ENUM('bot', 'usuario', 'operador') DEFAULT 'usuario' AFTER cuerpo`
      );
      console.log('✅ Columna emisor agregada correctamente');
    } else {
      console.log('✅ Columna emisor ya existe');
    }

    await connection.end();
    console.log('✅ Migración completada');
  } catch (error) {
    console.error('❌ Error en migración:', error);
    process.exit(1);
  }
};

migrate();
