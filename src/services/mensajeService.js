const pool = require('../config/db');

/**
 * Guarda un mensaje en la base de datos
 * @param {Object} data - Datos del mensaje
 * @returns {Object} Mensaje guardado con ID
 */
const guardarMensaje = async (data) => {
  try {
    const { telefono, padron, remitente, contenido, tipo_mensaje = 'text' } = data;
    
    const [result] = await pool.execute(
      'INSERT INTO mensajes (telefono, padron, remitente, contenido, tipo_mensaje) VALUES (?, ?, ?, ?, ?)',
      [telefono, padron, remitente, contenido, tipo_mensaje]
    );

    console.log(`💾 Mensaje guardado - ID: ${result.insertId} (${remitente})`);
    
    // Actualizar conversación
    await actualizarConversacion(telefono, contenido, padron);
    
    return {
      id: result.insertId,
      telefono,
      remitente,
      contenido,
      timestamp: new Date()
    };
  } catch (error) {
    console.error('❌ Error guardando mensaje:', error);
    throw error;
  }
};

/**
 * Obtiene el historial de mensajes de un teléfono
 * @param {string} telefono - Número de teléfono
 * @param {number} limit - Cantidad de mensajes a traer
 * @returns {Array} Lista de mensajes
 */
const obtenerMensajes = async (telefono, limit = 100) => {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM mensajes WHERE telefono = ? ORDER BY timestamp ASC LIMIT ?',
      [telefono, limit]
    );

    console.log(`📜 ${rows.length} mensajes obtenidos para ${telefono}`);
    return rows;
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
    const [rows] = await pool.execute(
      'SELECT * FROM conversaciones ORDER BY ultima_actividad DESC'
    );

    console.log(`💬 ${rows.length} conversaciones activas`);
    return rows;
  } catch (error) {
    console.error('❌ Error listando conversaciones:', error);
    throw error;
  }
};

/**
 * Actualiza o crea una conversación
 * @param {string} telefono - Número de teléfono
 * @param {string} ultimoMensaje - Último mensaje enviado
 * @param {string} padron - Padrón del usuario (opcional)
 */
const actualizarConversacion = async (telefono, ultimoMensaje, padron = null) => {
  try {
    await pool.execute(
      `INSERT INTO conversaciones (telefono, padron, ultimo_mensaje, ultima_actividad) 
       VALUES (?, ?, ?, NOW()) 
       ON DUPLICATE KEY UPDATE 
       ultimo_mensaje = ?, 
       ultima_actividad = NOW(),
       mensajes_no_leidos = mensajes_no_leidos + 1`,
      [telefono, padron, ultimoMensaje, ultimoMensaje]
    );
  } catch (error) {
    console.error('❌ Error actualizando conversación:', error);
  }
};

/**
 * Marca mensajes como leídos
 * @param {string} telefono - Número de teléfono
 */
const marcarComoLeido = async (telefono) => {
  try {
    await pool.execute(
      'UPDATE mensajes SET leido = TRUE WHERE telefono = ? AND remitente = "cliente" AND leido = FALSE',
      [telefono]
    );

    await pool.execute(
      'UPDATE conversaciones SET mensajes_no_leidos = 0 WHERE telefono = ?',
      [telefono]
    );

    console.log(`✅ Mensajes marcados como leídos: ${telefono}`);
  } catch (error) {
    console.error('❌ Error marcando como leído:', error);
  }
};

module.exports = {
  guardarMensaje,
  obtenerMensajes,
  listarConversaciones,
  actualizarConversacion,
  marcarComoLeido
};
