require('dotenv').config();
const express = require('express');
const compression = require('compression');
// Optional Sentry for error monitoring
let Sentry;
if (process.env.SENTRY_DSN) {
  try {
    Sentry = require('@sentry/node');
    Sentry.init({ dsn: process.env.SENTRY_DSN });
    console.log('✅ Sentry initialised');
  } catch (err) {
    console.warn('⚠️ Could not initialize Sentry:', err.message);
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
const swaggerSpec = require('./config/swaggerConfig');
const { initRedis } = require('./services/cacheService');
const logger = require('./services/logService');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

const socketCorsWhitelist = [
  'http://localhost:5173',
  FRONTEND_URL
].filter(Boolean);

// Configurar Socket.io con CORS
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (socketCorsWhitelist.includes(origin)) return callback(null, true);
      return callback(new Error('Not allowed by Socket.IO CORS'));
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

// 3) Strict CORS whitelist
const corsWhitelist = [
  'http://localhost:5173',
  FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow server-to-server or CLI requests without origin
    if (!origin) return callback(null, true);
    if (corsWhitelist.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

// Middleware para capturar raw body (necesario para verificar firma webhook)
app.use('/webhook', express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString('utf8');
  }
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
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
const frontendBuildPath = path.join(__dirname, '../Frontend/dist');
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
    const redisPromise = initRedis().catch(() => {
      console.log('⚠️ Redis no disponible - continuando sin cache');
    });

    // Inicializar base de datos (crítico)
    logger.info('Inicializando Base de Datos...');
    await initializeDB();
    console.log('✅ Base de datos inicializada correctamente');

    // Esperar Redis solo si no tardó más de 1 segundo
    await Promise.race([
      redisPromise,
      new Promise(resolve => setTimeout(resolve, 1000))
    ]);

    // Cargar rutas después de que DB exista
    console.log('📄 Cargando rutas...');
    const webhookRoutes = require('./routes/webhookRoutes');
    console.log('✅ Rutas de webhook cargadas');
    const apiRoutes = require('./routes/apiRoutes');
    console.log('✅ Rutas de API cargadas');
    const auditRoutes = require('./routes/auditRoutes');
    console.log('✅ Rutas de auditoría cargadas');
    const healthRoutes = require('./routes/healthRoutes');
    console.log('✅ Rutas de health cargadas');
    const cacheTestRoutes = require('./routes/cacheTestRoutes');
    console.log('✅ Rutas de cache test cargadas');
    const paymentBridgeRoutes = require('./routes/paymentBridgeRoutes');
    console.log('✅ Rutas de pasarela de pagos cargadas');

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
      res.status(404).send('Frontend no encontrado. Ejecuta: cd Frontend && npm run build');
    }
  });

  // Socket.io - Manejo de conexiones
  io.on('connection', (socket) => {
    console.log('👤 Cliente conectado:', socket.id);

    socket.on('disconnect', () => {
      console.log('👋 Cliente desconectado:', socket.id);
    });

    socket.on('operador_online', (data) => {
      console.log('🟢 Operador online:', data);
      socket.broadcast.emit('operador_disponible', data);
    });
  });

  // Start server
  server.listen(PORT, async () => {
    const publicBaseUrl = (
      process.env.BASE_URL
      || process.env.PUBLIC_BASE_URL
      || process.env.BACKEND_URL
      || `http://localhost:${PORT}`
    ).replace(/\/$/, '');

    logger.info(`Servidor iniciado en puerto ${PORT}`, {
      webhook: `${publicBaseUrl}/webhook`,
      api: `${publicBaseUrl}/api`,
      docs: `${publicBaseUrl}/api-docs`
    });
    console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
    console.log(`📱 Webhook URL: ${publicBaseUrl}/webhook`);
    console.log(`🔌 Socket.io activo en puerto ${PORT}`);
    console.log(`🌐 API REST: ${publicBaseUrl}/api`);
    console.log(`📚 Documentación: ${publicBaseUrl}/api-docs`);
    console.log('✅ Sistema de scraping listo');
  });
  
  // Graceful shutdown: detener backups y cerrar conexiones
  process.on('SIGINT', () => {
    logger.warn('Recibida señal SIGINT - Shutdown graceful');
    console.log('\n\n🛑 Iniciando shutdown graceful...');
    server.close(() => {
      logger.info('Servidor cerrado correctamente');
      console.log('✅ Servidor cerrado correctamente');
      process.exit(0);
    });
  });

  process.on('SIGTERM', () => {
    logger.warn('Recibida señal SIGTERM - Shutdown graceful');
    console.log('\n\n🛑 Iniciando shutdown graceful...');
    server.close(() => {
      logger.info('Servidor cerrado correctamente');
      console.log('✅ Servidor cerrado correctamente');
      process.exit(0);
    });
  });

  // Capturar excepciones no manejadas
  process.on('uncaughtException', (error) => {
    logger.exception(error, { type: 'uncaughtException' });
    console.error('❌ Excepción no capturada:', error);
  });

  } catch (error) {
    logger.error('Error durante bootstrap', { error: error.message });
    console.error('❌ Error durante startup:', error);
    process.exit(1);
  }
};

bootstrap();

module.exports = { app, io };
