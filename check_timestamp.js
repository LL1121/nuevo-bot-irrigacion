const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'LauLL112129',
    database: 'irrigacion'
  });
  
  // Obtener el último mensaje "Hola"
  const [rows] = await conn.execute(`
    SELECT id, cuerpo, fecha, 
           DATE_FORMAT(fecha, '%Y-%m-%d %H:%i:%s') as fecha_formateada,
           UNIX_TIMESTAMP(fecha) as unix_timestamp
    FROM mensajes 
    WHERE cliente_telefono = '5492614666411' 
    AND cuerpo = 'Hola'
    ORDER BY fecha DESC 
    LIMIT 1
  `);
  
  if (rows.length > 0) {
    const msg = rows[0];
    console.log('\n📨 Último mensaje "Hola":\n');
    console.log('ID:', msg.id);
    console.log('Fecha RAW (MySQL):', msg.fecha);
    console.log('Fecha formateada:', msg.fecha_formateada);
    console.log('Unix timestamp:', msg.unix_timestamp);
    
    // Parsear en JavaScript
    const jsDate = new Date(msg.fecha);
    console.log('\n🔄 Parseado en JavaScript:');
    console.log('Date object:', jsDate);
    console.log('ISO String:', jsDate.toISOString());
    console.log('Locale String (AR):', jsDate.toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' }));
    console.log('Hora local (2-digit):', jsDate.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }));
  }
  
  conn.end();
})().catch(console.error);
