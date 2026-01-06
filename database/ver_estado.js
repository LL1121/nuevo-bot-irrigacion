require('dotenv').config();
const mysql = require('mysql2/promise');

async function verEstadoDB() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'irrigacion'
    });
    
    console.log('✅ Conectado a MySQL\n');
    
    // Ver todas las tablas
    const [tables] = await connection.query('SHOW TABLES');
    console.log('📋 TABLAS EN LA BASE DE DATOS:');
    console.log('================================');
    tables.forEach(table => {
      console.log(`  - ${Object.values(table)[0]}`);
    });
    
    console.log('\n📊 ESTRUCTURA Y DATOS:\n');
    
    // Clientes
    console.log('🔹 TABLA: clientes');
    console.log('-------------------');
    try {
      const [clientesStructure] = await connection.query('DESCRIBE clientes');
      console.table(clientesStructure);
      
      const [clientes] = await connection.query('SELECT * FROM clientes');
      console.log(`\n📈 Total: ${clientes.length} registros`);
      if (clientes.length > 0) {
        console.table(clientes);
      }
    } catch (e) {
      console.log('⚠️ Tabla no existe o error:', e.message);
    }
    
    console.log('\n🔹 TABLA: mensajes');
    console.log('-------------------');
    try {
      const [mensajesStructure] = await connection.query('DESCRIBE mensajes');
      console.table(mensajesStructure);
      
      const [mensajes] = await connection.query('SELECT * FROM mensajes ORDER BY timestamp DESC LIMIT 10');
      console.log(`\n📈 Últimos 10 mensajes:`);
      if (mensajes.length > 0) {
        console.table(mensajes);
      }
      
      const [total] = await connection.query('SELECT COUNT(*) as total FROM mensajes');
      console.log(`\n💬 Total de mensajes: ${total[0].total}`);
    } catch (e) {
      console.log('⚠️ Tabla no existe o error:', e.message);
    }
    
    console.log('\n🔹 TABLA: usuarios (legacy)');
    console.log('-------------------');
    try {
      const [usuarios] = await connection.query('SELECT * FROM usuarios LIMIT 5');
      console.log(`📈 Total: ${usuarios.length} registros`);
      if (usuarios.length > 0) {
        console.table(usuarios);
      }
    } catch (e) {
      console.log('⚠️ Tabla no existe');
    }
    
    await connection.end();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (connection) await connection.end();
    process.exit(1);
  }
}

verEstadoDB();
