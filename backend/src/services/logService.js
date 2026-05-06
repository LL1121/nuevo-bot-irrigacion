const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
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
const scriptErrorsDir = path.join(logsDir, 'errors');
if (!fs.existsSync(scriptErrorsDir)) {
  fs.mkdirSync(scriptErrorsDir, { recursive: true });
}
const SCRIPT_ERRORS_RETENTION_DAYS = Number(process.env.SCRIPT_ERRORS_RETENTION_DAYS || 30);
let lastScriptErrorsCleanup = 0;

/**
 * Configuración de transports (salidas) de Winston
 */
const transports = [
  // ERROR: Solo errores en archivo separado
  new DailyRotateFile({
    filename: path.join(logsDir, 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD-HH',
    level: 'error',
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.json()
    ),
    maxSize: '5m',
    maxFiles: '30d'
  }),

  // COMBINADO: Todos los niveles en un archivo principal
  new DailyRotateFile({
    filename: path.join(logsDir, 'combined-%DATE%.log'),
    datePattern: 'YYYY-MM-DD-HH',
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.json()
    ),
    maxSize: '5m',
    maxFiles: '60d'
  }),

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

const appendScriptError = (scriptName, message, metadata = {}) => {
  try {
    const nowMs = Date.now();
    if (nowMs - lastScriptErrorsCleanup > 60 * 60 * 1000) {
      lastScriptErrorsCleanup = nowMs;
      const keepMs = Math.max(1, SCRIPT_ERRORS_RETENTION_DAYS) * 24 * 60 * 60 * 1000;
      fs.readdir(scriptErrorsDir, (err, files) => {
        if (err || !Array.isArray(files)) return;
        files.forEach((fileName) => {
          const filePath = path.join(scriptErrorsDir, fileName);
          fs.stat(filePath, (statErr, stat) => {
            if (statErr || !stat.isFile()) return;
            if (nowMs - stat.mtimeMs > keepMs) {
              fs.unlink(filePath, () => {});
            }
          });
        });
      });
    }

    const safeName = String(scriptName || 'unknown')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, 100);
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const target = path.join(scriptErrorsDir, `${safeName}-${yyyy}-${mm}-${dd}-${hh}.log`);
    const line = JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'error',
      message,
      ...metadata
    }) + '\n';
    fs.appendFile(target, line, () => {});
  } catch (_) {
    // ignore file append failures
  }
};

const extractCallerScriptFromStack = (stack = '') => {
  const lines = String(stack || '').split('\n');
  for (const raw of lines) {
    const line = raw.trim();
    const match = line.match(/\((.*?):\d+:\d+\)$/) || line.match(/at (.*?):\d+:\d+$/);
    if (!match) continue;
    const filePath = match[1];
    if (!filePath || filePath.includes('logService.js') || filePath.includes('node:internal')) continue;
    return path.basename(filePath, path.extname(filePath));
  }
  return 'unknown';
};

let consoleErrorPatched = false;
const patchConsoleErrorToFile = () => {
  if (consoleErrorPatched) return;
  consoleErrorPatched = true;
  const originalError = console.error.bind(console);
  console.error = (...args) => {
    try {
      const rendered = args.map((a) => {
        if (a instanceof Error) return `${a.message}\n${a.stack || ''}`.trim();
        if (typeof a === 'string') return a;
        try { return JSON.stringify(a); } catch { return String(a); }
      }).join(' ');
      const stack = new Error().stack || '';
      const script = extractCallerScriptFromStack(stack);
      appendScriptError(script, rendered);
      logger.error(rendered, { script });
    } catch (_) {
      // fallback to original only if logger path fails unexpectedly
      originalError(...args);
    }
  };
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
  appendScriptError(metadata.script || 'app', message, metadata);
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

patchConsoleErrorToFile();

module.exports = {
  error,
  warn,
  info,
  debug,
  http,
  audit,
  performance,
  exception,
  getLogger,
  patchConsoleErrorToFile
};
