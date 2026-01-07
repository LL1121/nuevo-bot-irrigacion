require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function migrarAClientes() {
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
    
    // Desactivar foreign key checks
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    console.log('🔓 Foreign key checks desactivadas');
    
    // Leer schema
    const schemaPath = path.join(__dirname, '../schema_clientes.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    
    // Dividir y ejecutar sentencias
    const statements = schemaSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    console.log(`📄 Ejecutando ${statements.length} sentencias SQL...`);
    
    for (const statement of statements) {
      try {
        await connection.query(statement);
      } catch (error) {
        if (!error.message.includes('already exists')) {
          throw error;
        }
      }
    }
    
    console.log('✅ Tablas creadas exitosamente');
    
    // Reactivar foreign key checks
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('🔒 Foreign key checks reactivadas');
    
    // Verificar datos
    const [clientes] = await connection.query('SELECT * FROM clientes LIMIT 5');
    console.log('\n📊 Clientes registrados:');
    console.table(clientes);
    
    const [mensajes] = await connection.query('SELECT COUNT(*) as total FROM mensajes');
    console.log(`\n💬 Total de mensajes: ${mensajes[0].total}`);
    
    await connection.end();
    console.log('\n🎉 Migración completada!');
    console.log('\n📝 Próximos pasos:');
    console.log('1. Reiniciar el servidor: npm start');
    console.log('2. Enviar mensaje por WhatsApp para probar el auto-registro');
    console.log('3. Verificar en GET /api/chats que aparezca el cliente');
    
  } catch (error) {
    console.error('❌ Error en migración:', error.message);
    if (connection) await connection.end();
    process.exit(1);
  }
}

migrarAClientes();
