const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'LauLL112129',
    database: 'irrigacion'
  });
  
  const [msgs] = await conn.execute(`
    SELECT id, cuerpo, 
           DATE_FORMAT(fecha, '%H:%i') as hora,
           emisor
    FROM mensajes 
    WHERE cliente_telefono = '5492614666411' 
    AND TIME(fecha) BETWEEN '09:08:00' AND '09:10:00'
    ORDER BY fecha DESC
  `);
  
  console.log('\n🕘 Mensajes entre 09:08 y 09:10:\n');
  if (msgs.length === 0) {
    console.log('   No hay mensajes en este horario');
  } else {
    console.table(msgs);
  }
  
  conn.end();
})().catch(console.error);
