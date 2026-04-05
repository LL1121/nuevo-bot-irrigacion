require('dotenv').config();
const { Client } = require('pg');

const quoteIdent = (value) => `"${String(value).replace(/"/g, '""')}"`;

async function createDatabaseIfMissing() {
  const adminClient = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_SUPERUSER || process.env.DB_USER || 'postgres',
    password: process.env.DB_SUPERUSER_PASSWORD || process.env.DB_PASSWORD || '',
    database: process.env.DB_SUPERUSER_DATABASE || 'postgres'
  });

  const dbName = process.env.DB_NAME || 'bot_irrigacion';

  await adminClient.connect();
  try {
    const { rows } = await adminClient.query(
      'SELECT 1 FROM pg_database WHERE datname = $1 LIMIT 1',
      [dbName]
    );

    if (rows.length === 0) {
      await adminClient.query(`CREATE DATABASE ${quoteIdent(dbName)}`);
      console.log(`✅ Base de datos creada: ${dbName}`);
    } else {
      console.log(`ℹ️ La base de datos ya existe: ${dbName}`);
    }
  } finally {
    await adminClient.end();
  }
}

async function setupPostgres() {
  try {
    process.env.DB_CLIENT = 'pg';

    await createDatabaseIfMissing();

    // Carga el esquema en la DB objetivo
    const { initializeDB } = require('../config/db');
    await initializeDB();

    console.log('✅ PostgreSQL listo para el proyecto');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error configurando PostgreSQL:', error.message);
    process.exit(1);
  }
}

setupPostgres();
