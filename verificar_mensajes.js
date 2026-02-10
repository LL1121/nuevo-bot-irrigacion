const mysql = require('mysql2/promise');

async function verificarMensajes() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'LauLL112129',
    database: 'irrigacion'
  });

  try {
    const [rows] = await connection.execute(`
      SELECT id, cliente_telefono, cuerpo, emisor, 
             DATE_FORMAT(fecha, '%Y-%m-%d %H:%i:%S') as fecha 
      FROM mensajes 
      WHERE cliente_telefono = '5492614666411'
      ORDER BY fecha DESC 
      LIMIT 20
    `);
    
    console.log('\n📊 ÚLTIMOS 20 MENSAJES DE LAUTARO:\n');
    console.table(rows);
    
    // Buscar duplicados exactos
    const [duplicados] = await connection.execute(`
      SELECT cuerpo, emisor, COUNT(*) as cantidad, 
             GROUP_CONCAT(id) as ids,
             MAX(fecha) as fecha_mayor
      FROM mensajes 
      WHERE cliente_telefono = '5492614666411'
      GROUP BY cuerpo, emisor
      HAVING COUNT(*) > 1
      ORDER BY fecha_mayor DESC
    `);
    
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
