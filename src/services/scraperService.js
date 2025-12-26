const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

// Crear carpeta temporal si no existe
const TEMP_DIR = path.join(__dirname, '../../temp');
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// ============================================
// PATRÓN SINGLETON PARA EL NAVEGADOR
// ============================================
let globalBrowser = null;

/**
 * Inicializar navegador (Singleton)
 * Solo se crea una vez y se reutiliza
 */
const initBrowser = async () => {
  if (globalBrowser) {
    // Verificar si el browser sigue abierto
    try {
      await globalBrowser.version();
      console.log('♻️ Reutilizando navegador existente');
      return globalBrowser;
    } catch (error) {
      console.log('⚠️ Navegador cerrado, creando uno nuevo...');
      globalBrowser = null;
    }
  }
  
  console.log('🚀 Lanzando nuevo navegador...');
  globalBrowser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu'
    ]
  });
  
  console.log('✅ Navegador listo');
  return globalBrowser;
};

/**
 * Obtener datos de deuda completos (Scraping Optimizado)
 * @param {string} dni - DNI o CUIT sin puntos
 * @returns {Promise<{success: boolean, data?: object, pdfPath?: string, error?: string}>}
 */
const obtenerDatosDeuda = async (dni) => {
  let page = null;
  
  try {
    console.log(`🔍 Iniciando scraping para DNI: ${dni}`);
    
    // Inicializar/reutilizar navegador
    const browser = await initBrowser();
    
    // Crear nueva página (reutilizando browser)
    page = await browser.newPage();
    
    // Configurar timeout
    page.setDefaultTimeout(30000);
    
    // Navegar a la página de autogestion
    console.log('📄 Cargando página de autogestion...');
    await page.goto('https://autogestion.cloud.irrigacion.gov.ar/dni', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    // Ingresar DNI
    console.log('✏️ Ingresando DNI...');
    await page.waitForSelector('input[type="text"]', { timeout: 10000 });
    await page.type('input[type="text"]', dni);
    
    // Hacer clic en "Buscar servicios asociados" usando XPath (más robusto)
    console.log('🔎 Buscando servicios asociados...');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
      page.evaluate(() => {
        // Buscar botón por texto, no por clase
        const buttons = Array.from(document.querySelectorAll('button'));
        const searchButton = buttons.find(btn => 
          btn.textContent.includes('Buscar servicios asociados')
        );
        if (searchButton) {
          searchButton.click();
        } else {
          throw new Error('No se encontró el botón de búsqueda');
        }
      })
    ]);
    
    // Esperar resultados
    await page.waitForTimeout(2000);
    
    // Verificar si se encontraron servicios
    const noResults = await page.evaluate(() => {
      return document.body.textContent.includes('No se encontraron servicios');
    });
    
    if (noResults) {
      console.log('❌ No se encontraron servicios para este DNI');
      return {
        success: false,
        error: 'No se encontraron servicios asociados a este DNI'
      };
    }
    
    // Hacer clic en "Consultar Deuda"
    console.log('💰 Consultando deuda...');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
      page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, a'));
        const debtButton = buttons.find(btn => 
          btn.textContent.includes('Consultar Deuda') || 
          btn.textContent.includes('Ver Deuda')
        );
        if (debtButton) {
          debtButton.click();
        } else {
          throw new Error('No se encontró el botón de consulta de deuda');
        }
      })
    ]);
    
    // Esperar a que cargue la información de deuda
    await page.waitForTimeout(3000);
    
    // ============================================
    // EXTRACCIÓN DE DATOS EXTENDIDA
    // ============================================
    console.log('📊 Extrayendo datos completos...');
    
    const datos = await page.evaluate(() => {
      const resultado = {
        titular: 'No disponible',
        cuit: 'No disponible',
        hectareas: 'No disponible',
        deuda: 'No disponible',
        servicio: 'No disponible'
      };
      
      // Extraer Titular (buscar label + valor)
      const titularLabel = Array.from(document.querySelectorAll('*')).find(el => 
        /Titular|Nombre|Propietario/i.test(el.textContent)
      );
      if (titularLabel) {
        const parentElement = titularLabel.closest('div, tr, p');
        if (parentElement) {
          const text = parentElement.textContent.replace(/Titular|:|Nombre/gi, '').trim();
          resultado.titular = text.split('\n')[0].trim();
        }
      }
      
      // Extraer CUIT
      const cuitMatch = document.body.textContent.match(/CUIT[:\s]*(\d{2}-\d{8}-\d{1}|\d{11})/i);
      if (cuitMatch) {
        resultado.cuit = cuitMatch[1];
      }
      
      // Extraer Hectáreas
      const hectareasMatch = document.body.textContent.match(/(\d+[,.]?\d*)\s*(ha|hectáreas|hectareas)/i);
      if (hectareasMatch) {
        resultado.hectareas = `${hectareasMatch[1]} ha`;
      }
      
      // Extraer Servicio/Nomenclatura
      const servicioMatch = document.body.textContent.match(/(?:Servicio|Nomenclatura|Detalle de la deuda del servicio):\s*([A-Z0-9-]+)/i);
      if (servicioMatch) {
        resultado.servicio = servicioMatch[1];
      }
      
      // Extraer Monto de Deuda
      const montoElement = Array.from(document.querySelectorAll('*')).find(el => 
        /Total|Deuda|Saldo/i.test(el.textContent) && 
        /\$[\d.,]+/.test(el.textContent)
      );
      
      if (montoElement) {
        const match = montoElement.textContent.match(/\$[\d.,]+/);
        if (match) {
          resultado.deuda = match[0];
        }
      }
      
      return resultado;
    });
    
    console.log('📋 Datos extraídos:', datos);
    
    // ============================================
    // GENERACIÓN DE PDF PREVENTIVA
    // ============================================
    console.log('📄 Generando PDF del boleto...');
    
    const pdfPath = path.join(TEMP_DIR, `boleto_${dni}.pdf`);
    
    try {
      await page.pdf({
        path: pdfPath,
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20px',
          right: '20px',
          bottom: '20px',
          left: '20px'
        }
      });
      
      console.log(`✅ PDF generado: ${pdfPath}`);
      
    } catch (pdfError) {
      console.error('⚠️ Error generando PDF:', pdfError.message);
    }
    
    return {
      success: true,
      data: datos,
      pdfPath: fs.existsSync(pdfPath) ? pdfPath : null
    };
    
  } catch (error) {
    console.error('❌ Error en scraping:', error);
    return {
      success: false,
      error: error.message || 'Error al consultar la deuda'
    };
  } finally {
    // ⚠️ IMPORTANTE: Cerrar SOLO la página, NO el browser
    if (page) {
      await page.close();
      console.log('📄 Página cerrada (browser sigue activo)');
    }
  }
};

