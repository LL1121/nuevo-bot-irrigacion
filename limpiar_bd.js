const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'LauLL112129',
    database: 'irrigacion'
  });
  
  console.log('🗑️ Eliminando mensajes históricos corruptos (IDs 81-86)...\n');
  
  const [result] = await conn.execute(`
    DELETE FROM mensajes 
    WHERE cliente_telefono = '5492614666411' 
    AND id BETWEEN 81 AND 86
    AND emisor = 'operador'
    AND fecha < '2026-02-01'
  `);
  
  console.log('✅ Eliminados:', result.affectedRows, 'mensajes\n');
  
  // Verificar que se borraron
  const [remaining] = await conn.execute(`
    SELECT COUNT(*) as count FROM mensajes 
    WHERE cliente_telefono = '5492614666411' 
    AND id BETWEEN 81 AND 86
  `);
  
  console.log('📊 Mensajes restantes en ese rango:', remaining[0].count);
  
  conn.end();
})().catch(console.error);
