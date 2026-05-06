const { query, run, get } = require('../config/db');
const { withTransaction } = require('./transactionService');
const clienteService = require('./clienteService');

/**
 * Guarda un mensaje en la base de datos + actualiza cliente
 * TRANSACCIÓN ATÓMICA: Ambas operaciones se completan juntas o se revierten juntas
 * 
 * @param {Object} data - Datos del mensaje
 * @returns {Object} Mensaje guardado con ID
 */
const guardarMensaje = async (data) => {
  return withTransaction(async () => {
    try {
      const { 
        telefono, 
        tipo = 'text',
        cuerpo = '',
        url_archivo = null,
        emisor = 'usuario',
        message_id = null
      } = data;

      console.log(`📨 Guardando mensaje + actualizando cliente en TRANSACCIÓN...`);
      
      // DEDUP: Evitar guardar el mismo mensaje entrante dos veces
      if (message_id) {
        const existing = await get(
          'SELECT id, cliente_telefono, tipo, cuerpo, url_archivo, emisor, fecha FROM mensajes WHERE message_id = ? LIMIT 1',
          [message_id]
        );
        if (existing) {
          console.log(`   ⚠️ Mensaje duplicado ignorado (message_id: ${message_id})`);
          return {
            id: existing.id,
            telefono: existing.cliente_telefono,
            tipo: existing.tipo,
            cuerpo: existing.cuerpo,
            url_archivo: existing.url_archivo,
            emisor: existing.emisor,
            fecha: existing.fecha
          };
        }
      }

      // OPERACIÓN 1: Guardar mensaje
      const result = await run(
        'INSERT INTO mensajes (cliente_telefono, tipo, cuerpo, url_archivo, emisor, message_id) VALUES (?, ?, ?, ?, ?, ?)',
        [telefono, tipo, cuerpo, url_archivo, emisor, message_id]
      );
      console.log(`   ✅ Mensaje insertado - LastID: ${result.lastID}`);

      // OPERACIÓN 2: Actualizar última interacción del cliente (SOLO si el mensaje es del usuario)
      if (emisor === 'usuario') {
        await run(
          'UPDATE clientes SET ultima_interaccion = CURRENT_TIMESTAMP WHERE telefono = ?',
          [telefono]
        );
        console.log(`   ✅ Cliente actualizado`);
      } else {
        console.log(`   ⏭️ Cliente NO actualizado (emisor: ${emisor})`);
      }

      return {
        id: result.lastID,
        telefono,
        tipo,
        cuerpo,
        url_archivo,
        emisor,
        fecha: new Date()
      };
    } catch (error) {
      console.error('❌ Error en transacción de mensaje:', error.message);
      throw error; // Trigger rollback
    }
  });
};

/**
 * Obtiene el historial de mensajes de un teléfono
 * OPTIMIZADO: Solo campos necesarios, límite razonable por defecto
 * @param {string} telefono - Número de teléfono
 * @param {number} limit - Cantidad de mensajes a traer
 * @returns {Array} Lista de mensajes
 */
const obtenerMensajes = async (telefono, limit = 50, offset = 0) => {
  try {
    // Convertir limit a número entero para evitar inyección SQL
    // OPTIMIZACIÓN: Límite por defecto 50 en lugar de 100
    const limitNum = Math.min(Math.max(parseInt(limit) || 50, 1), 200);
    const offsetNum = Math.max(parseInt(offset) || 0, 0);
    
    // OPTIMIZACIÓN: Campos específicos en lugar de SELECT *
    // Obtener los últimos N mensajes (ORDER BY DESC) y luego invertir el array
    const rows = await query(
      `SELECT id, cliente_telefono, tipo, cuerpo, url_archivo, emisor, fecha 
       FROM mensajes 
       WHERE cliente_telefono = ? 
       ORDER BY fecha DESC 
       LIMIT ${limitNum} OFFSET ${offsetNum}`,
      [telefono]
    );

    // OPTIMIZACIÓN: Sin console.log en cada request (reduce I/O)
    // Invertir el array para que el frontend los reciba del más viejo al más nuevo
    return rows ? rows.reverse() : [];
  } catch (error) {
    console.error('❌ Error obteniendo mensajes:', error);
    throw error;
  }
};

/**
 * Lista todas las conversaciones activas
 * @returns {Array} Lista de conversaciones
 */
const listarConversaciones = async () => {
  try {
    // Usar la nueva tabla clientes
    const clienteService = require('./clienteService');
    return await clienteService.obtenerTodosLosClientes();
  } catch (error) {
    console.error('❌ Error listando conversaciones:', error);
    throw error;
  }
};

/**
 * Marca mensajes como leídos + actualiza cliente
 * TRANSACCIÓN: Ambas operaciones atómicas
 * @param {string} telefono - Número de teléfono
 */
const marcarComoLeido = async (telefono) => {
  return withTransaction(async () => {
    try {
      console.log(`👀 Marcando mensajes como leídos en TRANSACCIÓN...`);
      
      // OPERACIÓN 1: Marcar mensajes como leídos
      const result = await run(
        'UPDATE mensajes SET leido = 1 WHERE cliente_telefono = ? AND leido = 0',
        [telefono]
      );
      console.log(`   ✅ ${result.changes} mensajes marcados como leídos`);

      // OPERACIÓN 2: Actualizar metadata del cliente
      await run(
        'UPDATE clientes SET ultima_interaccion = CURRENT_TIMESTAMP WHERE telefono = ?',
        [telefono]
      );
      console.log(`   ✅ Cliente actualizado`);
      console.log(`✅ Mensajes marcados como leídos: ${telefono}`);

      return { changes: result.changes };
    } catch (error) {
      console.error('❌ Error en transacción de lectura:', error.message);
      throw error;
    }
  });
};

module.exports = {
  guardarMensaje,
  obtenerMensajes,
  listarConversaciones,
  marcarComoLeido
};
