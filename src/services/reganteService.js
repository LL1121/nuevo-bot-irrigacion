const pool = require('../config/db');

/**
 * Busca un regante por número de padrón
 * @param {string} padron - Número de padrón a buscar
 * @returns {Object|null} Datos del regante o null si no existe
 */
const getReganteByPadron = async (padron) => {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM regantes WHERE padron = ?',
      [padron]
    );

    if (rows.length === 0) {
      console.log(`⚠️ Padrón ${padron} no encontrado en la base de datos`);
      return null;
    }

    const regante = rows[0];
    console.log(`✅ Regante encontrado: ${regante.nombre} (Padrón: ${padron})`);
    
    return {
      padron: regante.padron,
      nombre: regante.nombre,
      deuda: regante.deuda || 0,
      estado: regante.estado || 'Activo',
      turno: regante.turno || 'No asignado',
      hectareas: regante.hectareas || 0,
      cultivo: regante.cultivo || 'No especificado'
    };
  } catch (error) {
    console.error('❌ Error consultando regante:', error);
    throw error;
  }
};

/**
 * Actualiza la deuda de un regante
 * @param {string} padron - Número de padrón
 * @param {number} nuevaDeuda - Nueva deuda a establecer
 * @returns {boolean} True si se actualizó correctamente
 */
const actualizarDeuda = async (padron, nuevaDeuda) => {
  try {
    const [result] = await pool.execute(
      'UPDATE regantes SET deuda = ? WHERE padron = ?',
      [nuevaDeuda, padron]
    );

    if (result.affectedRows === 0) {
      console.log(`⚠️ No se pudo actualizar el padrón ${padron}`);
      return false;
    }

    console.log(`✅ Deuda actualizada para padrón ${padron}: $${nuevaDeuda}`);
    return true;
  } catch (error) {
    console.error('❌ Error actualizando deuda:', error);
    throw error;
  }
};

module.exports = {
  getReganteByPadron,
  actualizarDeuda
};
