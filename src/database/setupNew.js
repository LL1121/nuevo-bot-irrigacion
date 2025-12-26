require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function setupDatabase() {
  let connection;
  
  try {
    console.log('🔌 Conectando a MySQL...');
    
    // Conectar sin especificar base de datos
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || ''
    });
    
    console.log('✅ Conectado a MySQL');
    
    // Crear base de datos si no existe
    const dbName = process.env.DB_NAME || 'irrigacion';
    await connection.query(`CREATE DATABASE IF NOT EXISTS ${dbName}`);
    console.log(`✅ Base de datos "${dbName}" creada/verificada`);
    
    // Seleccionar base de datos
    await connection.query(`USE ${dbName}`);
    
    // Leer y ejecutar schema.sql
    const schemaPath = path.join(__dirname, '../../database/schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    
    // Dividir por sentencias (separadas por ;)
    const statements = schemaSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    console.log(`📄 Ejecutando ${statements.length} sentencias SQL...`);
    
    for (const statement of statements) {
      await connection.query(statement);
    }
    
    console.log('✅ Esquema de base de datos creado exitosamente');
    console.log('');
    console.log('📊 Tablas creadas:');
    console.log('  - usuarios (telefono, dni, last_update)');
    console.log('');
    console.log('🎉 Setup completado! Ya puedes iniciar el bot.');
    
  } catch (error) {
    console.error('❌ Error en setup:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

setupDatabase();
