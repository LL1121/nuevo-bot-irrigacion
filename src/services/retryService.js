/**
 * Servicio de reintentos con backoff exponencial para llamadas a APIs externas
 */

/**
 * Ejecuta una función con reintentos y backoff exponencial
 * @param {Function} fn - Función async a ejecutar
 * @param {Object} options - Opciones de configuración
 * @param {number} options.maxRetries - Número máximo de reintentos (default: 3)
 * @param {number} options.initialDelay - Delay inicial en ms (default: 1000)
 * @param {number} options.maxDelay - Delay máximo en ms (default: 10000)
 * @param {Array<number>} options.retryableStatusCodes - Códigos HTTP a reintentar (default: [429, 500, 502, 503, 504])
 * @param {Function} options.onRetry - Callback ejecutado antes de cada reintento
 * @returns {Promise<any>} Resultado de la función
 */
async function withRetry(fn, options = {}) {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    retryableStatusCodes = [429, 500, 502, 503, 504],
    onRetry = null
  } = options;

  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // No reintentar si es el último intento
      if (attempt === maxRetries) {
        break;
      }

      // Verificar si el error es reintentable
      const statusCode = error.response?.status;
      const isRetryable = 
        !statusCode || // Error de red/timeout
        retryableStatusCodes.includes(statusCode);

      if (!isRetryable) {
        console.log(`❌ Error no reintentable (status ${statusCode}), abortando reintentos`);
        break;
      }

      // Calcular delay con backoff exponencial
      const delay = Math.min(initialDelay * Math.pow(2, attempt), maxDelay);
      
      console.log(`⏳ Reintento ${attempt + 1}/${maxRetries} en ${delay}ms... (status: ${statusCode || 'network error'})`);
      
      // Callback antes de reintentar
      if (onRetry) {
        await onRetry(attempt + 1, delay, error);
      }

      // Esperar antes del siguiente intento
      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Helper para esperar un tiempo determinado
 * @param {number} ms - Milisegundos a esperar
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Wrapper específico para llamadas a WhatsApp API con reintentos
 * @param {Function} fn - Función async que hace la llamada a WhatsApp
 * @param {string} operationName - Nombre de la operación para logging
 * @returns {Promise<any>}
 */
async function withWhatsAppRetry(fn, operationName = 'WhatsApp API call') {
  return withRetry(fn, {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 8000,
    retryableStatusCodes: [429, 500, 502, 503, 504],
    onRetry: (attempt, delay, error) => {
      const statusCode = error.response?.status;
      const message = error.response?.data?.error?.message || error.message;
      console.log(`🔄 Reintentando ${operationName} - Intento ${attempt}/3 - Status: ${statusCode} - Error: ${message}`);
    }
  });
}

module.exports = {
  withRetry,
  withWhatsAppRetry,
  sleep
};
