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
      socket: {
        host,
        port,
        connectTimeout: 3000
      },
      password,
      legacyMode: false,
      disableOfflineQueue: true
    });

    // Manejador de error temporal para timeout
    const errorHandler = (error) => {
      // Solo loggear errores críticos
    };
    
    redisClient.once('error', errorHandler);

    // Conectar con timeout más agresivo
    try {
      await Promise.race([
        redisClient.connect(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000))
      ]);
      
      // Si conectó, remover handler temporal
      redisClient.removeListener('error', errorHandler);
      
      // Agregar handler permanente
      redisClient.on('error', (error) => {
        console.warn('⚠️ Error en Redis (runtime):', error.message);
      });
      
      console.log(`✅ Redis inicializado en ${host}:${port}`);
    } catch (err) {
      // Conexión falló
      redisClient.removeListener('error', errorHandler);
      redisClient = null;
      console.warn(`⚠️ No se pudo conectar a Redis en ${host}:${port}`);
      console.warn('💡 Para activar: docker run -d -p 6379:6379 redis:latest');
      console.warn('⚠️ Continuando sin cache (modo degradado)');
    }
  } catch (error) {
    console.warn('⚠️ Error inicializando Redis:', error.message);
    redisClient = null;
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
    if (!redisClient || !redisClient.isReady) return false;

    const serialized = JSON.stringify(value);
    if (ttl) {
      await redisClient.setEx(key, ttl, serialized);
    } else {
      await redisClient.set(key, serialized);
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
    if (!redisClient || !redisClient.isReady) return null;

    const value = await redisClient.get(key);
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
    if (!redisClient || !redisClient.isReady) return false;

    await redisClient.del(key);
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
    if (!redisClient || !redisClient.isReady) return false;

    await redisClient.flushAll();
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
    if (!redisClient || !redisClient.isReady) return false;

    const exists = await redisClient.exists(key);
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
    if (!redisClient || !redisClient.isReady) return -2;

    return await redisClient.ttl(key);
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
