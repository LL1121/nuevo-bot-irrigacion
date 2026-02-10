const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'LauLL112129',
    database: 'irrigacion'
  });
  
  console.log('\n📊 COMPARACIÓN PREVIEW vs MENSAJES:\n');
  
  // 1. Cómo el backend obtiene el preview (lista de chats)
  const [preview] = await conn.execute(`
    SELECT 
      (SELECT fecha FROM mensajes WHERE cliente_telefono = '5492614666411' ORDER BY fecha DESC LIMIT 1) as ultimo_mensaje_fecha
  `);
  console.log('1️⃣ PREVIEW (ultimo_mensaje_fecha en lista):', preview[0].ultimo_mensaje_fecha);
  
  // 2. Cómo el backend obtiene mensajes individuales
  const [msgs] = await conn.execute(`
    SELECT id, cuerpo, fecha, emisor
    FROM mensajes 
    WHERE cliente_telefono = '5492614666411' 
    ORDER BY fecha DESC 
    LIMIT 5
  `);
  
  console.log('\n2️⃣ MENSAJES INDIVIDUALES (endpoint /api/messages/:telefono):');
  msgs.forEach(m => {
    console.log(`  - ID ${m.id}: "${m.cuerpo.substring(0, 30)}" (${m.emisor})`);
    console.log(`    fecha MySQL:`, m.fecha);
    console.log(`    fecha JS:`, new Date(m.fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }));
    console.log('');
  });
  
  conn.end();
})().catch(console.error);
