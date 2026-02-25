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
  const pool = mysql.createPool(dbConfig);

  console.log('Estado actual del cliente:\n');
  const [rows] = await pool.query('SELECT telefono, nombre_whatsapp, bot_activo, ultima_interaccion FROM clientes');
  console.table(rows);

  console.log('\nActivando bot para todos los clientes...');
  await pool.query('UPDATE clientes SET bot_activo = TRUE WHERE telefono = ?', [targetPhone]);
  
  console.log('\nEstado actualizado:\n');
  const [updatedRows] = await pool.query('SELECT telefono, nombre_whatsapp, bot_activo FROM clientes');
  console.table(updatedRows);

  await pool.end();
})();
