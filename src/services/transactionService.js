const { getDB, run } = require('../config/db');

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
 * Ejecutar una función dentro de una transacción SQLite
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
  const db = getDB();

  return new Promise((resolve, reject) => {
    // SQLite3 no maneja transacciones con async/await directamente
    // Así que lo hacemos con callbacks
    db.serialize(() => {
      // Iniciar transacción
      db.run('BEGIN TRANSACTION', async (err) => {
        if (err) {
          console.error('❌ Error iniciando transacción:', err);
          return reject(err);
        }

        console.log('🔄 INICIANDO TRANSACCIÓN');

        try {
          // Ejecutar operaciones del callback
          const result = await callback();

          // Si llegó acá sin errores, confirmar todo
          db.run('COMMIT', (commitErr) => {
            if (commitErr) {
              console.error('❌ Error en COMMIT:', commitErr);
              return reject(commitErr);
            }
            console.log('✅ TRANSACCIÓN COMPLETADA (COMMIT)');
            resolve(result);
          });
        } catch (error) {
          // Si falla algo, revertir TODO
          console.error('⏮️  Error en transacción:', error.message);
          db.run('ROLLBACK', (rollbackErr) => {
            if (rollbackErr) {
              console.error('❌ Error durante ROLLBACK:', rollbackErr);
            } else {
              console.error('⏮️  TRANSACCIÓN REVERTIDA (ROLLBACK)');
            }
            reject(error);
          });
        }
      });
    });
  });
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
        console.log(`   ▶ Ejecutando: ${operation.query.substring(0, 50)}...`);
        const result = await run(operation.query, operation.params);
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
