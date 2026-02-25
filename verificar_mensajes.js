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

async function verificarMensajes() {
  const connection = await mysql.createConnection(dbConfig);

  try {
    const [rows] = await connection.execute(`
      SELECT id, cliente_telefono, cuerpo, emisor, 
             DATE_FORMAT(fecha, '%Y-%m-%d %H:%i:%S') as fecha 
      FROM mensajes 
      WHERE cliente_telefono = ?
      ORDER BY fecha DESC 
      LIMIT 20
    `, [targetPhone]);
    
    console.log('\n📊 ÚLTIMOS 20 MENSAJES DE LAUTARO:\n');
    console.table(rows);
    
    // Buscar duplicados exactos
    const [duplicados] = await connection.execute(`
      SELECT cuerpo, emisor, COUNT(*) as cantidad, 
             GROUP_CONCAT(id) as ids,
             MAX(fecha) as fecha_mayor
      FROM mensajes 
      WHERE cliente_telefono = ?
      GROUP BY cuerpo, emisor
      HAVING COUNT(*) > 1
      ORDER BY fecha_mayor DESC
    `, [targetPhone]);
    
    if (duplicados.length > 0) {
      console.log('\n⚠️ MENSAJES DUPLICADOS ENCONTRADOS:\n');
      console.table(duplicados);
    } else {
      console.log('\n✅ NO hay mensajes duplicados en la BD\n');
    }
    
  } finally {
    await connection.end();
  }
}

verificarMensajes().catch(console.error);
