require('dotenv').config({ quiet: true });
const express = require('express');
const compression = require('compression');
const jwt = require('jsonwebtoken');
// Optional Sentry for error monitoring
let Sentry;
if (process.env.SENTRY_DSN) {
  try {
    Sentry = require('@sentry/node');
    Sentry.init({ dsn: process.env.SENTRY_DSN });
    logger.info('Sentry initialized');
  } catch (err) {
    logger.warn('Could not initialize Sentry:', err.message);
  }
}
const http = require('http');
const { Server } = require('socket.io');
const bodyParser = require('body-parser');
const cors = require('cors');
const helmet = require('helmet');
const { apiLimiter, authLimiter } = require('./middlewares/rateLimiters');
const fs = require('fs');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const { initializeDB } = require('./config/db');
const { ipMiddleware } = require('./middlewares/ipMiddleware');
const requestLogger = require('./middlewares/requestLoggerMiddleware');
const { errorHandler } = require('./middlewares/errorHandler');
const swaggerSpec = require('./config/swaggerConfig');
const { initRedis } = require('./services/cacheService');
const logger = require('./services/logService');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3003;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const JWT_SECRET = process.env.JWT_SECRET;
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 30000);
const JSON_BODY_LIMIT = process.env.JSON_BODY_LIMIT || '1mb';
const WEBHOOK_BODY_LIMIT = process.env.WEBHOOK_BODY_LIMIT || '512kb';

const normalizeOrigin = (value) => {
  if (!value) return '';
  try {
    return new URL(value).origin;
  } catch {
    return String(value).trim();
  }
};

const configuredOrigins = [
  process.env.CORS_ORIGIN,
  process.env.CORS_ORIGINS,
  process.env.FRONTEND_URL,
  process.env.BASE_URL
].flatMap((value) => {
  if (!value) return [];
  return String(value)
    .split(',')
    .map((item) => normalizeOrigin(item))
    .filter(Boolean);
});

const corsOrigins = Array.from(new Set(configuredOrigins));

const isLocalOrigin = (origin) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);

const isAllowedOrigin = (origin) => {
  if (!origin) return true;

  const normalizedOrigin = normalizeOrigin(origin);
  if (isLocalOrigin(normalizedOrigin)) return true;
  if (corsOrigins.includes(normalizedOrigin)) return true;

  return false;
};

// Configurar Socket.io con CORS
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) return callback(null, true);
      return callback(new Error(`Not allowed by Socket.IO CORS: ${origin || 'no origin'}`));
    },
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Exportar io para usar en otros módulos
global.io = io;

// Security Middlewares
// 1) Helmet for secure HTTP headers
app.use(helmet());

// 2) Compression middleware - reduce response size by 3-4x
app.use(compression({
  level: 6, // Balance between speed and compression ratio
  threshold: 1024 // Only compress responses > 1KB
}));

app.use(cors({
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) return callback(null, true);
    return callback(new Error(`Not allowed by CORS: ${origin || 'no origin'}`));
  },
  credentials: true
}));

// Middleware para capturar raw body (necesario para verificar firma webhook)
app.use('/webhook', express.json({
  limit: WEBHOOK_BODY_LIMIT,
  verify: (req, res, buf) => {
    req.rawBody = buf.toString('utf8');
  }
}));

app.use(bodyParser.json({ limit: JSON_BODY_LIMIT }));
app.use(bodyParser.urlencoded({ extended: true, limit: JSON_BODY_LIMIT }));

app.use((req, res, next) => {
  res.setTimeout(REQUEST_TIMEOUT_MS, () => {
    logger.warn('Request timeout', { method: req.method, path: req.originalUrl });
    if (!res.headersSent) {
      res.status(408).json({
        success: false,
        error: 'La solicitud demoró demasiado. Intenta nuevamente.'
      });
    }
  });
  next();
});
app.use(ipMiddleware);
app.use(requestLogger);

// Servir archivos estáticos
const publicPath = path.join(__dirname, '../public');
const uploadsPath = path.join(publicPath, 'uploads');
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
}

app.use('/uploads', express.static(uploadsPath));
app.use(express.static(publicPath));

// Servir archivos estáticos del build de frontend (producción)
const frontendBuildPath = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendBuildPath));

