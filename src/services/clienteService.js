const { getPool } = require('../config/db');
const { withTransaction } = require('./transactionService');
const { registrarCambio } = require('./auditService');

/**
 * Servicio para gestión de clientes (auto-registro)
 */

/**
 * Obtener o crear cliente desde WhatsApp
 * @param {string} telefono - Número de WhatsApp
 * @param {string} nombre - Nombre de perfil (pushName)
 * @param {string} fotoPerfil - URL de foto de perfil (opcional)
 * @returns {Object} Datos del cliente
 */
const obtenerOCrearCliente = async (telefono, nombre = 'Sin Nombre', fotoPerfil = null) => {
  try {
    // Buscar cliente existente
    const pool = getPool();
    const [rows] = await pool.execute(
      'SELECT * FROM clientes WHERE telefono = ?',
      [telefono]
    );

    if (rows.length > 0) {
      // Cliente existe - actualizar ultima_interaccion, nombre y foto si están vacíos
      await pool.execute(
        'UPDATE clientes SET ultima_interaccion = NOW(), nombre_whatsapp = COALESCE(nombre_whatsapp, ?), foto_perfil = COALESCE(foto_perfil, ?) WHERE telefono = ?',
        [nombre, fotoPerfil, telefono]
      );
      
      console.log(`👤 Cliente existente: ${telefono} - ${nombre}`);
      // Retornar cliente actualizado
      const [updatedClient] = await pool.execute(
        'SELECT * FROM clientes WHERE telefono = ?',
        [telefono]
      );
      return updatedClient[0];
    }

    // Cliente nuevo - crear registro
    await pool.execute(
      'INSERT INTO clientes (telefono, nombre_whatsapp, foto_perfil, bot_activo, fecha_registro, ultima_interaccion) VALUES (?, ?, ?, TRUE, NOW(), NOW())',
      [telefono, nombre, fotoPerfil]
    );

    console.log(`✨ Nuevo cliente registrado: ${telefono} - ${nombre}`);

    // Retornar el cliente recién creado
    const [newClient] = await pool.execute(
      'SELECT * FROM clientes WHERE telefono = ?',
      [telefono]
    );

    return newClient[0];
  } catch (error) {
    console.error('❌ Error en obtenerOCrearCliente:', error);
    throw error;
  }
};

/**
 * Obtener todos los clientes con su último mensaje
 * @returns {Array} Lista de clientes con último mensaje
 */
const obtenerTodosLosClientes = async () => {
  try {
    const pool = getPool();
    const [rows] = await pool.execute(`
      SELECT 
        c.telefono,
        c.nombre_whatsapp,
        c.nombre_asignado,
        c.foto_perfil,
        c.padron,
        c.estado_deuda,
        c.bot_activo,
        c.ultima_interaccion,
        c.fecha_registro,
        (SELECT cuerpo FROM mensajes WHERE cliente_telefono = c.telefono ORDER BY fecha DESC LIMIT 1) as ultimo_mensaje,
        (SELECT fecha FROM mensajes WHERE cliente_telefono = c.telefono ORDER BY fecha DESC LIMIT 1) as ultimo_mensaje_fecha,
        (SELECT COUNT(*) FROM mensajes WHERE cliente_telefono = c.telefono) as total_mensajes
      FROM clientes c
      ORDER BY c.ultima_interaccion DESC
    `);

    console.log(`📋 ${rows.length} clientes obtenidos`);
    return rows;
  } catch (error) {
    console.error('❌ Error en obtenerTodosLosClientes:', error);
    throw error;
  }
};

/**
 * Actualizar DNI del cliente
 * TRANSACCIÓN: Actualiza DNI + timestamp en una sola operación atómica
 * AUDITORÍA: Registra el cambio en audit_log
 * @param {string} telefono - Número de teléfono
 * @param {string} dni - DNI del cliente
 * @param {string} usuario - Usuario que realizó el cambio (para auditoría)
 */
const actualizarDni = async (telefono, dni, usuario = 'SYSTEM') => {
  return withTransaction(async (connection) => {
    try {
      console.log(`📝 Actualizando DNI en TRANSACCIÓN...`);
      
      // Obtener valor anterior para auditoría
      const [clienteActual] = await connection.execute(
        'SELECT padron FROM clientes WHERE telefono = ?',
        [telefono]
      );
      const valoresAnteriores = clienteActual.length > 0 ? { padron: clienteActual[0].padron } : null;

      // OPERACIÓN 1: Actualizar DNI
      const [result] = await connection.execute(
        'UPDATE clientes SET padron = ?, ultima_interaccion = NOW() WHERE telefono = ?',
        [dni, telefono]
      );
      console.log(`   ✅ DNI ${dni} actualizado para ${telefono}`);

      // AUDITORÍA: Registrar el cambio
      await registrarCambio(
        usuario,
        'UPDATE',
        'clientes',
        telefono,
        valoresAnteriores,
        { padron: dni }
      );

      return result.affectedRows > 0;
    } catch (error) {
      console.error('❌ Error en transacción de DNI:', error.message);
      throw error;
    }
  });
};

/**
 * Obtener DNI de un cliente
 * @param {string} telefono - Número de teléfono
 * @returns {string|null} DNI o null
 */
const obtenerDni = async (telefono) => {
  try {
    const pool = getPool();
    const [rows] = await pool.execute(
      'SELECT padron FROM clientes WHERE telefono = ?',
      [telefono]
    );
    return rows.length > 0 && rows[0].padron ? rows[0].padron : null;
  } catch (error) {
    console.error('❌ Error obteniendo DNI:', error);
    return null;
  }
};

/**
 * Cambiar estado del bot para un cliente
 * AUDITORÍA: Registra el cambio en audit_log
 * @param {string} telefono - Número de teléfono
 * @param {boolean} activo - Estado del bot (true/false)
 * @param {string} usuario - Usuario que realizó el cambio (para auditoría)
 */
const cambiarEstadoBot = async (telefono, activo, usuario = 'SYSTEM') => {
  try {
    const pool = getPool();

    // Obtener estado anterior para auditoría
    const [clienteActual] = await pool.execute(
      'SELECT bot_activo FROM clientes WHERE telefono = ?',
      [telefono]
    );
    const valoresAnteriores = clienteActual.length > 0 ? { bot_activo: clienteActual[0].bot_activo } : null;

    await pool.execute(
      'UPDATE clientes SET bot_activo = ? WHERE telefono = ?',
      [activo, telefono]
    );

    // AUDITORÍA: Registrar el cambio
    await registrarCambio(
      usuario,
      'UPDATE',
      'clientes',
      telefono,
      valoresAnteriores,
      { bot_activo: activo }
    );

    console.log(`🤖 Bot ${activo ? 'activado' : 'pausado'} para ${telefono}`);
    return true;
  } catch (error) {
    console.error('❌ Error cambiando estado bot:', error);
    throw error;
  }
};

/**
 * Verificar si el bot está activo para un cliente
 * @param {string} telefono - Número de teléfono
 * @returns {boolean} Estado del bot
 */
const esBotActivo = async (telefono) => {
  try {
    const pool = getPool();
    const [rows] = await pool.execute(
      'SELECT bot_activo FROM clientes WHERE telefono = ?',
      [telefono]
    );
    return rows.length > 0 ? Boolean(rows[0].bot_activo) : true;
  } catch (error) {
    console.error('❌ Error verificando estado bot:', error);
    return true; // Por defecto activo
  }
};

module.exports = {
  obtenerOCrearCliente,
  obtenerTodosLosClientes,
  actualizarDni,
  obtenerDni,
  cambiarEstadoBot,
  esBotActivo
};
