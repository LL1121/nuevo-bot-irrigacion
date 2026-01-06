const express = require('express');
const router = express.Router();
const apiController = require('../controllers/apiController');

// Listar todas las conversaciones activas
router.get('/chats', apiController.listarChats);

// Obtener historial de mensajes de un usuario
router.get('/messages/:telefono', apiController.obtenerMensajes);

// Enviar mensaje desde el operador
router.post('/send', apiController.enviarMensaje);

// Marcar conversación como leída
router.post('/mark-read/:telefono', apiController.marcarLeido);

// Estadísticas del panel
router.get('/stats', apiController.obtenerEstadisticas);

// Control del bot (pausar/activar)
router.post('/chats/:phone/pause', apiController.pausarBot);
router.post('/chats/:phone/activate', apiController.activarBot);

module.exports = router;
