require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function createDatabase() {
  let connection;
  
  try {
    // Conectar a MySQL sin especificar base de datos
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      multipleStatements: true
    });

    console.log('✅ Conectado a MySQL');

    // Leer el archivo SQL
    const sqlPath = path.join(__dirname, '../database/setup.sql');
    const sqlScript = fs.readFileSync(sqlPath, 'utf8');

    // Ejecutar el script completo
    console.log('📝 Ejecutando script SQL...');
    await connection.query(sqlScript);

    console.log('✅ Base de datos "irrigacion" creada correctamente');
    console.log('✅ Tabla "regantes" creada con datos de prueba');
    console.log('\n🎉 Configuración completada!');
    console.log('\nPadrones de prueba disponibles:');
    console.log('- 001: Juan Pérez (con deuda)');
    console.log('- 002: María González (al día)');
    console.log('- 003: Carlos Rodríguez (con deuda)');
    console.log('- 12345: Ana López (al día)');

  } catch (error) {
    console.error('❌ Error creando base de datos:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Ejecutar
createDatabase();
