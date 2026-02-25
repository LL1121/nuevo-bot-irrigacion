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
  
  const [rows] = await conn.execute(`
    SELECT id, emisor, cuerpo, DATE_FORMAT(fecha, '%Y-%m-%d %H:%i:%S') as fecha 
    FROM mensajes 
    WHERE cliente_telefono = ? 
    AND id BETWEEN 81 AND 90
    ORDER BY id
  `, [targetPhone]);
  
  console.log('\n📋 Mensajes 81-90:\n');
  console.table(rows);
  
  conn.end();
})().catch(console.error);
