const express = require('express');
const router = express.Router();
const { performHealthCheck, checkDatabase, checkPuppeteer, checkWhatsAppAPI, checkDiskAndMemory } = require('../services/healthService');
const { verifyToken } = require('../middlewares/authMiddleware');

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: "Health check público - Estado del sistema"
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: "Sistema funcionando correctamente"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthCheck'
 *       503:
 *         description: "Componente crítico caído o degradado"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthCheck'
 */
router.get('/health', async (req, res) => {
  try {
    const health = await performHealthCheck();

    // Retornar con status HTTP apropiado
    const httpStatus = health.status === 'ok' ? 200 : health.status === 'degraded' ? 503 : 503;
    
    res.status(httpStatus).json(health);
  } catch (error) {
    console.error('❌ Error en GET /api/health:', error);
    res.status(503).json({
      status: 'down',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/health/detailed:
 *   get:
 *     summary: "Health check detallado - Incluye configuración sensible"
 *     tags: [Health]
 *     description: "Health check detallado que requiere autenticación y devuelve información sensible"
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: "Información detallada del sistema"
 */
router.get('/health/detailed', verifyToken, async (req, res) => {
  try {
    const health = await performHealthCheck();
    
    // Agregar información adicional sensible
    const detailed = {
      ...health,
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        env: process.env.NODE_ENV || 'development'
      },
      config: {
        port: process.env.PORT || 3000,
        databaseName: process.env.DB_NAME || 'irrigacion_bot',
        whatsappApiVersion: process.env.WHATSAPP_API_VERSION || 'v21.0',
        jwtExpiry: process.env.JWT_EXPIRY || '8h',
        backupEnabled: process.env.BACKUP_ENABLED === 'true',
        backupSchedule: process.env.BACKUP_CRON_SCHEDULE || '0 2 */3 * *'
      }
    };

    const httpStatus = health.status === 'ok' ? 200 : 503;
    res.status(httpStatus).json(detailed);
  } catch (error) {
    console.error('❌ Error en GET /api/health/detailed:', error);
    res.status(503).json({
      status: 'down',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

/**
 * GET /api/health/database
 * Verifica solo la base de datos
 */
router.get('/health/database', async (req, res) => {
  try {
    const dbCheck = await checkDatabase();
    const httpStatus = dbCheck.status === 'ok' ? 200 : 503;
    
    res.status(httpStatus).json({
      component: 'database',
      ...dbCheck
    });
  } catch (error) {
    res.status(503).json({
      component: 'database',
      status: 'down',
      error: error.message
    });
  }
});

/**
 * GET /api/health/puppeteer
 * Verifica disponibilidad de Puppeteer para scraping
 */
router.get('/health/puppeteer', async (req, res) => {
  try {
    const puppeteerCheck = await checkPuppeteer();
    const httpStatus = puppeteerCheck.status === 'ok' ? 200 : 503;
    
    res.status(httpStatus).json({
      component: 'puppeteer',
      ...puppeteerCheck
    });
  } catch (error) {
    res.status(503).json({
      component: 'puppeteer',
      status: 'down',
      error: error.message
    });
  }
});

/**
 * GET /api/health/whatsapp
 * Verifica configuración de WhatsApp API
 */
router.get('/health/whatsapp', async (req, res) => {
  try {
    const whatsappCheck = await checkWhatsAppAPI();
    const httpStatus = whatsappCheck.status === 'ok' ? 200 : 503;
    
    res.status(httpStatus).json({
      component: 'whatsapp',
      ...whatsappCheck
    });
  } catch (error) {
    res.status(503).json({
      component: 'whatsapp',
      status: 'down',
      error: error.message
    });
  }
});

/**
 * GET /api/health/resources
 * Verifica disk space y memoria
 */
router.get('/health/resources', async (req, res) => {
  try {
    const resourcesCheck = await checkDiskAndMemory();
    const httpStatus = resourcesCheck.status === 'ok' ? 200 : 503;
    
    res.status(httpStatus).json({
      component: 'resources',
      ...resourcesCheck
    });
  } catch (error) {
    res.status(503).json({
      component: 'resources',
      status: 'down',
      error: error.message
    });
  }
});

module.exports = router;
