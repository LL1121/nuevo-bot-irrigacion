const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'LauLL112129',
    database: 'irrigacion'
  });
  
  const [rows] = await conn.execute(`
    SELECT id, emisor, cuerpo, DATE_FORMAT(fecha, '%Y-%m-%d %H:%i:%S') as fecha 
    FROM mensajes 
    WHERE cliente_telefono = '5492614666411' 
    AND id BETWEEN 81 AND 90
    ORDER BY id
  `);
  
  console.log('\n📋 Mensajes 81-90:\n');
  console.table(rows);
  
  conn.end();
})().catch(console.error);
