const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');

// GET /webhook - Verificación del webhook
router.get('/', webhookController.verifyWebhook);

// POST /webhook - Recepción de mensajes
router.post('/', webhookController.receiveMessage);

module.exports = router;
