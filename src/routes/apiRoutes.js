const express = require('express');
const router = express.Router();
const apiController = require('../controllers/apiController');
const chatController = require('../controllers/chatController');
const authController = require('../controllers/authController');
const { verifyToken } = require('../middlewares/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: "Autenticación de operador"
 *     tags: [Autenticación]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *                 example: admin
 *               password:
 *                 type: string
 *                 example: "MiPassword123!"
 *     responses:
 *       200:
 *         description: "Login exitoso, retorna JWT"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 token:
 *                   type: string
 *                   description: "JWT para incluir en Authorization header"
 *                 user:
 *                   type: object
 *       401:
 *         description: "Credenciales inválidas"
 */
// Login (sin protección)
router.post('/auth/login', authController.login);

/**
 * @swagger
 * /api/chats:
 *   get:
 *     summary: "Obtener todas las conversaciones activas"
 *     tags: [Mensajes]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: "Lista de chats activos"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 chats:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Cliente'
 *       401:
 *         description: "No autenticado"
 */
router.get('/chats', verifyToken, apiController.listarChats);

/**
 * @swagger
 * /api/messages/{telefono}:
 *   get:
 *     summary: "Obtener historial de mensajes de un cliente"
 *     tags: [Mensajes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: telefono
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: "Número de teléfono WhatsApp"
 *     responses:
 *       200:
 *         description: "Historial de mensajes"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 mensajes:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Mensaje'
 */
// Obtener historial de mensajes de un usuario (protegido)
router.get('/messages/:telefono', verifyToken, apiController.obtenerMensajes);

/**
 * @swagger
 * /api/send:
 *   post:
 *     summary: "Enviar mensaje desde el operador al cliente"
 *     tags: [Mensajes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               telefono:
 *                 type: string
 *                 example: "5491234567890"
 *               texto:
 *                 type: string
 *                 example: "Hola, ¿cómo estás?"
 *               url_archivo:
 *                 type: string
 *                 nullable: true
 *     responses:
 *       201:
 *         description: "Mensaje enviado exitosamente"
 *       401:
 *         description: "No autenticado"
 */
// Enviar mensaje desde el operador (protegido)
router.post('/send', verifyToken, apiController.enviarMensaje);

/**
 * @swagger
 * /api/mark-read/{telefono}:
 *   post:
 *     summary: "Marcar conversación como leída"
 *     tags: [Mensajes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: telefono
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: "Conversación marcada como leída"
 */
// Marcar conversación como leída (protegido)
router.post('/mark-read/:telefono', verifyToken, apiController.marcarLeido);

/**
 * @swagger
 * /api/stats:
 *   get:
 *     summary: "Obtener estadísticas del sistema"
 *     tags: [Clientes]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: "Estadísticas del panel"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalClientes:
 *                   type: integer
 *                 clientesActivos:
 *                   type: integer
 *                 mensajesHoy:
 *                   type: integer
 */
// Estadísticas del panel (protegido)
router.get('/stats', verifyToken, apiController.obtenerEstadisticas);

/**
 * @swagger
 * /api/chats/{phone}/pause:
 *   post:
 *     summary: "Pausar el bot para un cliente"
 *     tags: [Clientes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: phone
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: "Bot pausado correctamente"
 */
router.post('/chats/:phone/pause', verifyToken, apiController.pausarBot);

/**
 * @swagger
 * /api/chats/{phone}/activate:
 *   post:
 *     summary: "Activar el bot para un cliente"
 *     tags: [Clientes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: phone
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: "Bot activado correctamente"
 */
router.post('/chats/:phone/activate', verifyToken, apiController.activarBot);

// Reactivar conversación vencida (>24hs) usando plantilla (protegido)
router.post('/chats/:phone/reactivate', verifyToken, chatController.reactivate);

/**
 * @swagger
 * /api/upload:
 *   post:
 *     summary: "Subir archivo (imagen, PDF, etc)"
 *     tags: [Mensajes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: "Archivo subido exitosamente"
 */
// Subida de archivos (protegido)
router.post('/upload', verifyToken, upload.single('file'), apiController.subirArchivo);

/**
 * @swagger
 * /api/media/{mediaId}:
 *   get:
 *     summary: "Descargar media (imagen, archivo, audio)"
 *     tags: [Mensajes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: mediaId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: "Archivo descargado"
 */
// Proxy de media (descarga/visualización) (protegido)
router.get('/media/:mediaId', verifyToken, apiController.descargarMedia);

module.exports = router;
