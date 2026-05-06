const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');
const { verifyMetaWebhook } = require('../middlewares/webhookSignatureMiddleware');

// GET /webhook - Verificación del webhook
router.get('/', webhookController.verifyWebhook);

// POST /webhook - Recepción de mensajes (con verificación de firma)
router.post('/', verifyMetaWebhook, webhookController.receiveMessage);

module.exports = router;
