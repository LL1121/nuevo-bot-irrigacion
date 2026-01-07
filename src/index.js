require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const bodyParser = require('body-parser');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');
const { initializeDB } = require('./config/db');

const app = express();
const server = http.createServer(app);

// Configurar Socket.io con CORS
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Exportar io para usar en otros módulos
global.io = io;

const PORT = process.env.PORT || 3000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Security Middlewares
// 1) Helmet for secure HTTP headers
app.use(helmet());

// 2) Strict CORS whitelist
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

// 3) Rate Limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per window
  standardHeaders: true,
  legacyHeaders: false
});

const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // limit each IP to 5 login requests per window
  message: 'Too many login attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

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
  // Inicializar base de datos antes de registrar rutas
  await initializeDB();

  // Cargar rutas después de que DB exista
  const webhookRoutes = require('./routes/webhookRoutes');
  const apiRoutes = require('./routes/apiRoutes');

  // Routes API
  // Apply rate limiting: general API limiter
  app.use('/api', apiLimiter);
  // Apply stricter limiter to login route
  app.post('/api/auth/login', authLimiter, (req, res, next) => next());

  app.use('/webhook', webhookRoutes);
  app.use('/api', apiRoutes);

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'ok',
      message: 'Bot de WhatsApp - Irrigación funcionando correctamente',
      timestamp: new Date()
    });
  });

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
    console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
    console.log(`📱 Webhook URL: http://localhost:${PORT}/webhook`);
    console.log(`🔌 Socket.io activo en puerto ${PORT}`);
    console.log(`🌐 API REST: http://localhost:${PORT}/api`);
    
    // Inicializar navegador Puppeteer (Singleton)
    console.log('');
    console.log('🌐 Inicializando navegador Puppeteer...');
    const scraperService = require('./services/scraperService');
    await scraperService.initBrowser();
    console.log('✅ Navegador listo para scraping optimizado');
  });
};

bootstrap();

module.exports = { app, io };
