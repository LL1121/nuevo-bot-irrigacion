#!/usr/bin/env node

/**
 * Script de Migración: MySQL → PostgreSQL
 * 
 * Ejecutar: node migrate-db.js
 * 
 * Este script migra datos de MySQL a PostgreSQL
 * Requiere que ambas bases de datos estén disponibles
 */

require('dotenv').config();
const mysql = require('mysql2/promise');
const { Pool } = require('pg');

const SOURCE_DB = {
  host: process.env.MYSQL_HOST || 'localhost',
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DB || 'irrigacion'
};

const TARGET_DB = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'irrigacion_bot'
};

let mysqlConnection = null;
let pgPool = null;

async function connectDatabases() {
  console.log('🔌 Conectando a bases de datos...');
  
  try {
    // Conectar a MySQL
    mysqlConnection = await mysql.createConnection({
      host: SOURCE_DB.host,
      user: SOURCE_DB.user,
      password: SOURCE_DB.password,
      database: SOURCE_DB.database
    });
    console.log('✅ Conectado a MySQL');

    // Conectar a PostgreSQL
    pgPool = new Pool({
      host: TARGET_DB.host,
      port: TARGET_DB.port,
      user: TARGET_DB.user,
      password: TARGET_DB.password,
      database: TARGET_DB.database,
      max: 10
    });

    const client = await pgPool.connect();
    await client.query('SELECT NOW()');
    client.release();
    console.log('✅ Conectado a PostgreSQL');

  } catch (error) {
    console.error('❌ Error conectando:', error.message);
    throw error;
  }
}

async function migrateTable(tableName, query) {
  console.log(`📤 Migrando tabla: ${tableName}`);
  
  try {
    // Obtener datos de MySQL
    const [rows] = await mysqlConnection.query(query);
    console.log(`   - Encontrados ${rows.length} registros`);

    if (rows.length === 0) {
      console.log(`   ✅ Tabla vacía o no existen datos`);
      return;
    }

    // Insertar en PostgreSQL
    for (const row of rows) {
      // Convertir tipos de datos según la tabla
      const values = Object.values(row);
      const placeholders = Object.keys(row).map((_, i) => `$${i + 1}`).join(', ');
      const columns = Object.keys(row).join(', ');

      const insertQuery = `INSERT INTO ${tableName} (${columns}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;

      try {
        await pgPool.query(insertQuery, values);
      } catch (err) {
        if (!err.message.includes('duplicate key')) {
          console.error(`   ❌ Error insertando registro:`, err.message);
        }
      }
    }

    console.log(`   ✅ ${rows.length} registros migrados\n`);

  } catch (error) {
    console.error(`❌ Error migrando ${tableName}:`, error.message);
    throw error;
  }
}

async function migrateData() {
  await connectDatabases();

  console.log('\n📊 Iniciando migración de datos...\n');

  try {
    // 1. Migrar clientes
    await migrateTable('clientes', 'SELECT * FROM clientes');

    // 2. Migrar mensajes
    await migrateTable('mensajes', 'SELECT * FROM mensajes');

    // 3. Migrar deudas
    await migrateTable('deudas', 'SELECT * FROM deudas');

    // 4. Migrar estadísticas
    await migrateTable('estadisticas', 'SELECT * FROM estadisticas');

    console.log('✅ ¡Migración completada exitosamente!\n');

    // Mostrar estadísticas
    console.log('📊 Estadísticas de migración:');
    
    const clientesRes = await pgPool.query('SELECT COUNT(*) FROM clientes');
    console.log(`   - Clientes: ${clientesRes.rows[0].count}`);

    const mensajesRes = await pgPool.query('SELECT COUNT(*) FROM mensajes');
    console.log(`   - Mensajes: ${mensajesRes.rows[0].count}`);

    const deudasRes = await pgPool.query('SELECT COUNT(*) FROM deudas');
    console.log(`   - Deudas: ${deudasRes.rows[0].count}`);

  } catch (error) {
    console.error('❌ Error durante la migración:', error);
    process.exit(1);
  } finally {
    // Cerrar conexiones
    if (mysqlConnection) await mysqlConnection.end();
    if (pgPool) await pgPool.end();
  }
}

// Ejecutar migración
if (require.main === module) {
  migrateData().catch(error => {
    console.error('Error fatal:', error);
    process.exit(1);
  });
}

module.exports = { migrateData };
