const AWS = require('aws-sdk');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const execAsync = promisify(exec);

/**
 * Servicio de Backups Automatizados a AWS S3
 * - Ejecuta mysqldump diario
 * - Comprime en gzip
 * - Sube a S3
 * - Mantiene rotación (últimos 7 días)
 */

// Configurar AWS S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1'
});

const BACKUP_DIR = path.resolve(__dirname, '../../backups');
const S3_BUCKET = process.env.AWS_S3_BUCKET || 'irrigacion-backups';
const S3_RETENTION_DAYS = parseInt(process.env.BACKUP_RETENTION_DAYS || '7');

// Crear carpeta de backups si no existe
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

/**
 * Ejecutar backup de la base de datos
 * @returns {Promise<{success: boolean, filename?: string, error?: string, size?: number}>}
 */
const createBackup = async () => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const backupFilename = `db-backup-${timestamp}.sql.gz`;
    const backupPath = path.join(BACKUP_DIR, backupFilename);

    console.log(`⏱️  Iniciando backup de base de datos: ${backupFilename}`);

    // Comando mysqldump con compresión
    const DB_NAME = process.env.DB_NAME || 'irrigacion';
    const DB_USER = process.env.DB_USER || 'root';
    const DB_PASSWORD = process.env.DB_PASSWORD || '';
    const DB_HOST = process.env.DB_HOST || 'localhost';

    // Construir comando mysqldump
    let dumpCommand = `mysqldump --user=${DB_USER}`;
    
    if (DB_PASSWORD) {
      dumpCommand += ` --password=${DB_PASSWORD}`;
    }
    
    dumpCommand += ` --host=${DB_HOST} ${DB_NAME} | gzip > ${backupPath}`;

    // Ejecutar mysqldump
    await execAsync(dumpCommand);

    // Verificar que el archivo se creó
    if (!fs.existsSync(backupPath)) {
      throw new Error('Backup file not created');
    }

    const stats = fs.statSync(backupPath);
    const sizeInMB = (stats.size / 1024 / 1024).toFixed(2);

    console.log(`✅ Backup local creado: ${backupFilename} (${sizeInMB} MB)`);

    return {
      success: true,
      filename: backupFilename,
      localPath: backupPath,
      size: stats.size
    };
  } catch (error) {
    console.error('❌ Error creando backup local:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Subir backup a S3
 * @param {string} localPath - Ruta local del archivo
 * @param {string} filename - Nombre del archivo
 * @returns {Promise<{success: boolean, s3Key?: string, error?: string}>}
 */
const uploadToS3 = async (localPath, filename) => {
  try {
    console.log(`📤 Subiendo ${filename} a S3...`);

    const fileContent = fs.readFileSync(localPath);
    const s3Key = `database-backups/${filename}`;

    const params = {
      Bucket: S3_BUCKET,
      Key: s3Key,
      Body: fileContent,
      ContentType: 'application/gzip',
      Metadata: {
        'created-at': new Date().toISOString(),
        'database': process.env.DB_NAME || 'irrigacion'
      }
    };

    await s3.upload(params).promise();

    console.log(`✅ Backup subido a S3: s3://${S3_BUCKET}/${s3Key}`);

    return {
      success: true,
      s3Key
    };
  } catch (error) {
    console.error('❌ Error subiendo a S3:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Rotación de backups en S3 (eliminar más antiguos que N días)
 * @returns {Promise<{deleted: number, error?: string}>}
 */
const rotateBackupsInS3 = async () => {
  try {
    console.log(`🔄 Rotando backups en S3 (retención: ${S3_RETENTION_DAYS} días)...`);

    // Listar todos los backups
    const listParams = {
      Bucket: S3_BUCKET,
      Prefix: 'database-backups/'
    };

    const data = await s3.listObjectsV2(listParams).promise();

    if (!data.Contents || data.Contents.length === 0) {
      console.log('ℹ️  No hay backups para rotar');
      return { deleted: 0 };
    }

    // Calcular fecha límite
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - S3_RETENTION_DAYS);

    // Filtrar archivos antiguos
    const objectsToDelete = data.Contents.filter(obj => {
      const objectDate = new Date(obj.LastModified);
      return objectDate < cutoffDate;
    });

    if (objectsToDelete.length === 0) {
      console.log(`ℹ️  Todos los backups están dentro del período de retención`);
      return { deleted: 0 };
    }

    // Eliminar archivos antiguos
    const deleteParams = {
      Bucket: S3_BUCKET,
      Delete: {
        Objects: objectsToDelete.map(obj => ({ Key: obj.Key }))
      }
    };

    const deleteResult = await s3.deleteObjects(deleteParams).promise();

    console.log(`✅ ${deleteResult.Deleted.length} backups antiguos eliminados`);

    return { deleted: deleteResult.Deleted.length };
  } catch (error) {
    console.error('❌ Error rotando backups:', error.message);
    return {
      deleted: 0,
      error: error.message
    };
  }
};

/**
 * Limpiar archivos locales de backup (mantener últimos 3 días)
 */
const cleanLocalBackups = () => {
  try {
    const files = fs.readdirSync(BACKUP_DIR);
    const cutoffTime = Date.now() - 3 * 24 * 60 * 60 * 1000; // 3 días

    let deletedCount = 0;
    files.forEach(file => {
      const filePath = path.join(BACKUP_DIR, file);
      const stat = fs.statSync(filePath);

      if (stat.mtimeMs < cutoffTime) {
        fs.unlinkSync(filePath);
        console.log(`🗑️  Backup local eliminado: ${file}`);
        deletedCount++;
      }
    });

    if (deletedCount === 0) {
      console.log('ℹ️  No hay backups locales antiguos para limpiar');
    }
  } catch (error) {
    console.error('❌ Error limpiando backups locales:', error.message);
  }
};

/**
 * Ejecutar backup completo (local + S3 + rotación)
 * @returns {Promise<object>}
 */
const executeFullBackup = async () => {
  try {
    console.log('🚀 Iniciando backup completo...');
    console.log(`📅 Timestamp: ${new Date().toISOString()}`);

    // 1. Crear backup local
    const backupResult = await createBackup();
    if (!backupResult.success) {
      throw new Error(`Backup local fallido: ${backupResult.error}`);
    }

    // 2. Subir a S3
    const uploadResult = await uploadToS3(backupResult.localPath, backupResult.filename);
    if (!uploadResult.success) {
      throw new Error(`Upload a S3 fallido: ${uploadResult.error}`);
    }

    // 3. Rotar backups en S3
    const rotationResult = await rotateBackupsInS3();

    // 4. Limpiar locales
    cleanLocalBackups();

    console.log('✅ Backup completo exitoso');

    return {
      success: true,
      timestamp: new Date().toISOString(),
      backup: {
        filename: backupResult.filename,
        size: backupResult.size,
        localPath: backupResult.localPath
      },
      s3: {
        bucket: S3_BUCKET,
        key: uploadResult.s3Key
      },
      rotation: {
        deletedOldBackups: rotationResult.deleted
      }
    };
  } catch (error) {
    console.error('❌ Error en backup completo:', error.message);
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
};

/**
 * Obtener lista de backups en S3
 * @returns {Promise<Array>}
 */
const listBackups = async () => {
  try {
    const params = {
      Bucket: S3_BUCKET,
      Prefix: 'database-backups/'
    };

    const data = await s3.listObjectsV2(params).promise();

    return (data.Contents || []).map(obj => ({
      filename: obj.Key.split('/').pop(),
      size: obj.Size,
      date: obj.LastModified,
      sizeInMB: (obj.Size / 1024 / 1024).toFixed(2)
    }));
  } catch (error) {
    console.error('❌ Error listando backups:', error.message);
    return [];
  }
};

/**
 * Descargar backup desde S3
 * @param {string} filename - Nombre del archivo
 * @returns {Promise<Buffer>}
 */
const downloadBackup = async (filename) => {
  try {
    const s3Key = `database-backups/${filename}`;

    const params = {
      Bucket: S3_BUCKET,
      Key: s3Key
    };

    const data = await s3.getObject(params).promise();
    return data.Body;
  } catch (error) {
    console.error('❌ Error descargando backup:', error.message);
    throw error;
  }
};

module.exports = {
  executeFullBackup,
  createBackup,
  uploadToS3,
  rotateBackupsInS3,
  cleanLocalBackups,
  listBackups,
  downloadBackup
};
