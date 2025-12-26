const pool = require('../config/db');

/**
 * Obtener DNI asociado al teléfono
 */
const getDni = async (phone) => {
  try {
    const [rows] = await pool.execute(
      'SELECT dni FROM usuarios WHERE telefono = ?',
      [phone]
    );
    
    return rows.length > 0 ? rows[0].dni : null;
  } catch (error) {
    console.error('❌ Error al obtener DNI:', error);
    throw error;
  }
};

/**
 * Guardar o actualizar DNI del usuario (Upsert)
 */
const saveDni = async (phone, dni) => {
  try {
    await pool.execute(
      `INSERT INTO usuarios (telefono, dni, last_update) 
       VALUES (?, ?, NOW()) 
       ON DUPLICATE KEY UPDATE dni = ?, last_update = NOW()`,
      [phone, dni, dni]
    );
    
    console.log(`✅ DNI ${dni} vinculado a ${phone}`);
    return true;
  } catch (error) {
    console.error('❌ Error al guardar DNI:', error);
    throw error;
  }
};

/**
 * Eliminar vinculación de DNI
 */
const deleteDni = async (phone) => {
  try {
    await pool.execute(
      'DELETE FROM usuarios WHERE telefono = ?',
      [phone]
    );
    
    console.log(`🗑️ DNI desvinculado de ${phone}`);
    return true;
  } catch (error) {
    console.error('❌ Error al eliminar DNI:', error);
    throw error;
  }
};

module.exports = {
  getDni,
  saveDni,
  deleteDni
};
