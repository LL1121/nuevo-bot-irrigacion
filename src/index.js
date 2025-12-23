require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const webhookRoutes = require('./routes/webhookRoutes');
const apiRoutes = require('./routes/apiRoutes');

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

// Middlewares
app.use(cors({
  origin: [FRONTEND_URL, 'http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Servir archivos estáticos del build de frontend (producción)
const frontendBuildPath = path.join(__dirname, '../Frontend/dist');
app.use(express.static(frontendBuildPath));

// Routes API
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
app.get('*', (req, res) => {
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
server.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`📱 Webhook URL: http://localhost:${PORT}/webhook`);
  console.log(`🔌 Socket.io activo en puerto ${PORT}`);
  console.log(`🌐 API REST: http://localhost:${PORT}/api`);
});

module.exports = { app, io };
