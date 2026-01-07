const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/authMiddleware');
const {
  obtenerLog,
  obtenerHistorial,
  obtenerResumenUsuario,
  limpiarLogAntiguos
} = require('../services/auditService');

/**
 * GET /api/audit-log
 * Obtiene el log de auditoría con filtros opcionales
 * Queryparams: usuario?, tabla?, accion?, fechaDesde?, fechaHasta?, limite?
 * Ejemplo: /api/audit-log?tabla=clientes&usuario=admin@bot.com&limite=50
 */
router.get('/audit-log', verifyToken, async (req, res) => {
  try {
    const { usuario, tabla, accion, fechaDesde, fechaHasta, limite } = req.query;

    const filtros = {};
    if (usuario) filtros.usuario = usuario;
    if (tabla) filtros.tabla = tabla;
    if (accion) filtros.accion = accion;
    if (fechaDesde) filtros.fechaDesde = fechaDesde;
    if (fechaHasta) filtros.fechaHasta = fechaHasta;
    if (limite) filtros.limite = parseInt(limite);

    const logs = await obtenerLog(filtros);

    res.json({
      success: true,
      cantidad: logs.length,
      logs
    });
  } catch (error) {
    console.error('❌ Error en GET /api/audit-log:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/audit-log/historial/:tabla/:idRegistro
 * Obtiene el historial de cambios de un registro específico
 * Ejemplo: /api/audit-log/historial/clientes/541234567890
 */
router.get('/audit-log/historial/:tabla/:idRegistro', verifyToken, async (req, res) => {
  try {
    const { tabla, idRegistro } = req.params;

    if (!tabla || !idRegistro) {
      return res.status(400).json({
        success: false,
        error: 'tabla e idRegistro son requeridos'
      });
    }

    const historial = await obtenerHistorial(tabla, idRegistro);

    res.json({
      success: true,
      tabla,
      idRegistro,
      cambios: historial.length,
      historial
    });
  } catch (error) {
    console.error('❌ Error en GET /audit-log/historial:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/audit-log/resumen/:usuario
 * Obtiene resumen de actividades por usuario en los últimos N días
 * Ejemplo: /api/audit-log/resumen/admin@bot.com?dias=7
 */
router.get('/audit-log/resumen/:usuario', verifyToken, async (req, res) => {
  try {
    const { usuario } = req.params;
    const { dias } = req.query;

    const resumen = await obtenerResumenUsuario(usuario, dias ? parseInt(dias) : 7);

    res.json({
      success: true,
      data: resumen
    });
  } catch (error) {
    console.error('❌ Error en GET /audit-log/resumen:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/audit-log/limpiar
 * Elimina registros de auditoría más antiguos a N días
 * Body: { dias: number } (default 90)
 * Solo admins
 */
router.post('/audit-log/limpiar', verifyToken, async (req, res) => {
  try {
    // Verificar que sea admin (si tienes sistema de roles)
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Solo administradores pueden limpiar el log'
      });
    }

    const { dias } = req.body || {};
    const resultado = await limpiarLogAntiguos(dias || 90);

    res.json(resultado);
  } catch (error) {
    console.error('❌ Error en POST /audit-log/limpiar:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
