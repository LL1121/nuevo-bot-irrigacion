const winston = require('winston');
const path = require('path');
const fs = require('fs');

/**
 * Servicio de Logging Centralizado
 * Guardar logs en archivos rotados diariamente con níveis: error, warn, info, debug
 */

// Crear directorio de logs si no existe
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * Configuración de transports (salidas) de Winston
 */
const transports = [
  // ERROR: Solo errores en archivo separado
  new winston.transports.File({
    filename: path.join(logsDir, 'error.log'),
    level: 'error',
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.json()
    ),
    maxsize: 5242880, // 5MB
    maxFiles: 30 // 30 días
  }),

  // COMBINADO: Todos los niveles en un archivo principal
  new winston.transports.File({
    filename: path.join(logsDir, 'combined.log'),
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.json()
    ),
    maxsize: 5242880, // 5MB
    maxFiles: 60 // 60 días
  }),

  // CONSOLE: Salida a terminal (solo en desarrollo)
  ...(process.env.NODE_ENV !== 'production' ? [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...metadata }) => {
          let meta = '';
          if (Object.keys(metadata).length > 0) {
            meta = ` ${JSON.stringify(metadata)}`;
          }
          return `${timestamp} [${level}]: ${message}${meta}`;
        })
      )
    })
  ] : [])
];

/**
 * Crear instancia de logger
 */
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'bot-irrigacion' },
  transports
});

/**
 * Async logging buffer para evitar bloqueos de I/O
 * Agrupa logs y escribe en batch cada 100ms o 50 logs
 */
const logBuffer = {
  queue: [],
  flushScheduled: false,
  
  add(level, message, metadata) {
    this.queue.push({ level, message, metadata, timestamp: new Date() });
    
    // Flush si acumulamos 50 logs o si es un error crítico
    if (this.queue.length >= 50 || level === 'error') {
      this.flush();
    } else if (!this.flushScheduled) {
      // Schedule flush para los próximos 100ms
      this.flushScheduled = true;
      setImmediate(() => {
        this.flush();
        this.flushScheduled = false;
      });
    }
  },
  
  flush() {
    if (this.queue.length === 0) return;
    
    const logsToWrite = this.queue.splice(0);
    
    // Escribir logs de forma asincrónica sin bloquear
    setImmediate(() => {
      logsToWrite.forEach(({ level, message, metadata }) => {
        logger.log(level, message, metadata);
      });
    });
  }
};

// Flush remaining logs on exit
process.on('exit', () => {
  logBuffer.flush();
});

/**
 * ERROR - Errores críticos que requieren atención inmediata
 * @param {string} message - Mensaje de error
 * @param {object} metadata - Datos adicionales (usuario, telefono, etc)
 */
const error = (message, metadata = {}) => {
  logBuffer.add('error', message, metadata);
};

/**
 * WARN - Advertencias, comportamientos inesperados pero no críticos
 * @param {string} message - Mensaje de advertencia
 * @param {object} metadata - Datos adicionales
 */
const warn = (message, metadata = {}) => {
  logBuffer.add('warn', message, metadata);
};

/**
 * INFO - Información general sobre operaciones normales
 * @param {string} message - Mensaje informativo
 * @param {object} metadata - Datos adicionales
 */
const info = (message, metadata = {}) => {
  logBuffer.add('info', message, metadata);
};

/**
 * DEBUG - Información detallada para debugging
 * @param {string} message - Mensaje de debug
 * @param {object} metadata - Datos adicionales
 */
const debug = (message, metadata = {}) => {
  logger.debug(message, metadata);
};

/**
 * HTTP - Registrar requests/responses HTTP
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {number} latency - Tiempo en ms que tardó
 */
const http = (req, res, latency) => {
  logger.info('HTTP Request', {
    method: req.method,
    path: req.path,
    status: res.statusCode,
    latency: `${latency}ms`,
    ip: req.clientIp || req.ip,
    user: req.user?.email || 'anonymous'
  });
};

/**
 * AUDIT - Log de auditoría (cambios en BD)
 * @param {string} usuario - Usuario que hizo el cambio
 * @param {string} accion - INSERT, UPDATE, DELETE
 * @param {string} tabla - Tabla afectada
 * @param {string} idRegistro - ID del registro
 * @param {object} valores - Valores anteriores/nuevos
 */
const audit = (usuario, accion, tabla, idRegistro, valores = {}) => {
  logger.info('Audit Log', {
    usuario,
    accion,
    tabla,
    idRegistro,
    valores
  });
};

/**
 * PERFORMANCE - Registrar operaciones lentas
 * @param {string} operacion - Nombre de la operación
 * @param {number} latency - Latencia en ms
 * @param {boolean} warn - Si es warning (true) o info (false)
 */
const performance = (operacion, latency, warn = false) => {
  const fn = warn && latency > 100 ? logger.warn : logger.info;
  fn('Performance Metric', {
    operacion,
    latency: `${latency}ms`,
    slow: latency > 100
  });
};

/**
 * EXCEPTION - Log de excepciones no capturadas
 * @param {Error} error - Error object
 * @param {object} context - Contexto donde pasó
 */
const exception = (error, context = {}) => {
  logger.error('Uncaught Exception', {
    error: error.message,
    stack: error.stack,
    context
  });
};

/**
 * Obtener logger bruto para usar directamente si es necesario
 */
const getLogger = () => {
  return logger;
};

module.exports = {
  error,
  warn,
  info,
  debug,
  http,
  audit,
  performance,
  exception,
  getLogger
};
