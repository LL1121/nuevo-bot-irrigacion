const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'irrigacion'
};

if (!dbConfig.password) {
  throw new Error('Falta DB_PASSWORD en variables de entorno');
}

const targetPhone = process.env.TARGET_PHONE || '5492614666411';

(async () => {
  const conn = await mysql.createConnection(dbConfig);
  
  console.log('🗑️ Eliminando mensajes históricos corruptos (IDs 81-86)...\n');
  
  const [result] = await conn.execute(`
    DELETE FROM mensajes 
      WHERE cliente_telefono = ? 
    AND id BETWEEN 81 AND 86
    AND emisor = 'operador'
    AND fecha < '2026-02-01'
    `, [targetPhone]);
  
  console.log('✅ Eliminados:', result.affectedRows, 'mensajes\n');
  
  // Verificar que se borraron
  const [remaining] = await conn.execute(`
    SELECT COUNT(*) as count FROM mensajes 
    WHERE cliente_telefono = ? 
    AND id BETWEEN 81 AND 86
  `, [targetPhone]);
  
  console.log('📊 Mensajes restantes en ese rango:', remaining[0].count);
  
  conn.end();
})().catch(console.error);
