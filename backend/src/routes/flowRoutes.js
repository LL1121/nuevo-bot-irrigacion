'use strict';

const express = require('express');
const router  = express.Router();

const flowController        = require('../controllers/flowController');
const { verifyMetaWebhook } = require('../middlewares/webhookSignatureMiddleware');

/**
 * POST /webhook/flows/exchange
 *
 * Data Exchange endpoint para WhatsApp Dynamic Flows.
 * Esta es la URL que se configura en el panel de Meta → WhatsApp → Flows.
 * Meta envía el body cifrado con AES-128-GCM + RSA OAEP y espera respuesta
 * cifrada en menos de 3 000 ms.
 *
 * Firma verificada con X-Hub-Signature-256 (misma lógica que /webhook).
 */
router.post('/flows/exchange', verifyMetaWebhook, flowController.handleDataExchange);

module.exports = router;
