const mysql = require('mysql2/promise');
require('dotenv').config();

/**
 * Migración: Corrige los emisores de mensajes guardados
 * Identifica mensajes del bot por patrones de contenido
 */

const PATTERNS_BOT = [
  // Patrones específicos del bot
  'Menú interactivo',
  '¿Qué trámite',
  'Por favor ingresá tu número de padron',
  'buscando tu información',
  'Consulta Exitosa',
  '❌',
  '✅',
  '📋',
  '📄',
  '🔄',
  '👤',
  '🆔',
  '🌾',
  '💰',
  '⏸️',
  'Opción no válida',
  'mensajes de un operador',
  'Hola',
  'bienvenido',
  'necesitas',
  'Ocurrió un error',
  'no se pudo',
  'intenta más tarde',
];

const runMigration = async () => {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });

    console.log('🔄 Iniciando migración de emisores de mensajes...');

    // 1. Obtener todos los mensajes con emisor='usuario'
    const [mensajes] = await connection.execute(
      'SELECT id, cuerpo, emisor FROM mensajes WHERE emisor = ? ORDER BY id',
      ['usuario']
    );

    console.log(`📊 Total de mensajes a revisar: ${mensajes.length}`);

    let updatesCount = 0;
    const updates = [];

    // 2. Analizar cada mensaje para determinar si es del bot
    for (const mensaje of mensajes) {
      let esDelBot = false;

      // Verificar si coincide con algún patrón del bot
      for (const patron of PATTERNS_BOT) {
        if (mensaje.cuerpo && mensaje.cuerpo.includes(patron)) {
          esDelBot = true;
          break;
        }
      }

      // Si es JSON (tipo 'interactive'), probablemente es del bot
      if (mensaje.cuerpo && mensaje.cuerpo.startsWith('{')) {
        try {
          JSON.parse(mensaje.cuerpo);
          esDelBot = true;
        } catch (e) {
          // No es JSON válido, no lo marcamos como bot
        }
      }

      if (esDelBot) {
        updates.push(mensaje.id);
      }
    }

    // 3. Actualizar los mensajes identificados como del bot
    if (updates.length > 0) {
      // Hacer actualización en lotes de 100
      const batchSize = 100;
      for (let i = 0; i < updates.length; i += batchSize) {
        const batch = updates.slice(i, i + batchSize);
        const placeholders = batch.map(() => '?').join(',');
        
        await connection.execute(
          `UPDATE mensajes SET emisor = ? WHERE id IN (${placeholders})`,
          ['bot', ...batch]
        );
        
        updatesCount += batch.length;
        console.log(`✅ Actualizados ${updatesCount}/${updates.length} mensajes`);
      }
    }

    console.log(`\n✨ Migración completada:`);
    console.log(`   - Mensajes analizados: ${mensajes.length}`);
    console.log(`   - Mensajes actualizados a emisor='bot': ${updatesCount}`);
    console.log(`   - Mensajes que quedaron como 'usuario': ${mensajes.length - updatesCount}`);

    // Verificación final
    const [resultado] = await connection.execute(
      'SELECT emisor, COUNT(*) as cantidad FROM mensajes GROUP BY emisor'
    );

    console.log('\n📊 Estado final:');
    for (const row of resultado) {
      console.log(`   - ${row.emisor}: ${row.cantidad} mensajes`);
    }

  } catch (error) {
    console.error('❌ Error en migración:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
};

runMigration();
