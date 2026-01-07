const express = require('express');
const router = express.Router();
const apiController = require('../controllers/apiController');
const authController = require('../controllers/authController');
const { verifyToken } = require('../middleware/authMiddleware');

// Login (sin protección)
router.post('/auth/login', authController.login);

// Listar todas las conversaciones activas (protegido)
router.get('/chats', verifyToken, apiController.listarChats);

// Obtener historial de mensajes de un usuario (protegido)
router.get('/messages/:telefono', verifyToken, apiController.obtenerMensajes);

// Enviar mensaje desde el operador (protegido)
router.post('/send', verifyToken, apiController.enviarMensaje);

// Marcar conversación como leída (protegido)
router.post('/mark-read/:telefono', verifyToken, apiController.marcarLeido);

// Estadísticas del panel (protegido)
router.get('/stats', verifyToken, apiController.obtenerEstadisticas);

// Control del bot (pausar/activar) (protegido)
router.post('/chats/:phone/pause', verifyToken, apiController.pausarBot);
router.post('/chats/:phone/activate', verifyToken, apiController.activarBot);

// Proxy de media (descarga/visualización) (protegido)
router.get('/media/:mediaId', verifyToken, apiController.descargarMedia);

module.exports = router;
