const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/authMiddleware');
const backupService = require('../services/backupService');

/**
 * @swagger
 * /api/backups:
 *   get:
 *     summary: "Listar todos los backups disponibles en S3"
 *     tags: [Backups]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: "Lista de backups disponibles"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 total:
 *                   type: integer
 *                 backups:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Backup'
 *       401:
 *         description: "No autenticado"
 */
router.get('/backups', verifyToken, async (req, res) => {
  try {
    const backups = await backupService.listBackups();

    res.json({
      success: true,
      backups: backups.sort((a, b) => new Date(b.date) - new Date(a.date)),
      total: backups.length,
      message: 'Backups listados exitosamente'
    });
  } catch (error) {
    console.error('❌ Error listando backups:', error);
    res.status(500).json({
      success: false,
      error: 'Error al listar backups'
    });
  }
});

/**
 * @swagger
 * /api/backups/manual:
 *   post:
 *     summary: "Iniciar un backup manual inmediatamente"
 *     tags: [Backups]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       202:
 *         description: "Backup iniciado en segundo plano"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 status:
 *                   type: string
 *                   enum: [processing]
 */
router.post('/backups/manual', verifyToken, async (req, res) => {
  try {
    res.status(202).json({
      success: true,
      message: 'Backup iniciado en segundo plano',
      status: 'processing'
    });

    // Ejecutar en background sin bloquear response
    backupService.executeFullBackup().then(result => {
      if (result.success) {
        console.log('✅ Backup manual completado exitosamente');
      } else {
        console.error('❌ Backup manual falló:', result.error);
      }
    });
  } catch (error) {
    console.error('❌ Error ejecutando backup manual:', error);
    res.status(500).json({
      success: false,
      error: 'Error al iniciar backup'
    });
  }
});

/**
 * @swagger
 * /api/backups/download/{filename}:
 *   get:
 *     summary: "Descargar un backup específico desde S3"
 *     tags: [Backups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: filename
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: "Nombre del archivo backup (ej: irrigacion_bot_2026-01-07.sql.gz)"
 *     responses:
 *       200:
 *         description: "Archivo gzip descargado"
 *         content:
 *           application/gzip:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: "Nombre de archivo inválido"
 *       404:
 *         description: "Archivo no encontrado"
 */
router.get('/backups/download/:filename', verifyToken, async (req, res) => {
  try {
    const { filename } = req.params;

    // Validar nombre de archivo (prevenir path traversal)
    if (filename.includes('..') || filename.includes('/')) {
      return res.status(400).json({
        success: false,
        error: 'Nombre de archivo inválido'
      });
    }

    const data = await backupService.downloadBackup(filename);

    res.setHeader('Content-Type', 'application/gzip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(data);
  } catch (error) {
    console.error('❌ Error descargando backup:', error);
    res.status(500).json({
      success: false,
      error: 'Error descargando backup'
    });
  }
});

module.exports = router;
