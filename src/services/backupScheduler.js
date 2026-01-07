const cron = require('node-cron');
const backupService = require('../services/backupService');

/**
 * Inicializa el scheduler de backups automáticos
 * Configurable mediante variables de entorno:
 * - BACKUP_CRON_SCHEDULE: Expresión cron (default: "0 2 * * *" = 2 AM diario)
 * - BACKUP_ENABLED: true/false (default: true)
 */

const BACKUP_ENABLED = process.env.BACKUP_ENABLED !== 'false';
const BACKUP_SCHEDULE = process.env.BACKUP_CRON_SCHEDULE || '0 2 */3 * *'; // 2 AM cada 3 días

let backupScheduler = null;

/**
 * Iniciar scheduler de backups
 */
const startBackupScheduler = () => {
  if (!BACKUP_ENABLED) {
    console.log('ℹ️  Backups deshabilitados (BACKUP_ENABLED=false)');
    return;
  }

  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    console.warn('⚠️  AWS credentials no configuradas. Backups a S3 deshabilitados.');
    console.warn('    Configure: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET');
    return;
  }

  try {
    backupScheduler = cron.schedule(BACKUP_SCHEDULE, async () => {
      console.log('');
      console.log('═══════════════════════════════════════════════════════════');
      console.log('🔄 INICIANDO BACKUP AUTOMÁTICO DE BASE DE DATOS');
      console.log('═══════════════════════════════════════════════════════════');

      const result = await backupService.executeFullBackup();

      if (result.success) {
        console.log('═══════════════════════════════════════════════════════════');
        console.log('✅ BACKUP COMPLETADO EXITOSAMENTE');
        console.log('═══════════════════════════════════════════════════════════');
        console.log(`   Archivo: ${result.backup.filename}`);
        console.log(`   Tamaño: ${(result.backup.size / 1024 / 1024).toFixed(2)} MB`);
        console.log(`   S3 Key: ${result.s3.key}`);
        console.log(`   Backups eliminados: ${result.rotation.deletedOldBackups}`);
        console.log('═══════════════════════════════════════════════════════════');
        console.log('');
      } else {
        console.error('═══════════════════════════════════════════════════════════');
        console.error('❌ BACKUP FALLIDO');
        console.error('═══════════════════════════════════════════════════════════');
        console.error(`   Error: ${result.error}`);
        console.error('═══════════════════════════════════════════════════════════');
        console.error('');
      }
    });

    console.log(`✅ Scheduler de backups iniciado (schedule: "${BACKUP_SCHEDULE}")`);
    console.log(`   Próximo backup: ${getNextBackupTime()}`);
  } catch (error) {
    console.error('❌ Error iniciando scheduler de backups:', error.message);
  }
};

/**
 * Detener scheduler de backups
 */
const stopBackupScheduler = () => {
  if (backupScheduler) {
    backupScheduler.stop();
    console.log('⏹️  Scheduler de backups detenido');
    backupScheduler = null;
  }
};

/**
 * Obtener próxima ejecución del backup
 * @returns {string} Fecha/hora formateada
 */
const getNextBackupTime = () => {
  try {
    // Parse simple de cron (solo funciona para casos comunes como "0 2 * * *")
    const parts = BACKUP_SCHEDULE.split(' ');
    if (parts.length === 5) {
      const [minute, hour] = parts;
      const now = new Date();
      const next = new Date();

      next.setHours(parseInt(hour), parseInt(minute), 0, 0);

      // Si ya pasó la hora hoy, será mañana
      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }

      return next.toLocaleString('es-AR');
    }
    return 'Hora desconocida';
  } catch (error) {
    return 'No disponible';
  }
};

module.exports = {
  startBackupScheduler,
  stopBackupScheduler,
  getNextBackupTime
};
