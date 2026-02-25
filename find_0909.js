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
  
  const [msgs] = await conn.execute(`
    SELECT id, cuerpo, 
           DATE_FORMAT(fecha, '%H:%i') as hora,
           emisor
    FROM mensajes 
    WHERE cliente_telefono = ? 
    AND TIME(fecha) BETWEEN '09:08:00' AND '09:10:00'
    ORDER BY fecha DESC
  `, [targetPhone]);
  
  console.log('\n🕘 Mensajes entre 09:08 y 09:10:\n');
  if (msgs.length === 0) {
    console.log('   No hay mensajes en este horario');
  } else {
    console.table(msgs);
  }
  
  conn.end();
})().catch(console.error);
