const { getPool } = require('../config/db');

/**
 * Obtener DNI asociado al teléfono
 */
const getDni = async (phone) => {
  try {
    const pool = getPool();
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
    const pool = getPool();
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
    const pool = getPool();
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

/**
 * Obtener el modo del bot para un usuario
 */
const getBotMode = async (phone) => {
  try {
    const [rows] = await pool.execute(
      'SELECT bot_mode FROM usuarios WHERE telefono = ?',
      [phone]
    );
    
    return rows.length > 0 ? rows[0].bot_mode : 'active';
  } catch (error) {
    console.error('❌ Error al obtener bot_mode:', error);
    return 'active'; // Por defecto activo si hay error
  }
};

/**
 * Cambiar modo del bot para un usuario
 */
const setBotMode = async (phone, mode) => {
  try {
    // Si el usuario no existe, crearlo con modo pausado
    await pool.execute(
      `INSERT INTO usuarios (telefono, dni, bot_mode, last_update) 
       VALUES (?, 'PENDIENTE', ?, NOW()) 
       ON DUPLICATE KEY UPDATE bot_mode = ?, last_update = NOW()`,
      [phone, mode, mode]
    );
    
    console.log(`✅ Bot mode cambiado a "${mode}" para ${phone}`);
    return true;
  } catch (error) {
    console.error('❌ Error al cambiar bot_mode:', error);
    throw error;
  }
};

module.exports = {
  getDni,
  saveDni,
  deleteDni,
  getBotMode,
  setBotMode
};
