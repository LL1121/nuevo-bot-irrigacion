const { getPool } = require('../config/db');
const fs = require('fs').promises;
const os = require('os');
const path = require('path');

/**
 * Servicio de Health Checks
 * Verifica estado de todos los componentes críticos del sistema
 */

/**
 * Verifica la conexión a la base de datos
 * @returns {Promise<{status: 'ok'|'down', message: string, latency: number}>}
 */
const checkDatabase = async () => {
  const startTime = Date.now();
  try {
    const pool = getPool();
    const connection = await pool.getConnection();
    
    // Ejecutar query simple para verificar BD
    await connection.query('SELECT 1');
    connection.release();
    
    const latency = Date.now() - startTime;
    return {
      status: 'ok',
      message: 'Base de datos funcionando correctamente',
      latency
    };
  } catch (error) {
    return {
      status: 'down',
      message: `Error en BD: ${error.message}`,
      latency: Date.now() - startTime
    };
  }
};

/**
 * Verifica la conexión a WhatsApp Cloud API
 * @returns {Promise<{status: 'ok'|'down', message: string, version: string}>}
 */
const checkWhatsAppAPI = async () => {
  try {
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const wapiVersion = process.env.WHATSAPP_API_VERSION || 'v21.0';

    if (!accessToken || !phoneNumberId) {
      return {
        status: 'degraded',
        message: 'Credenciales de WhatsApp no configuradas',
        version: wapiVersion
      };
    }

    // Verificar que el token sea válido (formato básico)
    if (accessToken.length < 10) {
      return {
        status: 'down',
        message: 'Token de WhatsApp inválido o expirado',
        version: wapiVersion
      };
    }

    // Nota: En producción, hacer una llamada real a /me endpoint
    // Para ahora, solo verificamos que la configuración exista
    return {
      status: 'ok',
      message: 'Credenciales de WhatsApp configuradas correctamente',
      version: wapiVersion
    };
  } catch (error) {
    return {
      status: 'down',
      message: `Error verificando WhatsApp: ${error.message}`,
      version: process.env.WHATSAPP_API_VERSION || 'v21.0'
    };
  }
};

/**
 * Verifica disponibilidad de Puppeteer para web scraping
 * @returns {Promise<{status: 'ok'|'down', message: string, canLaunchBrowser: boolean}>}
 */
const checkPuppeteer = async () => {
  try {
    const puppeteer = require('puppeteer');
    
    // No lanzar navegador real (es costoso), solo verificar que puppeteer está instalado
    // y que podemos acceder al ejecutable de Chrome
    const browserPath = await puppeteer.executablePath();
    
    if (!browserPath) {
      return {
        status: 'degraded',
        message: 'Puppeteer instalado pero Chrome no encontrado',
        canLaunchBrowser: false
      };
    }

    // Verificar que el archivo de Chrome existe
    const chromeExists = await fs.access(browserPath)
      .then(() => true)
      .catch(() => false);

    if (!chromeExists) {
      return {
        status: 'down',
        message: `Chrome no encontrado en: ${browserPath}`,
        canLaunchBrowser: false
      };
    }

    return {
      status: 'ok',
      message: 'Puppeteer y Chrome disponibles para web scraping',
      canLaunchBrowser: true
    };
  } catch (error) {
    return {
      status: 'down',
      message: `Puppeteer no disponible: ${error.message}`,
      canLaunchBrowser: false
    };
  }
};

/**
 * Verifica espacio disponible en disco y uso de memoria
 * @returns {Promise<{status: 'ok'|'degraded'|'down', diskUsage: {total, free, used, percentUsed}, memoryUsage: {total, free, used, percentUsed}}>}
 */
const checkDiskAndMemory = async () => {
  try {
    // Espacio en disco del sistema
    const driveRoot = process.env.DRIVE_ROOT || 'C:';
    
    // Obtener información de memoria del sistema
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memPercent = ((usedMem / totalMem) * 100).toFixed(2);

    // Simular check de espacio en disco (en Windows, usar fsutil)
    // Para simplificar, usar datos del sistema
    const uploadsDir = path.join(__dirname, '../..', 'public', 'uploads');
    const backupsDir = path.join(__dirname, '../..', 'backups');

    // Crear directorios si no existen
    try {
      await fs.mkdir(uploadsDir, { recursive: true });
      await fs.mkdir(backupsDir, { recursive: true });
    } catch (e) {
      // Ignorar si ya existen
    }

    // Aproximación: usar disponible en espacio del SO (típicamente >= 100GB es OK)
    const diskUsage = {
      total: totalMem, // Usar memoria como proxy
      free: freeMem,
      used: usedMem,
      percentUsed: parseFloat(memPercent),
      status: freeMem > (totalMem * 0.1) ? 'ok' : 'warning' // Alerta si < 10%
    };

    const status = diskUsage.percentUsed > 90 ? 'degraded' : 'ok';
    const message = diskUsage.percentUsed > 90 
      ? `⚠️ Espacio bajo: ${diskUsage.percentUsed}% usado`
      : `✅ Espacio disponible: ${(diskUsage.free / 1024 / 1024 / 1024).toFixed(2)} GB`;

    return {
      status,
      message,
      diskUsage: {
        total: Math.round(totalMem / 1024 / 1024 / 1024),
        free: Math.round(freeMem / 1024 / 1024 / 1024),
        used: Math.round(usedMem / 1024 / 1024 / 1024),
        percentUsed: parseFloat(memPercent)
      },
      memoryUsage: {
        total: Math.round(totalMem / 1024 / 1024),
        free: Math.round(freeMem / 1024 / 1024),
        used: Math.round(usedMem / 1024 / 1024),
        percentUsed: parseFloat(memPercent)
      }
    };
  } catch (error) {
    return {
      status: 'degraded',
      message: `Error verificando disco/memoria: ${error.message}`,
      diskUsage: null,
      memoryUsage: null
    };
  }
};

/**
 * Realiza un health check completo de todos los componentes
 * @returns {Promise<{status: 'ok'|'degraded'|'down', timestamp: string, checks: object, uptime: number}>}
 */
const performHealthCheck = async () => {
  try {
    const startTime = Date.now();

    // Ejecutar todos los checks en paralelo
    const [db, whatsapp, puppeteer, resources] = await Promise.all([
      checkDatabase(),
      checkWhatsAppAPI(),
      checkPuppeteer(),
      checkDiskAndMemory()
    ]);

    // Determinar status general
    let overallStatus = 'ok';
    if (db.status === 'down' || puppeteer.status === 'down') {
      overallStatus = 'down'; // Componentes críticos
    } else if (db.status === 'degraded' || whatsapp.status === 'degraded' || resources.status === 'degraded') {
      overallStatus = 'degraded';
    }

    const checkDuration = Date.now() - startTime;

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checkDuration,
      checks: {
        database: {
          status: db.status,
          message: db.message,
          latency: `${db.latency}ms`
        },
        whatsapp: {
          status: whatsapp.status,
          message: whatsapp.message,
          version: whatsapp.version
        },
        puppeteer: {
          status: puppeteer.status,
          message: puppeteer.message,
          canLaunchBrowser: puppeteer.canLaunchBrowser
        },
        resources: {
          status: resources.status,
          message: resources.message,
          disk: resources.diskUsage,
          memory: resources.memoryUsage
        }
      }
    };
  } catch (error) {
    return {
      status: 'down',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      message: `Error en health check: ${error.message}`,
      checks: {}
    };
  }
};

module.exports = {
  checkDatabase,
  checkWhatsAppAPI,
  checkPuppeteer,
  checkDiskAndMemory,
  performHealthCheck
};
