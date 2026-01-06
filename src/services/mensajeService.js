const { getPool } = require('../config/db');

/**
 * Guarda un mensaje en la base de datos
 * @param {Object} data - Datos del mensaje
 * @returns {Object} Mensaje guardado con ID
 */
const guardarMensaje = async (data) => {
  try {
    const { 
      telefono, 
      tipo = 'text',
      cuerpo = '',
      url_archivo = null,
      emisor = 'usuario'
    } = data;
    
    const pool = getPool();
    const [result] = await pool.execute(
      'INSERT INTO mensajes (cliente_telefono, tipo, cuerpo, url_archivo, emisor) VALUES (?, ?, ?, ?, ?)',
      [telefono, tipo, cuerpo, url_archivo, emisor]
    );

    console.log(`💾 Mensaje guardado - ID: ${result.insertId} (${tipo}) emisor: ${emisor}`);
    
    return {
      id: result.insertId,
      telefono,
      tipo,
      cuerpo,
      url_archivo,
      emisor,
      fecha: new Date()
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
    const pool = getPool();
    // Convertir limit a número entero para evitar inyección SQL
    const limitNum = Math.min(Math.max(parseInt(limit) || 100, 1), 1000);
    
    const [rows] = await pool.execute(
      `SELECT * FROM mensajes WHERE cliente_telefono = ? ORDER BY fecha ASC LIMIT ${limitNum}`,
      [telefono]
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
    // Usar la nueva tabla clientes
    const clienteService = require('./clienteService');
    return await clienteService.obtenerTodosLosClientes();
  } catch (error) {
    console.error('❌ Error listando conversaciones:', error);
    throw error;
  }
};

/**
 * Marca mensajes como leídos
 * @param {string} telefono - Número de teléfono
 */
const marcarComoLeido = async (telefono) => {
  try {
    const pool = getPool();
    await pool.execute(
      'UPDATE mensajes SET leido = TRUE WHERE cliente_telefono = ? AND leido = FALSE',
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
  marcarComoLeido
};
