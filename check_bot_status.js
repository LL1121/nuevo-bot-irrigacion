const mysql = require('mysql2/promise');

(async () => {
  const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'LauLL112129',
    database: 'irrigacion'
  });

  console.log('Estado actual del cliente:\n');
  const [rows] = await pool.query('SELECT telefono, nombre_whatsapp, bot_activo, ultima_interaccion FROM clientes');
  console.table(rows);

  console.log('\nActivando bot para todos los clientes...');
  await pool.query('UPDATE clientes SET bot_activo = TRUE WHERE telefono = "5492614666411"');
  
  console.log('\nEstado actualizado:\n');
  const [updatedRows] = await pool.query('SELECT telefono, nombre_whatsapp, bot_activo FROM clientes');
  console.table(updatedRows);

  await pool.end();
})();
