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
  
  // Obtener el último mensaje "Hola"
  const [rows] = await conn.execute(`
    SELECT id, cuerpo, fecha, 
           DATE_FORMAT(fecha, '%Y-%m-%d %H:%i:%s') as fecha_formateada,
           UNIX_TIMESTAMP(fecha) as unix_timestamp
    FROM mensajes 
    WHERE cliente_telefono = ? 
    AND cuerpo = 'Hola'
    ORDER BY fecha DESC 
    LIMIT 1
  `, [targetPhone]);
  
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
