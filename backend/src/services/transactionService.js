const { run, runInTransaction } = require('../config/db');

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
 * Ejecutar una función dentro de una transacción PostgreSQL
 * Si algo falla, todo se revierte automáticamente
 * 
 * @param {Function} callback - Función que contiene las operaciones
 * @returns {Promise<any>} Resultado del callback
 * 
 * @example
 * const resultado = await withTransaction(async () => {
 *   await run('INSERT INTO mensajes ...', params);
 *   await run('UPDATE clientes SET ...', params);
 *   return { success: true };
 * });
 */
const withTransaction = async (callback) => {
  try {
    return await runInTransaction(callback);
  } catch (error) {
    console.error('Transaccion revertida (rollback):', error.message);
    throw error;
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
 *   { query: 'UPDATE clientes SET ultima_interaccion = CURRENT_TIMESTAMP WHERE telefono = ?',
 *     params: ['5491234567890'] }
 * ]);
 */
const executeTransaction = async (operations) => {
  return withTransaction(async () => {
    const results = [];

    for (const operation of operations) {
      try {
        const result = await run(operation.query, operation.params);
        results.push(result);
      } catch (error) {
        console.error(`Error en operacion transaccional: ${error.message}`);
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
    const result = await withTransaction(operation);
    return { success: true, data: result };
  } catch (error) {
    console.error(`${operationName} fallo:`, error.message);
    return { success: false, error: error.message };
  }
};

module.exports = {
  withTransaction,
  executeTransaction,
  safeTransaction
};
