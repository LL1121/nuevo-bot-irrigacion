const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const backupService = require('../services/backupService');

/**
 * GET /api/backups - Listar backups disponibles en S3
 * Requiere: Token JWT de operador/admin
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
 * POST /api/backups/manual - Ejecutar backup manual ahora
 * Requiere: Token JWT de admin
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
 * GET /api/backups/download/:filename - Descargar un backup específico
 * Requiere: Token JWT de admin
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
