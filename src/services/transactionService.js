const { getPool } = require('../config/db');

/**
 * Servicio de Transacciones - Garantiza ACID en operaciones críticas
 * 
 * ACID:
 * - Atomicity: Todo se ejecuta o nada (no hay estados intermedios)
 * - Consistency: BD siempre en estado válido
 * - Isolation: Transacciones no se interfieren
 * - Durability: Si se commiteó, persiste siempre
 */

/**
 * Ejecutar una función dentro de una transacción
 * Si algo falla, todo se revierte automáticamente
 * 
 * @param {Function} callback - Función que contiene las operaciones
 * @returns {Promise<any>} Resultado del callback
 * 
 * @example
 * const resultado = await withTransaction(async (connection) => {
 *   await connection.execute('INSERT INTO mensajes ...');
 *   await connection.execute('UPDATE clientes SET ...');
 *   return { success: true };
 * });
 */
const withTransaction = async (callback) => {
  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    console.log('🔄 INICIANDO TRANSACCIÓN');
    
    // Comenzar transacción
    await connection.beginTransaction();

    // Ejecutar operaciones
    const result = await callback(connection);

    // Si llegó acá, confirmar todo
    await connection.commit();
    console.log('✅ TRANSACCIÓN COMPLETADA (COMMIT)');

    return result;
  } catch (error) {
    // Si falla algo, revertir TODO
    try {
      await connection.rollback();
      console.error('⏮️  TRANSACCIÓN REVERTIDA (ROLLBACK):', error.message);
    } catch (rollbackError) {
      console.error('❌ Error durante rollback:', rollbackError.message);
    }
    
    // Re-throw el error original
    throw error;
  } finally {
    // Liberar la conexión siempre
    connection.release();
  }
};

/**
 * Ejecutar múltiples queries en una transacción
 * Forma simplificada para casos comunes
 * 
 * @param {Array<{query: string, params: Array}>} operations - Operaciones a ejecutar
 * @returns {Promise<Array>} Resultados de cada query
 * 
 * @example
 * await executeTransaction([
 *   { query: 'INSERT INTO mensajes (cliente_telefono, cuerpo) VALUES (?, ?)', 
 *     params: ['5491234567890', 'Hola'] },
 *   { query: 'UPDATE clientes SET ultima_interaccion = NOW() WHERE telefono = ?',
 *     params: ['5491234567890'] }
 * ]);
 */
const executeTransaction = async (operations) => {
  return withTransaction(async (connection) => {
    const results = [];

    for (const operation of operations) {
      try {
        console.log(`   ▶ Ejecutando: ${operation.query.substring(0, 50)}...`);
        const result = await connection.execute(operation.query, operation.params);
        results.push(result);
      } catch (error) {
        console.error(`   ❌ Error en operación: ${error.message}`);
        throw error; // Trigger rollback
      }
    }

    return results;
  });
};

/**
 * Wrapper para operaciones que requieren rollback automático
 * Útil para cuando querés más control sobre errores
 * 
 * @param {Function} operation - Función con lógica
 * @param {string} operationName - Nombre para logging
 * @returns {Promise<{success: boolean, data?: any, error?: string}>}
 */
const safeTransaction = async (operation, operationName = 'Operación') => {
  try {
    console.log(`🔐 Iniciando transacción segura: ${operationName}`);
    const result = await withTransaction(operation);
    console.log(`✅ ${operationName} completada exitosamente`);
    return { success: true, data: result };
  } catch (error) {
    console.error(`❌ ${operationName} falló:`, error.message);
    return { success: false, error: error.message };
  }
};

module.exports = {
  withTransaction,
  executeTransaction,
  safeTransaction
};