/**
 * Cerrar el navegador global (usar solo al apagar el servidor)
 */
const closeBrowser = async () => {
  if (globalBrowser) {
    await globalBrowser.close();
    globalBrowser = null;
    console.log('🔒 Navegador global cerrado');
  }
};

/**
 * Limpiar archivos temporales antiguos (más de 1 hora)
 */
const cleanTempFiles = () => {
  try {
    const files = fs.readdirSync(TEMP_DIR);
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    
    files.forEach(file => {
      const filePath = path.join(TEMP_DIR, file);
      const stats = fs.statSync(filePath);
      
      if (now - stats.mtimeMs > oneHour) {
        if (stats.isDirectory()) {
          fs.rmSync(filePath, { recursive: true, force: true });
        } else {
          fs.unlinkSync(filePath);
        }
        console.log(`🗑️ Archivo temporal eliminado: ${file}`);
      }
    });
  } catch (error) {
    console.error('❌ Error al limpiar archivos temporales:', error);
  }
};

// Ejecutar limpieza cada hora
setInterval(cleanTempFiles, 60 * 60 * 1000);

// Cerrar navegador al finalizar proceso
process.on('SIGINT', async () => {
  console.log('\n🛑 Cerrando servidor...');
  await closeBrowser();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await closeBrowser();
  process.exit(0);
});

module.exports = {
  obtenerDatosDeuda,
  initBrowser,
  closeBrowser,
  cleanTempFiles
};
