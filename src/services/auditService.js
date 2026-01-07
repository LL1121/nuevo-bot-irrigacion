const { getPool } = require('../config/db');

/**
 * Servicio de Auditoría - Registra cambios en tablas críticas
 * Soporta: usuario, acción, tabla, id_registro, valores_anteriores, valores_nuevos, timestamp, ip_address
 */

/**
 * Registra un evento de auditoría en la tabla audit_log
 * @param {string} usuario - Email/usuario que realizó la acción
 * @param {string} accion - Tipo de acción (INSERT, UPDATE, DELETE)
 * @param {string} tabla - Nombre de la tabla afectada
 * @param {string|number} idRegistro - ID del registro afectado (clave primaria)
 * @param {object} valoresAnteriores - Valores antes del cambio (null para INSERT)
 * @param {object} valoresNuevos - Valores después del cambio
 * @param {string} ipAddress - IP del cliente que hizo el cambio
 * @returns {Promise<{success: boolean, id?: number, error?: string}>}
 */
const registrarCambio = async (
  usuario,
  accion,
  tabla,
  idRegistro,
  valoresAnteriores = null,
  valoresNuevos = null,
  ipAddress = 'SYSTEM'
) => {
  try {
    const pool = getPool();
    
    const query = `
      INSERT INTO audit_log (usuario, accion, tabla, id_registro, valores_anteriores, valores_nuevos, ip_address, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
    `;

    // Serializar objetos a JSON
    const valoresAnterioresJSON = valoresAnteriores ? JSON.stringify(valoresAnteriores) : null;
    const valoresNuevosJSON = valoresNuevos ? JSON.stringify(valoresNuevos) : null;

    const [result] = await pool.query(query, [
      usuario,
      accion,
      tabla,
      idRegistro,
      valoresAnterioresJSON,
      valoresNuevosJSON,
      ipAddress
    ]);

    console.log(`📋 Auditoría: [${accion}] en ${tabla}#${idRegistro} por ${usuario}`);

    return {
      success: true,
      id: result.insertId
    };
  } catch (error) {
    console.error('❌ Error registrando auditoría:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Obtiene el historial de cambios para un registro específico
 * @param {string} tabla - Nombre de la tabla
 * @param {string|number} idRegistro - ID del registro
 * @returns {Promise<Array>}
 */
const obtenerHistorial = async (tabla, idRegistro) => {
  try {
    const pool = getPool();

    const query = `
      SELECT 
        id,
        usuario,
        accion,
        tabla,
        id_registro,
        JSON_UNQUOTE(valores_anteriores) as valores_anteriores,
        JSON_UNQUOTE(valores_nuevos) as valores_nuevos,
        ip_address,
        timestamp
      FROM audit_log
      WHERE tabla = ? AND id_registro = ?
      ORDER BY timestamp DESC
      LIMIT 50
    `;

    const [rows] = await pool.query(query, [tabla, idRegistro]);
    
    return rows.map(row => ({
      ...row,
      valores_anteriores: row.valores_anteriores ? JSON.parse(row.valores_anteriores) : null,
      valores_nuevos: row.valores_nuevos ? JSON.parse(row.valores_nuevos) : null
    }));
  } catch (error) {
    console.error('❌ Error obteniendo historial:', error);
    return [];
  }
};

/**
 * Obtiene el log de auditoría con filtros opcionales
 * @param {object} filtros - {usuario?, tabla?, accion?, fechaDesde?, fechaHasta?, limite}
 * @returns {Promise<Array>}
 */
const obtenerLog = async (filtros = {}) => {
  try {
    const pool = getPool();
    
    let query = `
      SELECT 
        id,
        usuario,
        accion,
        tabla,
        id_registro,
        ip_address,
        timestamp
      FROM audit_log
      WHERE 1=1
    `;

    const params = [];

    if (filtros.usuario) {
      query += ` AND usuario = ?`;
      params.push(filtros.usuario);
    }

    if (filtros.tabla) {
      query += ` AND tabla = ?`;
      params.push(filtros.tabla);
    }

    if (filtros.accion) {
      query += ` AND accion = ?`;
      params.push(filtros.accion);
    }

    if (filtros.fechaDesde) {
      query += ` AND timestamp >= ?`;
      params.push(filtros.fechaDesde);
    }

    if (filtros.fechaHasta) {
      query += ` AND timestamp <= ?`;
      params.push(filtros.fechaHasta);
    }

    query += ` ORDER BY timestamp DESC`;

    if (filtros.limite) {
      query += ` LIMIT ?`;
      params.push(filtros.limite);
    } else {
      query += ` LIMIT 100`; // Default limit
    }

    const [rows] = await pool.query(query, params);
    return rows;
  } catch (error) {
    console.error('❌ Error obteniendo log de auditoría:', error);
    return [];
  }
};

/**
 * Obtiene resumen de actividades por usuario
 * @param {string} usuario - Email del usuario
 * @param {string} dias - Últimos N días (default: 7)
 * @returns {Promise<object>}
 */
const obtenerResumenUsuario = async (usuario, dias = 7) => {
  try {
    const pool = getPool();

    const query = `
      SELECT 
        accion,
        tabla,
        COUNT(*) as cantidad
      FROM audit_log
      WHERE usuario = ? AND timestamp >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY accion, tabla
      ORDER BY cantidad DESC
    `;

    const [rows] = await pool.query(query, [usuario, dias]);
    
    return {
      usuario,
      periodo: `Últimos ${dias} días`,
      actividades: rows
    };
  } catch (error) {
    console.error('❌ Error obteniendo resumen:', error);
    return { usuario, periodo: `Últimos ${dias} días`, actividades: [] };
  }
};

/**
 * Limpia registros de auditoría antiguos (mayor a N días)
 * @param {number} dias - Eliminar logs más antiguos que N días
 * @returns {Promise<{success: boolean, eliminados?: number}>}
 */
const limpiarLogAntiguos = async (dias = 90) => {
  try {
    const pool = getPool();

    const query = `
      DELETE FROM audit_log
      WHERE timestamp < DATE_SUB(NOW(), INTERVAL ? DAY)
    `;

    const [result] = await pool.query(query, [dias]);

    console.log(`🧹 Auditoría: Limpiados ${result.affectedRows} registros antiguos (> ${dias} días)`);

    return {
      success: true,
      eliminados: result.affectedRows
    };
  } catch (error) {
    console.error('❌ Error limpiando log:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

module.exports = {
  registrarCambio,
  obtenerHistorial,
  obtenerLog,
  obtenerResumenUsuario,
  limpiarLogAntiguos
};
