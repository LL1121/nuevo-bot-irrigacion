const redis = require('redis');

/**
 * Servicio de Redis Caching
 * Ultra-rápido almacén en memoria para cache de clientes, DNI, búsquedas
 * Performance: ~1ms vs ~50ms en BD = 50x más rápido
 */

let redisClient = null;

/**
 * Inicializar conexión a Redis
 * @param {object} options - Opciones de conexión
 * @returns {Promise<void>}
 */
const initRedis = async (options = {}) => {
  try {
    const host = process.env.REDIS_HOST || 'localhost';
    const port = process.env.REDIS_PORT || 6379;
    const password = process.env.REDIS_PASSWORD || undefined;

    redisClient = redis.createClient({
      host,
      port,
      password,
      retry_strategy: (options) => {
        if (options.error && options.error.code === 'ECONNREFUSED') {
          console.warn('⚠️ Redis no disponible - funcionando sin cache');
          return new Error('Redis server refused the connection');
        }
        if (options.total_retry_time > 1000 * 60 * 60) {
          return new Error('Retry time exhausted');
        }
        return Math.min(options.attempt * 100, 3000);
      }
    });

    redisClient.on('error', (error) => {
      console.warn('⚠️ Error en Redis:', error.message);
    });

    redisClient.on('connect', () => {
      console.log('✅ Conectado a Redis');
    });

    // Promisify para usar async/await
    const { promisify } = require('util');
    redisClient.getAsync = promisify(redisClient.get).bind(redisClient);
    redisClient.setAsync = promisify(redisClient.set).bind(redisClient);
    redisClient.delAsync = promisify(redisClient.del).bind(redisClient);
    redisClient.existsAsync = promisify(redisClient.exists).bind(redisClient);
    redisClient.expireAsync = promisify(redisClient.expire).bind(redisClient);
    redisClient.ttlAsync = promisify(redisClient.ttl).bind(redisClient);
    redisClient.flushAsync = promisify(redisClient.flushall).bind(redisClient);
  } catch (error) {
    console.warn('⚠️ No se pudo inicializar Redis:', error.message);
  }
};

/**
 * Obtener cliente Redis
 * @returns {object}
 */
const getRedis = () => {
  if (!redisClient) {
    console.warn('⚠️ Redis no inicializado');
    return null;
  }
  return redisClient;
};

/**
 * Guardar valor en cache con TTL (time to live)
 * @param {string} key - Clave del cache
 * @param {any} value - Valor (se serializa a JSON automáticamente)
 * @param {number} ttl - Tiempo de vida en segundos (default: 3600 = 1 hora)
 * @returns {Promise<boolean>}
 */
const cacheSet = async (key, value, ttl = 3600) => {
  try {
    if (!redisClient) return false;

    const serialized = JSON.stringify(value);
    if (ttl) {
      await redisClient.setAsync(key, serialized, 'EX', ttl);
    } else {
      await redisClient.setAsync(key, serialized);
    }

    console.log(`💾 Cache SET: ${key} (TTL: ${ttl}s)`);
    return true;
  } catch (error) {
    console.warn('⚠️ Error en cacheSet:', error.message);
    return false;
  }
};

/**
 * Obtener valor del cache
 * @param {string} key - Clave del cache
 * @returns {Promise<any|null>}
 */
const cacheGet = async (key) => {
  try {
    if (!redisClient) return null;

    const value = await redisClient.getAsync(key);
    if (!value) return null;

    console.log(`📖 Cache HIT: ${key}`);
    return JSON.parse(value);
  } catch (error) {
    console.warn('⚠️ Error en cacheGet:', error.message);
    return null;
  }
};

/**
 * Eliminar clave del cache
 * @param {string} key - Clave a eliminar
 * @returns {Promise<boolean>}
 */
const cacheDel = async (key) => {
  try {
    if (!redisClient) return false;

    await redisClient.delAsync(key);
    console.log(`🗑️  Cache DELETE: ${key}`);
    return true;
  } catch (error) {
    console.warn('⚠️ Error en cacheDel:', error.message);
    return false;
  }
};

/**
 * Limpiar todo el cache
 * @returns {Promise<boolean>}
 */
const cacheFlush = async () => {
  try {
    if (!redisClient) return false;

    await redisClient.flushAsync();
    console.log('🧹 Cache FLUSHED - Todo limpio');
    return true;
  } catch (error) {
    console.warn('⚠️ Error en cacheFlush:', error.message);
    return false;
  }
};

/**
 * Verificar si existe una clave
 * @param {string} key - Clave a verificar
 * @returns {Promise<boolean>}
 */
const cacheExists = async (key) => {
  try {
    if (!redisClient) return false;

    const exists = await redisClient.existsAsync(key);
    return exists === 1;
  } catch (error) {
    console.warn('⚠️ Error en cacheExists:', error.message);
    return false;
  }
};

/**
 * Obtener TTL restante de una clave
 * @param {string} key - Clave
 * @returns {Promise<number>} Segundos restantes (-1 sin expiry, -2 no existe)
 */
const cacheTTL = async (key) => {
  try {
    if (!redisClient) return -2;

    return await redisClient.ttlAsync(key);
  } catch (error) {
    console.warn('⚠️ Error en cacheTTL:', error.message);
    return -2;
  }
};

/**
 * Patrón de cache-aside (lazy loading)
 * Obtener del cache, si no existe, cargar de BD y cachear
 * @param {string} key - Clave del cache
 * @param {Function} loader - Función que carga desde BD
 * @param {number} ttl - TTL en segundos
 * @returns {Promise<any>}
 */
const cacheAside = async (key, loader, ttl = 3600) => {
  try {
    // Intentar obtener del cache
    let data = await cacheGet(key);
    if (data) {
      console.log(`⚡ Cache-aside HIT: ${key}`);
      return data;
    }

    // No existe en cache - cargar de BD
    console.log(`⚡ Cache-aside MISS: ${key} - Cargando de BD...`);
    data = await loader();

    // Guardar en cache para próxima vez
    if (data) {
      await cacheSet(key, data, ttl);
    }

    return data;
  } catch (error) {
    console.warn('⚠️ Error en cacheAside:', error.message);
    return await loader(); // Fallback a BD si falla cache
  }
};

module.exports = {
  initRedis,
  getRedis,
  cacheSet,
  cacheGet,
  cacheDel,
  cacheFlush,
  cacheExists,
  cacheTTL,
  cacheAside
};