const bootstrap = async () => {
  try {
    const webhookSecret = process.env.WEBHOOK_APP_SECRET || process.env.WHATSAPP_APP_SECRET || process.env.META_APP_SECRET;

    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET no configurado');
    }

    if (!webhookSecret) {
      throw new Error('WEBHOOK_APP_SECRET/WHATSAPP_APP_SECRET/META_APP_SECRET no configurado');
    }

    // Inicializar Redis en paralelo (no bloqueante)
    const redisPromise = initRedis().catch(() => {});

    // Inicializar base de datos (crítico)
    logger.info('Inicializando Base de Datos...');
    await initializeDB();

    // Esperar Redis solo si no tardó más de 1 segundo
    await Promise.race([
      redisPromise,
      new Promise(resolve => setTimeout(resolve, 1000))
    ]);

    // Cargar rutas después de que DB exista
    const webhookRoutes = require('./routes/webhookRoutes');
    const apiRoutes = require('./routes/apiRoutes');
    const auditRoutes = require('./routes/auditRoutes');
    const healthRoutes = require('./routes/healthRoutes');
    const cacheTestRoutes = require('./routes/cacheTestRoutes');
    const paymentBridgeRoutes = require('./routes/paymentBridgeRoutes');

  // Routes API
  // Apply rate limiting: general API limiter
  app.use('/api', apiLimiter);
  // Apply stricter limiter to login route
  app.post('/api/auth/login', authLimiter, (req, res, next) => next());

  app.use('/webhook', webhookRoutes);
  app.use('/api', apiRoutes);
  app.use('/api', auditRoutes);
  app.use('/api', healthRoutes);
  app.use('/api', cacheTestRoutes);
  app.use('/', paymentBridgeRoutes);

  // Swagger/OpenAPI Documentation
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Bot Irrigación - API Documentation'
  }));

  // Health check endpoint (deprecated - moved to healthRoutes, kept for backwards compatibility)
  // GET /api/health - Ahora manejado por healthRoutes (más completo)
  
  // Servir el frontend en producción (debe estar al final)
  app.use((req, res) => {
    // Si es una ruta de API, no servir el frontend
    if (req.path.startsWith('/api') || req.path.startsWith('/webhook')) {
      return res.status(404).json({ error: 'Ruta no encontrada' });
    }
    
    // Servir index.html del build
    const indexPath = path.join(frontendBuildPath, 'index.html');
    if (require('fs').existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).send('Frontend no encontrado. Ejecuta: cd frontend && npm run build');
    }
  });

  app.use(errorHandler);

  // Socket.io - Manejo de conexiones
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '');
      if (!token || !JWT_SECRET) {
        return next();
      }

      const decoded = jwt.verify(token, JWT_SECRET);
      socket.user = decoded;
      if (decoded?.subdelegacion_id) {
        socket.join(`zona_${decoded.subdelegacion_id}`);
      }
      if (decoded?.role === 'admin') {
        socket.join('zona_admin');
      }
      return next();
    } catch (_) {
      return next();
    }
  });

  io.on('connection', (socket) => {
    socket.on('operador_online', (data) => {
      socket.broadcast.emit('operador_disponible', data);
    });
  });

  // Start server
  server.listen(PORT, async () => {
    logger.info(`Servidor iniciado en puerto ${PORT}`);
    logger.info(`Servidor corriendo en puerto ${PORT}`);
  });
  
  // Graceful shutdown: detener backups y cerrar conexiones
  process.on('SIGINT', () => {
    logger.warn('Recibida señal SIGINT - Shutdown graceful');
    logger.info('\n\nIniciando shutdown graceful...');
    server.close(() => {
      logger.info('Servidor cerrado correctamente');
      logger.info('Servidor cerrado correctamente');
      process.exit(0);
    });
  });

  process.on('SIGTERM', () => {
    logger.warn('Recibida señal SIGTERM - Shutdown graceful');
    logger.info('\n\nIniciando shutdown graceful...');
    server.close(() => {
      logger.info('Servidor cerrado correctamente');
      logger.info('Servidor cerrado correctamente');
      process.exit(0);
    });
  });

  // Capturar excepciones no manejadas
  process.on('uncaughtException', (error) => {
    logger.exception(error, { type: 'uncaughtException' });
    logger.error('Excepcion no capturada:', error);
  });

  } catch (error) {
    logger.error('Error durante bootstrap', { error: error.message });
    logger.error('Error durante startup:', error);
    process.exit(1);
  }
};

bootstrap();

module.exports = { app, io };
