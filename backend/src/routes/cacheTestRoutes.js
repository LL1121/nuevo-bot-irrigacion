const express = require('express');
const router = express.Router();
const { cacheSet, cacheGet, cacheDel, cacheFlush } = require('../services/cacheService');
const logger = require('../services/logService');
const { verifyToken } = require('../middlewares/authMiddleware');

/**
 * @swagger
 * /api/cache/test:
 *   post:
 *     summary: "Test de cache - Guardar valor en Redis"
 *     tags: [Cache]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               key:
 *                 type: string
 *               value:
 *                 type: string
 *               ttl:
 *                 type: integer
 *                 default: 3600
 *     responses:
 *       200:
 *         description: "Valor guardado en cache"
 */
router.post('/cache/test', verifyToken, async (req, res) => {
  try {
    const { key, value, ttl } = req.body;

    await cacheSet(key, { test: value }, ttl || 3600);
    logger.info('Cache test SET', { key, ttl });

    res.json({
      success: true,
      message: 'Valor guardado en cache',
      key,
      ttl
    });
  } catch (error) {
    logger.error('Error en cache test', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/cache/test/{key}:
 *   get:
 *     summary: "Test de cache - Obtener valor de Redis"
 *     tags: [Cache]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: key
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: "Valor del cache"
 *       404:
 *         description: "Clave no encontrada"
 */
router.get('/cache/test/:key', verifyToken, async (req, res) => {
  try {
    const { key } = req.params;

    const value = await cacheGet(key);
    if (!value) {
      return res.status(404).json({
        success: false,
        message: 'Clave no encontrada en cache'
      });
    }

    logger.info('Cache test GET', { key });

    res.json({
      success: true,
      key,
      value
    });
  } catch (error) {
    logger.error('Error en cache test', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/logs/test:
 *   post:
 *     summary: "Test de logging - Registrar un log"
 *     tags: [Logging]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               level:
 *                 type: string
 *                 enum: [error, warn, info, debug]
 *               message:
 *                 type: string
 *     responses:
 *       200:
 *         description: "Log registrado"
 */
router.post('/logs/test', verifyToken, async (req, res) => {
  try {
    const { level, message } = req.body;

    if (!['error', 'warn', 'info', 'debug'].includes(level)) {
      return res.status(400).json({
        success: false,
        error: 'Level inválido. Usa: error, warn, info, debug'
      });
    }

    logger[level](message, {
      source: 'api-test',
      user: req.user?.email || 'anonymous'
    });

    res.json({
      success: true,
      message: 'Log registrado en ' + level,
      details: 'Ver archivo: logs/combined.log'
    });
  } catch (error) {
    logger.error('Error en logs test', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
