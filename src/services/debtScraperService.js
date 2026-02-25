const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const puppeteer = require('puppeteer');
const browserPool = require('./browserPool');

const BASE_URL_DNI = 'https://autogestion.cloud.irrigacion.gov.ar/dni';
const BASE_URL_SERVICIO = 'https://autogestion.cloud.irrigacion.gov.ar/servicio';
const DOWNLOAD_DIR = path.resolve(__dirname, '../../public/temp');
const DOWNLOAD_TIMEOUT_MS = 15000;
const FILE_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const SCRAPER_DEBUG = process.env.SCRAPER_DEBUG === 'true';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36';
let lastCleanupAt = 0;

// Asegurar carpeta de descargas
if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

/**
 * Limpia archivos PDF antiguos (>1 hora) en la carpeta temp
 */
async function cleanOldFiles() {
  const now = Date.now();
  if (now - lastCleanupAt < FILE_CLEANUP_INTERVAL_MS) {
    return;
  }

  try {
    const files = await fsp.readdir(DOWNLOAD_DIR);
    const oneHour = 60 * 60 * 1000;

    for (const file of files) {
      if (!file.endsWith('.pdf')) continue;
      const filePath = path.join(DOWNLOAD_DIR, file);
      const stats = await fsp.stat(filePath);
      if (now - stats.mtimeMs > oneHour) {
        await fsp.unlink(filePath);
        console.log(`🗑️ Archivo antiguo eliminado: ${file}`);
      }
    }
    lastCleanupAt = now;
  } catch (err) {
    console.error('⚠️ Error limpiando archivos antiguos:', err.message);
  }
}

/**
 * Espera a que aparezca un nuevo archivo en la carpeta de descargas
 * y valida que haya terminado (sin .crdownload). Luego renombra al nombre destino.
 */
async function waitForDownload(downloadDir, targetName, timeoutMs = DOWNLOAD_TIMEOUT_MS) {
  const start = Date.now();
  const initialFiles = new Set(await fsp.readdir(downloadDir));

  while (Date.now() - start < timeoutMs) {
    const files = await fsp.readdir(downloadDir);
    const newFiles = files.filter((f) => !initialFiles.has(f));
    if (newFiles.length) {
      // Tomar el primero nuevo
      const candidate = newFiles[0];
      // Esperar a que termine la descarga (.crdownload eliminado)
      if (candidate.endsWith('.crdownload')) {
        await delay(120);
        continue;
      }
      const tmpPath = path.join(downloadDir, candidate);
      const finalPath = path.join(downloadDir, targetName);

      // Sobrescribir si ya existe
      try {
        await fsp.unlink(finalPath);
      } catch (_) {
        // ignore si no existe
      }

      await fsp.rename(tmpPath, finalPath);
      return finalPath;
    }
    await delay(120);
  }

  throw new Error('Timeout esperando la descarga del PDF');
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForAnyText(page, texts, timeout = 9000, polling = 200) {
  return page.waitForFunction(
    (expectedTexts) => {
      const bodyText = (document.body?.innerText || '').toLowerCase();
      return expectedTexts.some((txt) => bodyText.includes(txt));
    },
    { timeout, polling },
    texts.map((txt) => txt.toLowerCase())
  );
}

async function createConfiguredPage(browser) {
  if (!browser || !browser.isConnected()) {
    throw new Error('Browser desconectado al crear página');
  }
  const page = await browser.newPage();
  await page.setDefaultTimeout(20000);
  await page.setDefaultNavigationTimeout(30000);
  await page.setUserAgent(USER_AGENT);
  await page.setViewport({ width: 1280, height: 800 });
  await page.setCacheEnabled(false);

  try {
    const client = await page.target().createCDPSession();
    await client.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: DOWNLOAD_DIR
    });
  } catch (err) {
    console.warn('⚠️ No se pudo configurar descargas:', err.message);
  }

  return page;
}

async function safeGoto(browser, page, url, maxAttempts = 2) {
  let currentPage = page;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await currentPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      return currentPage;
    } catch (err) {
      const msg = err.message || '';
      const isDetached = /frame was detached|connection closed|target closed|execution context was destroyed/i.test(msg);

      if (isDetached && attempt < maxAttempts) {
        try {
          if (!currentPage.isClosed()) {
            await currentPage.close();
          }
        } catch (_) {
          // ignore close errors
        }
        currentPage = await createConfiguredPage(browser);
        continue;
      }

      throw err;
    }
  }

  return currentPage;
}

/**
 * Scrapea deuda del servicio desde el sistema de autogestión de Irrigación.
 * Retorna { success, data: { titular, cuit, hectareas, capital, interes, apremio, eventuales, total, servicio }, pdfPath }
 */
async function obtenerDeudaYBoleto(dni) {
  const MAX_INTENTOS = 3;
  
  for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
    try {
      console.log(`🔄 Intento ${intento}/${MAX_INTENTOS} para obtenerDeudaYBoleto con DNI ${dni}`);
      const resultado = await _scrapeDeudaYBoleto(dni);
      return resultado;
    } catch (error) {
      console.error(`❌ Intento ${intento} falló:`, error.message);
      
      if (intento < MAX_INTENTOS) {
        // Esperar antes de reintentar (aumentar tiempo con cada intento)
        const espera = intento * 2000;
        console.log(`⏳ Esperando ${espera}ms antes de reintentar...`);
        await delay(espera);
      } else {
        // Último intento falló
        return {
          success: false,
          error: error.message
        };
      }
    }
  }
}

/**
 * Función interna que hace el scraping real
 */
async function _scrapeDeudaYBoleto(dni) {
  let browser;
  let browserData;
  let page;
  let shouldDiscardBrowser = false;
  const relativePdfPath = `/temp/${dni}.pdf`;
  const absolutePdfPath = path.join(DOWNLOAD_DIR, `${dni}.pdf`);

  try {
    // Auto-limpieza de archivos antiguos
    await cleanOldFiles();

    // Obtener browser del pool
    browserData = await browserPool.getBrowser();
    browser = browserData.browser;
    
    page = await createConfiguredPage(browser);

    console.log(`🔍 Navegando a ${BASE_URL_DNI}...`);
    page = await safeGoto(browser, page, BASE_URL_DNI, 2);

    // ============================================
    // PASO 1: Buscar input con placeholder "Ingresar DNI/CUIT"
    // ============================================
    console.log('📝 Buscando input de DNI/CUIT...');
    await page.waitForSelector('input[placeholder*="Ingresar DNI"], input[placeholder*="DNI/CUIT"], input[type="text"]', { timeout: 10000 });
    
    const inputSelector = 'input[placeholder*="Ingresar DNI"], input[placeholder*="DNI/CUIT"], input[type="text"]';
    await page.click(inputSelector, { clickCount: 3 });
    await page.type(inputSelector, String(dni), { delay: 100 });
    console.log(`✅ DNI ${dni} ingresado`);

    // ============================================
    // PASO 2: Click en "Buscar servicios asociados"
    // ============================================
    console.log('🔍 Buscando botón "Buscar servicios asociados"...');
    
    const buscarButton = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], a'));
      return buttons.find(btn => 
        /Buscar servicios asociados/i.test(btn.textContent || btn.value || '')
      );
    });
    
    if (!buscarButton || buscarButton.asElement() === null) {
      throw new Error('No se encontró botón "Buscar servicios asociados"');
    }
    
    await buscarButton.asElement().click();
    console.log('✅ Click en "Buscar servicios asociados"');
    
    await waitForAnyText(page, ['cuota anual', 'cuota bimestral', 'no se encontr', 'sin resultados'], 10000, 250).catch(() => {});

    // ============================================
    // PASO 3: Verificar que aparecieron los recuadros (Cuota Anual/Bimestral)
    // ============================================
    console.log('🔍 Esperando resultados...');
    
    const tieneResultados = await page.evaluate(() => {
      const bodyText = document.body.innerText.toLowerCase();
      return bodyText.includes('cuota anual') || bodyText.includes('cuota bimestral');
    });
    
    if (!tieneResultados) {
      const noEncontrado = await page.evaluate(() => {
        const bodyText = document.body.innerText.toLowerCase();
        return bodyText.includes('no se encontr') || bodyText.includes('sin resultados');
      });
      
      if (noEncontrado) {
        return { success: false, error: 'No encontramos ese DNI/CUIT en nuestra base de datos. Por favor verifica el número.' };
      }
      
      throw new Error('No se encontraron servicios asociados al DNI');
    }
    
    console.log('✅ Servicios encontrados');

    // ============================================
    // PASO 4: Click en "Consultar Deuda del Servicio"
    // ============================================
    console.log('🔍 Buscando botón "Consultar Deuda del Servicio"...');
    
    const consultarButton = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button, a'));
      return buttons.find(btn => 
        /Consultar Deuda del Servicio/i.test(btn.textContent || '')
      );
    });
    
    if (!consultarButton || consultarButton.asElement() === null) {
      throw new Error('No se encontró botón "Consultar Deuda del Servicio"');
    }
    
    // Click y esperar contenido sin depender de waitForNavigation
    await consultarButton.asElement().click();
    await page.waitForFunction(() => {
      const text = (document.body?.innerText || '').toLowerCase();
      return text.includes('titular') || text.includes('capital') || text.includes('cuota');
    }, { timeout: 12000, polling: 250 });
    
    console.log('✅ Navegó a página de detalle de deuda');

    // ============================================
    // PASO 5: Extraer datos de la página de cuenta corriente
    // ============================================
    console.log('📋 Extrayendo datos de deuda...');
    
    const datos = await page.evaluate(() => {
      const resultado = {
        titular: 'No disponible',
        cuit: 'No disponible',
        hectareas: 'No disponible',
        capital: 'No disponible',
        interes: 'No disponible',
        apremio: 'No disponible',
        eventuales: 'No disponible',
        total: 'No disponible'
      };
      
      const bodyText = document.body.innerText || '';
      
      // Extraer Titular (aparece en la línea siguiente a "Titular")
      const titularMatch = bodyText.match(/Titular\s*\n\s*([^\n]+)/i);
      if (titularMatch) {
        resultado.titular = titularMatch[1].trim();
      }
      
      // Extraer CUIT
      const cuitMatch = bodyText.match(/CUIT[:\s]*(\d{2}-\d{8}-\d{1}|\d{11})/i);
      if (cuitMatch) {
        resultado.cuit = cuitMatch[1];
      }
      
      // Extraer Hectáreas
      const hectareasMatch = bodyText.match(/Hectáreas[:\s]*(\d+[,.]?\d*)/i);
      if (hectareasMatch) {
        resultado.hectareas = hectareasMatch[1];
      }
      
      // Extraer montos
      const capitalMatch = bodyText.match(/Capital[:\s]*\$\s?([\d.,]+)/i);
      if (capitalMatch) resultado.capital = `$ ${capitalMatch[1]}`;
      
      const interesMatch = bodyText.match(/Interés[:\s]*\$\s?([\d.,]+)/i);
      if (interesMatch) resultado.interes = `$ ${interesMatch[1]}`;
      
      const apremioMatch = bodyText.match(/Apremio[:\s]*\$\s?([\d.,]+)/i);
      if (apremioMatch) resultado.apremio = `$ ${apremioMatch[1]}`;
      
      const eventualesMatch = bodyText.match(/Eventuales[:\s]*\$\s?([\d.,]+)/i);
      if (eventualesMatch) resultado.eventuales = `$ ${eventualesMatch[1]}`;
      
      const totalMatch = bodyText.match(/Total[:\s]*\$\s?([\d.,]+)/i);
      if (totalMatch) resultado.total = `$ ${totalMatch[1]}`;
      
      return resultado;
    });
    
    console.log('📋 Datos extraídos:', datos);

    // ============================================
    // PASO 6: Intentar descargar PDF (botón "Imprimir")
    // ============================================
    try {
      console.log('📄 Buscando botón de descarga/impresión...');
      const imprimirButton = await page.evaluateHandle(() => {
        const buttons = Array.from(document.querySelectorAll('button, a'));
        return buttons.find(btn => 
          /Imprimir|PDF|Descargar/i.test(btn.textContent || '')
        );
      });
      
      if (imprimirButton && imprimirButton.asElement() !== null) {
        await imprimirButton.asElement().click();
        console.log('✅ Click en botón de descarga');
        
        // Esperar la descarga
        const finalPath = await waitForDownload(DOWNLOAD_DIR, `${dni}.pdf`, DOWNLOAD_TIMEOUT_MS);
        console.log('✅ PDF descargado:', finalPath);
        
        return {
          success: true,
          data: datos,
          pdfPath: relativePdfPath,
          absolutePdfPath: finalPath
        };
      }
    } catch (pdfError) {
      console.warn('⚠️ No se pudo descargar el PDF:', pdfError.message);
    }

    // Retornar sin PDF si no se pudo descargar
    return {
      success: true,
      data: datos,
      pdfPath: null,
      absolutePdfPath: null
    };

  } catch (error) {
    const message = error.message || '';
    if (/frame was detached|protocol error: connection closed|execution context was destroyed|target closed/i.test(message)) {
      shouldDiscardBrowser = true;
    }
    console.error('❌ Error en _scrapeDeudaYBoleto:', error.message);
    console.error('Stack:', error.stack);
    throw error; // Re-lanzar para que el wrapper maneje los reintentos
  } finally {
    if (page && !page.isClosed()) {
      try {
        await page.close();
      } catch (closeError) {
        console.warn('⚠️ No se pudo cerrar la página:', closeError.message);
      }
    }
    // Devolver browser al pool
    if (browser && browserData) {
      if (shouldDiscardBrowser) {
        await browserPool.discardBrowser(browser);
      } else {
        await browserPool.releaseBrowser(browser);
      }
    }
  }
}

/**

/**
 * Click en el primer elemento que coincida con alguno de los textos indicados (case-insensitive)
 */
async function clickByText(page, texts) {
  // Usar evaluate + XPath en lugar de $x (deprecated en versiones recientes)
  const xpath = `//*[${texts
    .map((t) => `contains(translate(normalize-space(text()), '${t.toUpperCase()}', '${t.toUpperCase()}'), '${t.toUpperCase()}')`)
    .join(' or ')}]`;
  
  try {
    // Usar document.evaluate para encontrar el elemento
    const el = await page.evaluateHandle((xpathStr) => {
      const result = document.evaluate(xpathStr, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      return result.singleNodeValue;
    }, xpath);
    
    if (!el || el.asElement() === null) {
      throw new Error(`No se encontró elemento con texto: ${texts.join(' / ')}`);
    }
    
    await el.asElement().click();
    await new Promise(r => setTimeout(r, 500));
  } catch (error) {
    throw new Error(`Error al hacer click en texto "${texts.join(' / ')}": ${error.message}`);
  }
}

/**
 * Obtiene solo el boleto (sin navegar a página de deuda) - con reintentos
 */
async function obtenerSoloBoleto(dni, tipoCuota) {
  const MAX_INTENTOS = 3;
  
  for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
    try {
      console.log(`🔄 Intento ${intento}/${MAX_INTENTOS} para obtenerSoloBoleto con DNI ${dni}, tipo ${tipoCuota}`);
      const resultado = await _scrapeSoloBoleto(dni, tipoCuota);
      return resultado;
    } catch (error) {
      console.error(`❌ Intento ${intento} falló:`, error.message);
      
      if (intento < MAX_INTENTOS) {
        // Esperar antes de reintentar (aumentar tiempo con cada intento)
        const espera = intento * 2000;
        console.log(`⏳ Esperando ${espera}ms antes de reintentar...`);
        await delay(espera);
      } else {
        // Último intento falló
        return {
          success: false,
          error: error.message
        };
      }
    }
  }
}

/**
 * Función interna que hace el scraping real de boleto
 */
async function _scrapeSoloBoleto(dni, tipoCuota) {
  let browser;
  let browserData;
  
  try {
    // Obtener browser del pool
    browserData = await browserPool.getBrowser();
    browser = browserData.browser;
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    
    // ============================================
    // PASO 1: Navegar e ingresar DNI
    // ============================================
    console.log('🔍 Navegando a https://autogestion.cloud.irrigacion.gov.ar/dni...');
    await page.goto('https://autogestion.cloud.irrigacion.gov.ar/dni', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    console.log('📝 Buscando input de DNI/CUIT...');
    await page.waitForSelector('input[placeholder*="Ingresar DNI"], input[placeholder*="DNI/CUIT"], input[type="text"]', { timeout: 15000 });
    
    const inputSelector = 'input[placeholder*="Ingresar DNI"], input[placeholder*="DNI/CUIT"], input[type="text"]';
    await page.click(inputSelector, { clickCount: 3 });
    await page.type(inputSelector, String(dni), { delay: 100 });
    console.log(`✅ DNI ${dni} ingresado`);

    // ============================================
    // PASO 2: Click en "Buscar servicios asociados"
    // ============================================
    console.log('🔍 Buscando botón "Buscar servicios asociados"...');
    
    const buscarButton = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], a'));
      return buttons.find(btn => 
        /Buscar servicios asociados/i.test(btn.textContent || btn.value || '')
      );
    });
    
    if (!buscarButton || buscarButton.asElement() === null) {
      throw new Error('No se encontró botón "Buscar servicios asociados"');
    }
    
    await buscarButton.asElement().click();
    console.log('✅ Click en "Buscar servicios asociados"');
    
    await waitForAnyText(page, ['cuota anual', 'cuota bimestral', 'no se encontr', 'sin resultados'], 10000, 250).catch(() => {});

    // ============================================
    // PASO 3: Verificar que aparecieron los recuadros
    // ============================================
    console.log('🔍 Esperando resultados...');
    
    const tieneResultados = await page.evaluate(() => {
      const bodyText = document.body.innerText.toLowerCase();
      return bodyText.includes('cuota anual') || bodyText.includes('cuota bimestral');
    });
    
    if (!tieneResultados) {
      const noEncontrado = await page.evaluate(() => {
        const bodyText = document.body.innerText.toLowerCase();
        return bodyText.includes('no se encontr') || bodyText.includes('sin resultados');
      });
      
      if (noEncontrado) {
        return { success: false, error: 'No encontramos ese DNI/CUIT en nuestra base de datos. Por favor verifica el número.' };
      }
      
      throw new Error('No se encontraron servicios asociados al DNI');
    }
    
    console.log('✅ Servicios encontrados');

    // ============================================
    // PASO 4: Buscar y clickear botón "Imprimir" según tipo de cuota
    // ============================================
    console.log(`📄 Buscando botón "Imprimir" para ${tipoCuota}...`);
    
    // Buscar el botón Imprimir que está dentro del recuadro del tipo de cuota especificado
    const imprimirButton = await page.evaluateHandle((tipo) => {
      const bodyText = document.body.innerText;
      const buttons = Array.from(document.querySelectorAll('button'));
      
      // Buscar el texto del tipo de cuota
      const cuotaTexto = tipo === 'anual' ? 'Cuota Anual' : 'Cuota Bimestral';
      
      // Encontrar todos los botones "Imprimir"
      const imprimirButtons = buttons.filter(btn => 
        /Imprimir/i.test(btn.textContent || '')
      );
      
      // Si solo hay un botón imprimir, retornarlo
      if (imprimirButtons.length === 1) {
        return imprimirButtons[0];
      }
      
      // Si hay varios, buscar el que está en el contexto del tipo de cuota
      for (const btn of imprimirButtons) {
        let parent = btn.parentElement;
        let depth = 0;
        
        // Buscar en los padres hasta 5 niveles
        while (parent && depth < 5) {
          const parentText = parent.innerText || '';
          if (parentText.includes(cuotaTexto)) {
            return btn;
          }
          parent = parent.parentElement;
          depth++;
        }
      }
      
      // Si no encontramos por contexto, devolver el primero
      return imprimirButtons[0];
    }, tipoCuota);
    
    if (!imprimirButton || imprimirButton.asElement() === null) {
      throw new Error('No se encontró botón "Imprimir"');
    }
    
    // Configurar descarga de PDF
    const downloadPath = path.resolve(__dirname, '../../temp');
    if (!fs.existsSync(downloadPath)) {
      fs.mkdirSync(downloadPath, { recursive: true });
    }
    
    await page._client().send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: downloadPath
    });
    
    await imprimirButton.asElement().click();
    console.log('✅ Click en "Imprimir"');
    const pdfPath = await waitForDownload(downloadPath, `boleto_${tipoCuota}_${dni}.pdf`, DOWNLOAD_TIMEOUT_MS);
    console.log(`📄 PDF descargado: ${pdfPath}`);
    
    return {
      success: true,
      pdfPath: pdfPath
    };
    
  } catch (error) {
    console.error('❌ Error en _scrapeSoloBoleto:', error);
    throw error; // Re-lanzar para que el wrapper maneje los reintentos
  } finally {
    // Devolver browser al pool
    if (browser && browserData) {
      await browserPool.releaseBrowser(browser);
    }
  }
}

/**
 * Obtener deuda usando padrón (superficial, subterráneo o contaminación)
 * @param {string} tipoPadron - 'superficial', 'subterraneo' o 'contaminacion'
 * @param {object} datos - { codigoCauce, numeroPadron } | { codigoDepartamento, numeroPozo } | { numeroContaminacion }
 * @param {string} tipoOperacion - 'deuda' o 'boleto' (default: 'deuda')
 * @returns {object} { success, data, pdfPath, absolutePdfPath }
 */
async function obtenerDeudaPadron(tipoPadron, datos, tipoOperacion = 'deuda') {
  const MAX_INTENTOS = 3;
  
  for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
    try {
      console.log(`🔄 Intento ${intento}/${MAX_INTENTOS} para obtenerDeudaPadron ${tipoPadron}`);
      const resultado = await _scrapeDeudaYBoletoPadron(tipoPadron, datos, tipoOperacion);
      return resultado;
    } catch (error) {
      console.error(`❌ Intento ${intento} falló:`, error.message);
      
      if (intento < MAX_INTENTOS) {
        const espera = intento * 2000;
        console.log(`⏳ Esperando ${espera}ms antes de reintentar...`);
        await delay(espera);
      } else {
        return {
          success: false,
          error: error.message
        };
      }
    }
  }
}

/**
 * Función interna que hace el scraping con padrón
 */
async function _scrapeDeudaYBoletoPadron(tipoPadron, datos, tipoOperacion = 'deuda') {
  let browser;
  let browserData;
  let page;
  let shouldDiscardBrowser = false;
  const idPadron = `${tipoPadron}_${Object.values(datos).join('_')}`;
  const relativePdfPath = `/temp/${idPadron}.pdf`;
  const absolutePdfPath = path.join(DOWNLOAD_DIR, `${idPadron}.pdf`);

  try {
    await cleanOldFiles();

    // Obtener browser del pool
    browserData = await browserPool.getBrowser();
    browser = browserData.browser;
    
    page = await createConfiguredPage(browser);

    console.log(`🔍 Navegando a ${BASE_URL_SERVICIO}...`);
    page = await safeGoto(browser, page, BASE_URL_SERVICIO, 2);

    // Esperar a que la página cargue completamente
    console.log('⏳ Esperando a que cargue la página...');
    await page.waitForSelector('input[name="codigo1"], .mantine-Select-root, h5', { timeout: 12000 }).catch(() => {
      console.log('⚠️ Timeout esperando elementos de la página');
    });
    await page.waitForFunction(() => document.readyState === 'interactive' || document.readyState === 'complete', { timeout: 4000 }).catch(() => {});
    console.log('✅ Página cargada');

    // ============================================
    // PASO 1: Abrir dropdown y seleccionar tipo de padrón (A/B/C)
    // ============================================
    console.log('📝 Seleccionando tipo de padrón (A/B/C)...');
    
    // El selector tiene opciones A, B, C
    const tipoCodigo = tipoPadron === 'superficial' ? 'A' :
                       tipoPadron === 'subterraneo' ? 'B' :
                       tipoPadron === 'contaminacion' ? 'C' : 'A';
    
    const tipoNombre = tipoPadron === 'superficial' ? 'Superficial' :
                       tipoPadron === 'subterraneo' ? 'Subterráneo' :
                       tipoPadron === 'contaminacion' ? 'Contaminación' : 'Superficial';
    
    console.log(`🔍 Buscando dropdown "Selecciona una opción" para elegir: ${tipoCodigo} - ${tipoNombre}`);
    
    // Paso 1: Hacer clic en el input del dropdown para abrirlo
    const dropdownFound = await page.evaluate(() => {
      // Buscar todos los inputs de tipo select de Mantine
      const selects = Array.from(document.querySelectorAll('.mantine-Select-input'));
      console.log(`📝 Total selects Mantine encontrados: ${selects.length}`);
      
      // El segundo select es el de tipo de servicio (A/B/C)
      // El primero es "Cuota Vigente / Tengo un Boleto"
      if (selects.length >= 2) {
        const targetSelect = selects[1]; // Segundo select
        console.log('✅ Encontrado select de tipo servicio (segundo), haciendo clic...');
        targetSelect.click();
        targetSelect.focus();
        return true;
      }
      
      console.log('❌ No se encontraron suficientes selects');
      return false;
    });
    
    if (!dropdownFound) {
      // Capturar screenshot y HTML para debug
      const timestamp = Date.now();
      await page.screenshot({ path: path.join(DOWNLOAD_DIR, `debug_dropdown_${timestamp}.png`) });
      const htmlContent = await page.content();
      await fsp.writeFile(path.join(DOWNLOAD_DIR, `debug_dropdown_${timestamp}.html`), htmlContent, 'utf-8');
      console.log(`📸 Screenshot y HTML guardados para debug`);
      throw new Error('No se encontró el dropdown de tipo de servicio');
    }
    
    await new Promise(r => setTimeout(r, 1000));
    
    // Paso 2: Hacer clic en la opción correcta (A, B o C)
    const optionClicked = await page.evaluate((tipoCode, tipoNom) => {
      // Buscar la opción en el dropdown abierto
      const options = Array.from(document.querySelectorAll('[role="option"], .mantine-Select-option, div[data-combobox-option]'));
      console.log(`🔍 Encontradas ${options.length} opciones en el dropdown`);
      
      options.forEach((opt, idx) => {
        console.log(`  Opción ${idx}: ${opt.textContent?.substring(0, 50)}`);
      });
      
      const targetOption = options.find(opt => {
        const text = opt.textContent || '';
        return text.includes(tipoCode) && (text.includes('Superficial') || text.includes('Subterráneo') || text.includes('Contaminación'));
      });
      
      if (targetOption) {
        console.log(`✅ Encontrada opción: ${targetOption.textContent}`);
        targetOption.click();
        return true;
      }
      
      console.log(`❌ No se encontró opción ${tipoCode} - ${tipoNom}`);
      return false;
    }, tipoCodigo, tipoNombre);
    
    if (!optionClicked) {
      // Capturar screenshot para debug
      const timestamp = Date.now();
      await page.screenshot({ path: path.join(DOWNLOAD_DIR, `debug_dropdown_open_${timestamp}.png`) });
      console.log(`📸 Screenshot del dropdown abierto guardado`);
      throw new Error(`No se pudo seleccionar la opción ${tipoCodigo} - ${tipoNombre}`);
    }
    
    console.log(`✅ Opción seleccionada: ${tipoCodigo} - ${tipoNombre}`);
    await page.waitForSelector('input[name="codigo1"]', { timeout: 5000 }).catch(() => {});

    // ============================================
    // PASO 2: Llenar campos según el tipo de padrón
    // ============================================
    // PASO 2: Llenar campos según el tipo de padrón
    // ============================================
    console.log(`📝 Llenando campos para padrón tipo ${tipoPadron}...`);
    
    // Esperar a que aparezcan los inputs después de seleccionar el tipo
    // Los inputs tienen clase mantine-Input-input y nombres codigo1, codigo2
    await page.waitForSelector('input[name="codigo1"]', { timeout: 5000 }).catch(() => {
      console.log('⚠️ No se encontró input codigo1...');
    });
    
    if (tipoPadron === 'superficial') {
      // Campos: código de cauce (codigo1), padrón parcial (codigo2)
      await page.evaluate((codigoCauce, numeroPadron) => {
        const input1 = document.querySelector('input[name="codigo1"]');
        const input2 = document.querySelector('input[name="codigo2"]');
        if (input1) {
          input1.focus();
          input1.value = '';
          input1.value = codigoCauce;
          input1.dispatchEvent(new Event('focus', { bubbles: true }));
          input1.dispatchEvent(new Event('input', { bubbles: true }));
          input1.dispatchEvent(new Event('change', { bubbles: true }));
          input1.dispatchEvent(new Event('blur', { bubbles: true }));
          input1.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
        }
        if (input2) {
          input2.focus();
          input2.value = '';
          input2.value = numeroPadron;
          input2.dispatchEvent(new Event('focus', { bubbles: true }));
          input2.dispatchEvent(new Event('input', { bubbles: true }));
          input2.dispatchEvent(new Event('change', { bubbles: true }));
          input2.dispatchEvent(new Event('blur', { bubbles: true }));
          input2.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
        }
      }, datos.codigoCauce, datos.numeroPadron);
      console.log(`✅ Código de cauce ingresado: ${datos.codigoCauce}`);
      console.log(`✅ Padrón parcial ingresado: ${datos.numeroPadron}`);
      
    } else if (tipoPadron === 'subterraneo') {
      // Campos: código de departamento (codigo1), N° de pozo (codigo2)
      await page.evaluate((codigoDpto, numeroPozo) => {
        const input1 = document.querySelector('input[name="codigo1"]');
        const input2 = document.querySelector('input[name="codigo2"]');
        if (input1) {
          input1.focus();
          input1.value = '';
          input1.value = codigoDpto;
          input1.dispatchEvent(new Event('focus', { bubbles: true }));
          input1.dispatchEvent(new Event('input', { bubbles: true }));
          input1.dispatchEvent(new Event('change', { bubbles: true }));
          input1.dispatchEvent(new Event('blur', { bubbles: true }));
          input1.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
        }
        if (input2) {
          input2.focus();
          input2.value = '';
          input2.value = numeroPozo;
          input2.dispatchEvent(new Event('focus', { bubbles: true }));
          input2.dispatchEvent(new Event('input', { bubbles: true }));
          input2.dispatchEvent(new Event('change', { bubbles: true }));
          input2.dispatchEvent(new Event('blur', { bubbles: true }));
          input2.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
        }
      }, datos.codigoDepartamento, datos.numeroPozo);
      console.log(`✅ Código de departamento ingresado: ${datos.codigoDepartamento}`);
      console.log(`✅ N° de pozo ingresado: ${datos.numeroPozo}`);
      
    } else if (tipoPadron === 'contaminacion') {
      // Campo: N° de contaminación (solo codigo1)
      await page.evaluate((numeroContam) => {
        const input1 = document.querySelector('input[name="codigo1"]');
        if (input1) {
          input1.focus();
          input1.value = '';
          input1.value = numeroContam;
          input1.dispatchEvent(new Event('focus', { bubbles: true }));
          input1.dispatchEvent(new Event('input', { bubbles: true }));
          input1.dispatchEvent(new Event('change', { bubbles: true }));
          input1.dispatchEvent(new Event('blur', { bubbles: true }));
          input1.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
        }
      }, datos.numeroContaminacion);
      console.log(`✅ N° de contaminación ingresado: ${datos.numeroContaminacion}`);
    }
    
    // Esperar a que se habilite el botón
    await page.waitForFunction(() => {
      const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'));
      const buscarBtn = buttons.find(btn => /Buscar/i.test(btn.textContent || btn.value || ''));
      if (!buscarBtn) return false;
      return !buscarBtn.hasAttribute('disabled') && buscarBtn.getAttribute('aria-disabled') !== 'true' && !buscarBtn.disabled;
    }, { timeout: 7000, polling: 250 }).catch(() => {});

    // ============================================
    // PASO 3: Según la operación, hacer click en diferente botón
    // ============================================
    if (tipoOperacion === 'deuda') {
      // Para DEUDA: buscar y hacer clic en "Consultar Deuda"
      console.log('🔍 Buscando botón "Consultar Deuda"...');
      
      const consultarButton = await page.evaluateHandle(() => {
        const buttons = Array.from(document.querySelectorAll('button, a, input[type="submit"]'));
        return buttons.find(btn => 
          /Consultar Deuda/i.test(btn.textContent || btn.value || '')
        );
      });
      
      if (!consultarButton || consultarButton.asElement() === null) {
        throw new Error('No se encontró botón "Consultar Deuda"');
      }
      
      await consultarButton.asElement().click();
      console.log('✅ Click en "Consultar Deuda"');
      const timestamp = Date.now();
      
      if (SCRAPER_DEBUG) {
        const screenshotPath = path.join(DOWNLOAD_DIR, `debug_deuda_${timestamp}.png`);
        await page.screenshot({ path: screenshotPath });
        console.log(`📸 Screenshot guardado: ${screenshotPath}`);
      }
      
      // Esperar a que carguen los datos
      await page.waitForFunction(() => {
        const text = (document.body?.innerText || '').toLowerCase();
        return text.includes('titular') || text.includes('capital') || text.includes('cuota');
      }, { timeout: 15000 }).catch(() => {
        console.log('⚠️ Timeout esperando datos, continuando...');
      });
      
      console.log('✅ Datos de deuda cargados');
      
      if (SCRAPER_DEBUG) {
        const pageContent = await page.content();
        const htmlPath = path.join(DOWNLOAD_DIR, `debug_deuda_${timestamp}.html`);
        await fsp.writeFile(htmlPath, pageContent, 'utf-8');
        console.log(`💾 HTML guardado: ${htmlPath}`);
      }
      
      // Extraer datos de deuda
      const deudaData = await page.evaluate(() => {
        const resultado = {
          titular: 'No disponible',
          cuit: 'No disponible',
          hectareas: 'No disponible',
          capital: 'No disponible',
          interes: 'No disponible',
          apremio: 'No disponible',
          eventuales: 'No disponible',
          total: 'No disponible'
        };
        
        const bodyText = document.body.innerText || '';
        
        // Debug: Log primeras 2000 caracteres
        console.log('DEBUG - Primeros 2000 caracteres:', bodyText.substring(0, 2000));
        
        const titularMatch = bodyText.match(/Titular\s*\n\s*([^\n]+)/i);
        if (titularMatch) {
          resultado.titular = titularMatch[1].trim();
        }
        
        const cuitMatch = bodyText.match(/CUIT[:\s]*(\d{2}-\d{8}-\d{1}|\d{11})/i);
        if (cuitMatch) {
          resultado.cuit = cuitMatch[1];
        }
        
        const hectareasMatch = bodyText.match(/Hectáreas[:\s]*(\d+[,.]?\d*)/i);
        if (hectareasMatch) {
          resultado.hectareas = hectareasMatch[1];
        }
        
        const capitalMatch = bodyText.match(/Capital[:\s]*\$\s?([\d.,]+)/i);
        if (capitalMatch) resultado.capital = `$ ${capitalMatch[1]}`;
        
        const interesMatch = bodyText.match(/Interés[:\s]*\$\s?([\d.,]+)/i);
        if (interesMatch) resultado.interes = `$ ${interesMatch[1]}`;
        
        const apremioMatch = bodyText.match(/Apremio[:\s]*\$\s?([\d.,]+)/i);
        if (apremioMatch) resultado.apremio = `$ ${apremioMatch[1]}`;
        
        const eventualesMatch = bodyText.match(/Eventuales[:\s]*\$\s?([\d.,]+)/i);
        if (eventualesMatch) resultado.eventuales = `$ ${eventualesMatch[1]}`;
        
        const totalMatch = bodyText.match(/Total[:\s]*\$\s?([\d.,]+)/i);
        if (totalMatch) resultado.total = `$ ${totalMatch[1]}`;
        
        return resultado;
      });
      
      console.log('📋 Datos extraídos:', deudaData);
      
      // Cerrar el browser para liberar RAM después de consultar deuda
      try {
        await browserPool.discardBrowser(browser);
        console.log('🗑️ Browser cerrado para liberar RAM');
      } catch (err) {
        console.error('⚠️ Error cerrando browser:', err.message);
      }
      
      return {
        success: true,
        data: deudaData,
        pdfPath: null,
        absolutePdfPath: null
      };
      
    } else {
      // Para BOLETO: buscar y hacer clic en "Buscar"
      console.log('🔍 Buscando botón "Buscar" para boleto...');
      
      // Buscar el botón "Buscar" y clickearlo usando page.click() que es más confiable
      console.log('🔍 Buscando botón "Buscar" para boleto...');
      
      try {
        // Primero intenta con un selector específico para botones que dicen "Buscar"
        await page.click('button:has-text("Buscar"):not(:has-text("Buscar por"))', { timeout: 5000 }).catch(async () => {
          // Si falla, busca cualquier botón que contenga "Buscar" pero no "Buscar por"
          const buscarBtn = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            return buttons.findIndex(btn => {
              const text = (btn.textContent || '').trim();
              return text === 'Buscar';
            });
          });
          
          if (buscarBtn === -1) {
            throw new Error('No se encontró botón "Buscar"');
          }
          
          // Usar evaluateHandle para clickear
          const btnHandle = await page.$$('button');
          await btnHandle[buscarBtn].click();
        });
        
        console.log('✅ Click en "Buscar" ejecutado');
      } catch (err) {
        console.error('❌ Error al hacer click en "Buscar":', err.message);
        throw new Error(`No se pudo hacer click en botón "Buscar": ${err.message}`);
      }
      
      // PASO CRÍTICO: Esperar a que la página se actualice
      console.log('⏳ Esperando que la página se actualice...');
      
      try {
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {
          // Si no hay navegación, esperar a cambios en el DOM
          console.log('📄 Sin navegación, esperando cambios en el DOM...');
        });
      } catch (err) {
        console.log('⚠️ Timeout en waitForNavigation, continuando...');
      }
      
      // Esperar a que aparezcan los botones de Imprimir
      await page.waitForFunction(() => {
        const buttons = Array.from(document.querySelectorAll('button, a, input[type="submit"]'));
        const imprimirButtons = buttons.filter(btn => 
          /Imprimir/i.test(btn.textContent || btn.value || '')
        );
        return imprimirButtons.length > 0;
      }, { timeout: 15000, polling: 500 }).catch(() => {
        console.log('⚠️ Timeout esperando botones de Imprimir');
      });
      
      console.log('✅ Botones de Imprimir detectados');
      
      // Capturar screenshot DESPUÉS de que carguen los botones
      const timestamp = Date.now();
      
      if (SCRAPER_DEBUG) {
        const screenshotPath = path.join(DOWNLOAD_DIR, `debug_boleto_${timestamp}.png`);
        await page.screenshot({ path: screenshotPath });
        console.log(`📸 Screenshot guardado: ${screenshotPath}`);
        
        const pageContent = await page.content();
        const htmlPath = path.join(DOWNLOAD_DIR, `debug_boleto_${timestamp}.html`);
        await fsp.writeFile(htmlPath, pageContent, 'utf-8');
        console.log(`💾 HTML guardado: ${htmlPath}`);
      }
      
      // Buscar el botón Imprimir y clickearlo - con debug detallado
      const imprimirClicked = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, a, input[type="submit"], div[role="button"]'));
        
        // Debug: listar todos los botones
        console.log(`🔍 Total de botones encontrados: ${buttons.length}`);
        buttons.forEach((btn, idx) => {
          const text = (btn.textContent || btn.value || '').trim();
          const title = btn.getAttribute('title') || '';
          const ariaLabel = btn.getAttribute('aria-label') || '';
          console.log(`  [${idx}] text:"${text.substring(0, 30)}" | title:"${title}" | aria-label:"${ariaLabel}" | visible: ${btn.offsetParent !== null} | tag: ${btn.tagName}`);
        });
        
        // Buscar primero por Imprimir en el texto
        let imprimirBtn = buttons.find(btn => 
          /Imprimir/i.test(btn.textContent || btn.value || '')
        );
        
        if (imprimirBtn) {
          console.log(`✅ Encontrado botón Imprimir por texto: ${imprimirBtn.textContent}`);
          imprimirBtn.click();
          return true;
        }
        
        // Si no encuentra por texto, buscar por título o aria-label
        imprimirBtn = buttons.find(btn => {
          const title = btn.getAttribute('title') || '';
          const ariaLabel = btn.getAttribute('aria-label') || '';
          return /Imprimir|PDF|Descargar|Print/i.test(title) || 
                 /Imprimir|PDF|Descargar|Print/i.test(ariaLabel);
        });
        
        if (imprimirBtn) {
          console.log(`✅ Encontrado botón Imprimir por atributo: title="${imprimirBtn.getAttribute('title')}" aria-label="${imprimirBtn.getAttribute('aria-label')}"`);
          imprimirBtn.click();
          return true;
        }
        
        // Último recurso: buscar botones vacíos o muy pequeños que estén en la zona de resultados
        // Los botones de Imprimir/Pagar podrían ser los primeros botones sin texto después de un cierto punto
        const emptyButtons = buttons.filter(btn => {
          const text = (btn.textContent || btn.value || '').trim();
          return text === '' && btn.offsetParent !== null && btn.tagName === 'BUTTON';
        });
        
        console.log(`🔍 Encontrados ${emptyButtons.length} botones vacíos`);
        
        if (emptyButtons.length >= 2) {
          // El primero debería ser Imprimir (por lo general)
          const firstEmptyBtn = emptyButtons[0];
          console.log(`✅ Clickeando primer botón vacío (asumiendo Imprimir)`);
          firstEmptyBtn.click();
          return true;
        }
        
        if (emptyButtons.length >= 1) {
          console.log(`✅ Clickeando el único botón vacío encontrado`);
          emptyButtons[0].click();
          return true;
        }
        
        console.log('❌ No se encontró ningún botón de Imprimir/PDF');
        return false;
      });
      
      if (!imprimirClicked) {
        // Listar botones disponibles para debug
        const availableButtons = await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button, a, input[type="submit"], div[role="button"]'));
          return buttons.map(b => ({
            text: (b.textContent || b.value || '').trim().substring(0, 60),
            visible: b.offsetParent !== null,
            tag: b.tagName
          })).filter(b => b.visible);
        });
        
        console.log('🔍 Botones visibles en el momento del error:', JSON.stringify(availableButtons, null, 2));
        throw new Error('No se pudo hacer click en el botón Imprimir');
      }
      
      console.log('✅ Click en botón Imprimir');
      const finalPdfName = `${idPadron}_${datos.tipoCuota || 'boleto'}.pdf`;
      const finalPath = await waitForDownload(DOWNLOAD_DIR, finalPdfName, DOWNLOAD_TIMEOUT_MS);
      
      console.log(`📄 PDF descargado y renombrado: ${finalPath}`);
      
      // Cerrar browser para liberar RAM
      try {
        await browserPool.discardBrowser(browser);
        console.log('🗑️ Browser cerrado para liberar RAM');
      } catch (err) {
        console.error('⚠️ Error cerrando browser:', err.message);
      }
      
      return {
        success: true,
        pdfPath: finalPath,
        relativePdfPath: `/temp/${path.basename(finalPath)}`
      };
    }
    
    /*
    // CÓDIGO VIEJO - YA NO SE EJECUTA
    await new Promise(r => setTimeout(r, 1200));
    await page.waitForFunction(() => {
      const text = (document.body?.innerText || '').toLowerCase();
      return text.includes('titular') || text.includes('capital') || text.includes('cuota');
    }, { timeout: 15000 });
    
    console.log('✅ Navegó a página de detalle de deuda');

    // ============================================
    // PASO 6: Extraer datos de la página de deuda
    // ============================================
    console.log('📋 Extrayendo datos de deuda...');
    
    await new Promise(r => setTimeout(r, 3000));
    
    const datos_deuda = await page.evaluate(() => {
      const resultado = {
        titular: 'No disponible',
        cuit: 'No disponible',
        hectareas: 'No disponible',
        capital: 'No disponible',
        interes: 'No disponible',
        apremio: 'No disponible',
        eventuales: 'No disponible',
        total: 'No disponible'
      };
      
      const bodyText = document.body.innerText || '';
      
      const titularMatch = bodyText.match(/Titular\s*\n\s*([^\n]+)/i);
      if (titularMatch) {
        resultado.titular = titularMatch[1].trim();
      }
      
      const cuitMatch = bodyText.match(/CUIT[:\s]*(\d{2}-\d{8}-\d{1}|\d{11})/i);
      if (cuitMatch) {
        resultado.cuit = cuitMatch[1];
      }
      
      const hectareasMatch = bodyText.match(/Hectáreas[:\s]*(\d+[,.]?\d*)/i);
      if (hectareasMatch) {
        resultado.hectareas = hectareasMatch[1];
      }
      
      const capitalMatch = bodyText.match(/Capital[:\s]*\$\s?([\d.,]+)/i);
      if (capitalMatch) resultado.capital = `$ ${capitalMatch[1]}`;
      
      const interesMatch = bodyText.match(/Interés[:\s]*\$\s?([\d.,]+)/i);
      if (interesMatch) resultado.interes = `$ ${interesMatch[1]}`;
      
      const apremioMatch = bodyText.match(/Apremio[:\s]*\$\s?([\d.,]+)/i);
      if (apremioMatch) resultado.apremio = `$ ${apremioMatch[1]}`;
      
      const eventualesMatch = bodyText.match(/Eventuales[:\s]*\$\s?([\d.,]+)/i);
      if (eventualesMatch) resultado.eventuales = `$ ${eventualesMatch[1]}`;
      
      const totalMatch = bodyText.match(/Total[:\s]*\$\s?([\d.,]+)/i);
      if (totalMatch) resultado.total = `$ ${totalMatch[1]}`;
      
      return resultado;
    });
    
    console.log('📋 Datos extraídos:', datos_deuda);

    // ============================================
    // PASO 7: Intentar descargar PDF
    // ============================================
    try {
      console.log('📄 Buscando botón de descarga/impresión...');
      const imprimirButton = await page.evaluateHandle(() => {
        const buttons = Array.from(document.querySelectorAll('button, a'));
        return buttons.find(btn => 
          /Imprimir|PDF|Descargar/i.test(btn.textContent || '')
        );
      });
      
      if (imprimirButton && imprimirButton.asElement() !== null) {
        await imprimirButton.asElement().click();
        console.log('✅ Click en botón de descarga');
        
        const finalPath = await waitForDownload(DOWNLOAD_DIR, `${idPadron}.pdf`, DOWNLOAD_TIMEOUT_MS);
        console.log('✅ PDF descargado:', finalPath);
        
        return {
          success: true,
          data: datos_deuda,
          pdfPath: relativePdfPath,
          absolutePdfPath: finalPath
        };
      }
    } catch (pdfError) {
      console.warn('⚠️ No se pudo descargar el PDF:', pdfError.message);
    }

    return {
      success: true,
      data: datos_deuda,
      pdfPath: null,
      absolutePdfPath: null
    };
    */

  } catch (error) {
    const message = error.message || '';
    if (/frame was detached|protocol error: connection closed|execution context was destroyed|target closed/i.test(message)) {
      shouldDiscardBrowser = true;
    }
    console.error('❌ Error en _scrapeDeudaYBoletoPadron:', error.message);
    console.error('Stack:', error.stack);
    throw error;
  } finally {
    if (page && !page.isClosed()) {
      try {
        await page.close();
      } catch (closeError) {
        console.warn('⚠️ No se pudo cerrar la página:', closeError.message);
      }
    }
    // Devolver browser al pool
    if (browser && browserData) {
      if (shouldDiscardBrowser) {
        await browserPool.discardBrowser(browser);
      } else {
        await browserPool.releaseBrowser(browser);
      }
    }
  }
}

/**
 * Obtener boleto usando padrón
 * @param {string} tipoPadron - 'superficial', 'subterraneo' o 'contaminacion'
 * @param {object} datos - Parámetros del padrón
 * @param {string} tipoCuota - 'anual' o 'bimestral'
 * @returns {object} { success, pdfPath }
 */
async function obtenerBoletoPadron(tipoPadron, datos, tipoCuota) {
  const MAX_INTENTOS = 3;
  
  for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
    try {
      console.log(`🔄 Intento ${intento}/${MAX_INTENTOS} para obtenerBoletoPadron ${tipoPadron} - ${tipoCuota}`);
      // Usar la MISMA función que funciona para deuda, pero con tipoOperacion='boleto'
      const resultado = await _scrapeDeudaYBoletoPadron(tipoPadron, datos, 'boleto');
      return resultado;
    } catch (error) {
      console.error(`❌ Intento ${intento} falló:`, error.message);
      
      if (intento < MAX_INTENTOS) {
        const espera = intento * 2000;
        console.log(`⏳ Esperando ${espera}ms antes de reintentar...`);
        await delay(espera);
      } else {
        return {
          success: false,
          error: error.message
        };
      }
    }
  }
}

/**
 * Scraping interno de boleto con padrón
 */
async function _scrapeBoletonPadron(tipoPadron, datos, tipoCuota) {
  let browser;
  let browserData;
  let page;
  let shouldDiscardBrowser = false;
  const idBoleto = `boleto_${tipoPadron}_${tipoCuota}_${Object.values(datos).join('_')}`;
  const downloadPath = DOWNLOAD_DIR;

  try {
    await cleanOldFiles();

    // Obtener browser del pool
    browserData = await browserPool.getBrowser();
    browser = browserData.browser;
    
    page = await createConfiguredPage(browser);

    console.log(`🔍 Navegando a ${BASE_URL_SERVICIO}...`);
    page = await safeGoto(browser, page, BASE_URL_SERVICIO, 2);

    // Esperar a que la página cargue completamente
    console.log('⏳ Esperando a que cargue la página...');
    await page.waitForSelector('input[name="codigo1"], .mantine-Select-root', { timeout: 15000 }).catch(() => {
      console.log('⚠️ Timeout esperando elementos de la página');
    });
    
    await new Promise(r => setTimeout(r, 4000));
    console.log('✅ Página cargada');

    // ============================================
    // DEBUG: Verificar estado actual de la página
    // ============================================
    console.log('🔍 DEBUG: Verificando estado de selects en la página...');
    const selectsDebug = await page.evaluate(() => {
      const selects = Array.from(document.querySelectorAll('.mantine-Select-input'));
      const allInputs = Array.from(document.querySelectorAll('input[name="codigo1"], input[name="codigo2"]'));
      const allButtons = Array.from(document.querySelectorAll('button, input[type="submit"]'));
      
      return {
        totalSelects: selects.length,
        selectsText: selects.map(s => s.textContent?.trim() || 'VACIO').slice(0, 3),
        inputsPresentes: allInputs.length,
        inputsDisabled: allInputs.filter(i => i.disabled).length,
        buttons: allButtons.map(b => ({
          text: (b.textContent || b.value || '').substring(0, 30),
          disabled: b.disabled || b.hasAttribute('disabled')
        })).slice(0, 5)
      };
    });
    console.log('📊 Estado inicial:', JSON.stringify(selectsDebug, null, 2));

    // ============================================
    // PASO 1: Abrir dropdown y seleccionar tipo de padrón (A/B/C)
    // ============================================
    console.log('📝 Seleccionando tipo de padrón (A/B/C)...');
    
    const tipoCodigo = tipoPadron === 'superficial' ? 'A' :
                       tipoPadron === 'subterraneo' ? 'B' :
                       tipoPadron === 'contaminacion' ? 'C' : 'A';
    
    const tipoNombre = tipoPadron === 'superficial' ? 'Superficial' :
                       tipoPadron === 'subterraneo' ? 'Subterráneo' :
                       tipoPadron === 'contaminacion' ? 'Contaminación' : 'Superficial';
    
    console.log(`🔍 Buscando dropdown para elegir: ${tipoCodigo} - ${tipoNombre}`);
    
    // Hacer clic en el segundo select (tipo de servicio)
    const dropdownFound = await page.evaluate(() => {
      const selects = Array.from(document.querySelectorAll('.mantine-Select-input'));
      console.log(`📝 Total selects encontrados: ${selects.length}`);
      
      if (selects.length >= 2) {
        const targetSelect = selects[1]; // Segundo select = tipo servicio
        console.log('✅ Encontrado select de tipo servicio, haciendo clic...');
        targetSelect.click();
        targetSelect.focus();
        return true;
      }
      
      console.log('❌ No se encontraron suficientes selects');
      return false;
    });
    
    if (!dropdownFound) {
      const timestamp = Date.now();
      await page.screenshot({ path: path.join(DOWNLOAD_DIR, `debug_dropdown_boleto_${timestamp}.png`) });
      const htmlContent = await page.content();
      fs.writeFileSync(path.join(DOWNLOAD_DIR, `debug_dropdown_boleto_${timestamp}.html`), htmlContent, 'utf-8');
      console.log(`📸 Screenshot guardado para debug`);
      throw new Error('No se encontró el dropdown de tipo de servicio');
    }
    
    await new Promise(r => setTimeout(r, 1000));
    
    // Hacer clic en la opción correcta (A, B o C)
    const optionClicked = await page.evaluate((tipoCode, tipoNom) => {
      const options = Array.from(document.querySelectorAll('[role="option"], .mantine-Select-option, div[data-combobox-option]'));
      console.log(`🔍 Encontradas ${options.length} opciones`);
      
      const targetOption = options.find(opt => {
        const text = opt.textContent || '';
        return text.includes(tipoCode);
      });
      
      if (targetOption) {
        console.log(`✅ Encontrada opción: ${targetOption.textContent}`);
        targetOption.click();
        return true;
      }
      
      return false;
    }, tipoCodigo, tipoNombre);
    
    if (!optionClicked) {
      const timestamp = Date.now();
      await page.screenshot({ path: path.join(DOWNLOAD_DIR, `debug_option_boleto_${timestamp}.png`) });
      throw new Error(`No se pudo seleccionar la opción ${tipoCodigo}`);
    }
    
    console.log(`✅ Opción seleccionada: ${tipoCodigo} - ${tipoNombre}`);
    await new Promise(r => setTimeout(r, 1500));

    // ============================================
    // PASO 2: Llenar campos según el tipo de padrón
    // ============================================
    console.log(`📝 Llenando campos para padrón tipo ${tipoPadron}...`);
    
    await page.waitForSelector('input[name="codigo1"]', { timeout: 5000 }).catch(() => {
      console.log('⚠️ No se encontró input codigo1');
    });
    
    await new Promise(r => setTimeout(r, 500));
    
    if (tipoPadron === 'superficial') {
      await page.evaluate((codigoCauce, numeroPadron) => {
        const input1 = document.querySelector('input[name="codigo1"]');
        const input2 = document.querySelector('input[name="codigo2"]');
        if (input1) {
          input1.focus();
          input1.value = '';
          input1.value = codigoCauce;
          input1.dispatchEvent(new Event('focus', { bubbles: true }));
          input1.dispatchEvent(new Event('input', { bubbles: true }));
          input1.dispatchEvent(new Event('change', { bubbles: true }));
          input1.dispatchEvent(new Event('blur', { bubbles: true }));
          input1.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
        }
        if (input2) {
          input2.focus();
          input2.value = '';
          input2.value = numeroPadron;
          input2.dispatchEvent(new Event('focus', { bubbles: true }));
          input2.dispatchEvent(new Event('input', { bubbles: true }));
          input2.dispatchEvent(new Event('change', { bubbles: true }));
          input2.dispatchEvent(new Event('blur', { bubbles: true }));
          input2.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
        }
      }, datos.codigoCauce, datos.numeroPadron);
      console.log(`✅ Campos llenados: Cauce=${datos.codigoCauce}, Padrón=${datos.numeroPadron}`);
    } else if (tipoPadron === 'subterraneo') {
      await page.evaluate((codigoDpto, numeroPozo) => {
        const input1 = document.querySelector('input[name="codigo1"]');
        const input2 = document.querySelector('input[name="codigo2"]');
        if (input1) {
          input1.focus();
          input1.value = '';
          input1.value = codigoDpto;
          input1.dispatchEvent(new Event('focus', { bubbles: true }));
          input1.dispatchEvent(new Event('input', { bubbles: true }));
          input1.dispatchEvent(new Event('change', { bubbles: true }));
          input1.dispatchEvent(new Event('blur', { bubbles: true }));
          input1.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
        }
        if (input2) {
          input2.focus();
          input2.value = '';
          input2.value = numeroPozo;
          input2.dispatchEvent(new Event('focus', { bubbles: true }));
          input2.dispatchEvent(new Event('input', { bubbles: true }));
          input2.dispatchEvent(new Event('change', { bubbles: true }));
          input2.dispatchEvent(new Event('blur', { bubbles: true }));
          input2.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
        }
      }, datos.codigoDepartamento, datos.numeroPozo);
      console.log(`✅ Campos llenados: Dpto=${datos.codigoDepartamento}, Pozo=${datos.numeroPozo}`);
    } else if (tipoPadron === 'contaminacion') {
      await page.evaluate((numeroContam) => {
        const input1 = document.querySelector('input[name="codigo1"]');
        if (input1) {
          input1.focus();
          input1.value = '';
          input1.value = numeroContam;
          input1.dispatchEvent(new Event('focus', { bubbles: true }));
          input1.dispatchEvent(new Event('input', { bubbles: true }));
          input1.dispatchEvent(new Event('change', { bubbles: true }));
          input1.dispatchEvent(new Event('blur', { bubbles: true }));
          input1.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
        }
      }, datos.numeroContaminacion);
      console.log(`✅ Campo llenado: Contaminación=${datos.numeroContaminacion}`);
    }

    // Esperar más tiempo para que React procese y los botones se habiliten
    // Esto también ayuda a evitar reCAPTCHA - hacemos que parezca más natural
    console.log('⏳ Esperando a que React procese los cambios (para evitar reCAPTCHA)...');
    await new Promise(r => setTimeout(r, 3000));

    // ============================================
    // PASO 3: Esperar activamente a que el botón "Buscar" se habilite
    // ============================================
    console.log('⏳ Esperando a que el botón "Buscar" se habilite...');
    
    try {
      await page.waitForFunction(() => {
        const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'));
        const buscarBtn = buttons.find(btn => {
          const text = btn.textContent?.trim() || btn.value || '';
          return /Buscar/i.test(text);
        });
        
        if (!buscarBtn) return false;
        
        const isEnabled = !buscarBtn.hasAttribute('disabled') && 
                         buscarBtn.getAttribute('aria-disabled') !== 'true' &&
                         !buscarBtn.disabled;
        
        if (isEnabled) {
          console.log('✅ Botón Buscar habilitado');
        } else {
          console.log('⏳ Botón Buscar aún deshabilitado...');
        }
        
        return isEnabled;
      }, { timeout: 10000, polling: 300 });
      
      console.log('✅ Botón "Buscar" está habilitado');
    } catch (timeoutError) {
      console.log('⚠️ Timeout esperando que se habilite el botón Buscar');
      const timestamp = Date.now();
      await page.screenshot({ path: path.join(DOWNLOAD_DIR, `debug_buscar_disabled_${timestamp}.png`) });
      throw new Error('El botón Buscar no se habilitó después de 10 segundos');
    }
    
    // Espera adicional para estabilidad
    await new Promise(r => setTimeout(r, 1000));

    // ============================================
    // PASO 4: Click en Buscar
    // ============================================
    console.log('🔍 Haciendo click en botón "Buscar"...');
    
    const buscarClicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'));
      const buscarBtn = buttons.find(btn => {
        const text = btn.textContent?.trim() || btn.value || '';
        return /Buscar/i.test(text);
      });
      
      if (buscarBtn) {
        const isEnabled = !buscarBtn.hasAttribute('disabled') && 
                         buscarBtn.getAttribute('aria-disabled') !== 'true' &&
                         !buscarBtn.disabled;
        
        if (isEnabled) {
          console.log('✅ Haciendo click en botón Buscar habilitado');
          buscarBtn.click();
          return true;
        } else {
          console.log('❌ Botón Buscar sigue deshabilitado');
          return false;
        }
      }
      
      console.log('❌ No se encontró botón Buscar');
      return false;
    });
    
    if (!buscarClicked) {
      const timestamp = Date.now();
      await page.screenshot({ path: path.join(DOWNLOAD_DIR, `debug_buscar_not_clicked_${timestamp}.png`) });
      throw new Error('No se pudo hacer click en el botón Buscar (aún deshabilitado o no encontrado)');
    }
    
    console.log('✅ Click en "Buscar" - Esperando que carguen los resultados...');
    
    // PASO 5: Esperar a que la página se actualice después del click
    // Esperamos a que desaparezca el input "codigo1" que indica que estamos en la página de resultados
    try {
      await page.waitForFunction(() => {
        const input = document.querySelector('input[name="codigo1"]');
        // Si el input está oculto o desaparece, significa que se cargaron los resultados
        return !input || input.offsetParent === null;
      }, { timeout: 10000, polling: 500 });
      
      console.log('✅ Página de resultados cargada (inputs desaparecieron)');
    } catch (err) {
      console.log('⚠️ Timeout esperando cambios en la página, continuando...');
    }
    
    await new Promise(r => setTimeout(r, 2000));
    
    console.log('🔍 Buscando botón "Imprimir"...');
    
    // Listar botones para debug
    const availableButtons = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, a, input[type="submit"]'));
      return buttons.map(b => ({
        text: (b.textContent || b.value || '').trim().substring(0, 50),
        visible: b.offsetParent !== null,
        classes: b.className
      })).filter(b => b.visible && b.text);
    });
    console.log('🔍 Botones disponibles:', JSON.stringify(availableButtons, null, 2));
    
    const imprimirButton = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button, a, input[type="submit"]'));
      return buttons.find(btn => 
        /Imprimir|PDF|Descargar/i.test(btn.textContent || btn.value || '')
      );
    });
    
    if (!imprimirButton || imprimirButton.asElement() === null) {
      // Capturar screenshot para debug
      const timestamp = Date.now();
      await page.screenshot({ path: path.join(DOWNLOAD_DIR, `debug_imprimir_not_found_${timestamp}.png`) });
      
      throw new Error('No se encontró botón "Imprimir" después de hacer click en "Buscar"');
    }
    
    await imprimirButton.asElement().click();
    console.log('✅ Click en "Imprimir"');
    
    await delay(5000);
    
    const files = fs.readdirSync(downloadPath);
    const pdfFile = files.find(f => f.endsWith('.pdf'));
    
    let pdfPath = null;
    if (pdfFile) {
      const oldPath = path.join(downloadPath, pdfFile);
      const newPath = path.join(downloadPath, `${idBoleto}.pdf`);
      fs.renameSync(oldPath, newPath);
      pdfPath = newPath;
      console.log(`📄 PDF descargado: ${pdfPath}`);
    }
    
    return {
      success: true,
      pdfPath: pdfPath
    };

  } catch (error) {
    const message = error.message || '';
    if (/frame was detached|protocol error: connection closed|execution context was destroyed|target closed/i.test(message)) {
      shouldDiscardBrowser = true;
    }
    console.error('❌ Error en _scrapeBoletonPadron:', error);
    throw error;
  } finally {
    if (page && !page.isClosed()) {
      try {
        await page.close();
      } catch (closeError) {
        console.warn('⚠️ No se pudo cerrar la página:', closeError.message);
      }
    }
    // Devolver browser al pool
    if (browser && browserData) {
      if (shouldDiscardBrowser) {
        await browserPool.discardBrowser(browser);
      } else {
        await browserPool.releaseBrowser(browser);
      }
    }
  }
}

/**
 * Obtener link de pago usando padrón y tipo de cuota
 * @param {string} tipoPadron - 'superficial', 'subterraneo' o 'contaminacion'
 * @param {object} datos - Parámetros del padrón
 * @param {string} tipoCuota - 'anual' o 'bimestral'
 * @returns {object} { success, linkPago }
 */
async function obtenerLinkPagoBoleto(tipoPadron, datos, tipoCuota) {
  let browser;
  let browserData;
  let page;
  let shouldDiscardBrowser = false;

  try {
    // Obtener browser del pool
    browserData = await browserPool.getBrowser();
    browser = browserData.browser;
    
    page = await createConfiguredPage(browser);

    console.log(`🔍 Navegando a ${BASE_URL_SERVICIO} para capturar link de pago...`);
    page = await safeGoto(browser, page, BASE_URL_SERVICIO, 2);
    
    // Esperar carga
    await page.waitForSelector('input[name="codigo1"], .mantine-Select-root', { timeout: 15000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 4000));

    // Seleccionar tipo de padrón (A/B/C)
    const tipoCodigo = tipoPadron === 'superficial' ? 'A' :
                       tipoPadron === 'subterraneo' ? 'B' : 'C';
    
    const selects = await page.$$('.mantine-Select-input');
    if (selects.length >= 2) {
      await selects[1].click();
      await new Promise(r => setTimeout(r, 1000));
      
      await page.evaluate((tipoCode) => {
        const options = Array.from(document.querySelectorAll('[role="option"]'));
        const option = options.find(opt => opt.textContent.includes(tipoCode));
        if (option) option.click();
      }, tipoCodigo);
      
      await new Promise(r => setTimeout(r, 1500));
    }

    // Llenar campos según tipo
    if (tipoPadron === 'superficial') {
      await page.evaluate((codigoCauce, numeroPadron) => {
        const input1 = document.querySelector('input[name="codigo1"]');
        const input2 = document.querySelector('input[name="codigo2"]');
        if (input1) {
          input1.focus();
          input1.value = codigoCauce;
          input1.dispatchEvent(new Event('input', { bubbles: true }));
          input1.dispatchEvent(new Event('change', { bubbles: true }));
          input1.dispatchEvent(new Event('blur', { bubbles: true }));
        }
        if (input2) {
          input2.focus();
          input2.value = numeroPadron;
          input2.dispatchEvent(new Event('input', { bubbles: true }));
          input2.dispatchEvent(new Event('change', { bubbles: true }));
          input2.dispatchEvent(new Event('blur', { bubbles: true }));
        }
      }, datos.codigoCauce, datos.numeroPadron);
    } else if (tipoPadron === 'subterraneo') {
      await page.evaluate((codigoDpto, numeroPozo) => {
        const input1 = document.querySelector('input[name="codigo1"]');
        const input2 = document.querySelector('input[name="codigo2"]');
        if (input1) {
          input1.focus();
          input1.value = codigoDpto;
          input1.dispatchEvent(new Event('input', { bubbles: true }));
          input1.dispatchEvent(new Event('change', { bubbles: true }));
          input1.dispatchEvent(new Event('blur', { bubbles: true }));
        }
        if (input2) {
          input2.focus();
          input2.value = numeroPozo;
          input2.dispatchEvent(new Event('input', { bubbles: true }));
          input2.dispatchEvent(new Event('change', { bubbles: true }));
          input2.dispatchEvent(new Event('blur', { bubbles: true }));
        }
      }, datos.codigoDepartamento, datos.numeroPozo);
    } else if (tipoPadron === 'contaminacion') {
      await page.evaluate((numeroContam) => {
        const input1 = document.querySelector('input[name="codigo1"]');
        if (input1) {
          input1.focus();
          input1.value = numeroContam;
          input1.dispatchEvent(new Event('input', { bubbles: true }));
          input1.dispatchEvent(new Event('change', { bubbles: true }));
          input1.dispatchEvent(new Event('blur', { bubbles: true }));
        }
      }, datos.numeroContaminacion);
    }

    await new Promise(r => setTimeout(r, 1500));

    // Click en Buscar
    const buscarButton = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(btn => /Buscar/i.test(btn.textContent || ''));
    });
    
    if (buscarButton && buscarButton.asElement()) {
      await buscarButton.asElement().click();
      await new Promise(r => setTimeout(r, 3000));
    }

    // Click en botón "Pagar" de la cuota seleccionada (Anual izquierda / Bimestral derecha)
    console.log(`💳 Buscando botón "Pagar" para cuota ${tipoCuota}...`);
    await page.waitForFunction(() => {
      const candidates = Array.from(document.querySelectorAll('button, a, div[role="button"]'));
      return candidates.some(btn => {
        const text = (btn.textContent || '').trim();
        const isPagar = /Pagar/i.test(text) && !/Imprimir|PDF|Descargar/i.test(text);
        const isVisible = btn.offsetParent !== null;
        const isDisabled = btn.hasAttribute('disabled') || btn.getAttribute('aria-disabled') === 'true' || btn.disabled;
        return isPagar && isVisible && !isDisabled;
      });
    }, { timeout: 15000 }).catch(() => {});

    const pagarButton = await page.evaluateHandle((tipo) => {
      const cuotaTexto = tipo === 'anual' ? 'Cuota Anual' : 'Cuota Bimestral';
      const candidates = Array.from(document.querySelectorAll('button, a, div[role="button"]'));
      const pagarButtons = candidates.filter(btn => {
        const text = (btn.textContent || '').trim();
        const isPagar = /Pagar/i.test(text) && !/Imprimir|PDF|Descargar/i.test(text);
        const isVisible = btn.offsetParent !== null;
        const isDisabled = btn.hasAttribute('disabled') || btn.getAttribute('aria-disabled') === 'true' || btn.disabled;
        return isPagar && isVisible && !isDisabled;
      });

      if (pagarButtons.length === 0) return null;
      if (pagarButtons.length === 1) return pagarButtons[0];

      for (const btn of pagarButtons) {
        let parent = btn.parentElement;
        let depth = 0;
        while (parent && depth < 7) {
          const txt = (parent.innerText || '').trim();
          if (txt.includes(cuotaTexto)) return btn;
          parent = parent.parentElement;
          depth += 1;
        }
      }

      return tipo === 'anual' ? pagarButtons[0] : pagarButtons[1] || pagarButtons[0];
    }, tipoCuota);
    
    if (!pagarButton || pagarButton.asElement() === null) {
      throw new Error('No se encontró el botón "Pagar"');
    }
    
    await pagarButton.asElement().click();
    console.log('✅ Click en "Pagar" - Esperando modal o redirección...');

    const navigationPromise = page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }).catch(() => null);
    await delay(1500);

    // Click en segundo botón "Pagar" dentro del modal (si aparece)
    const pagarModalButton = await page.evaluateHandle(() => {
      const modals = Array.from(document.querySelectorAll('[role="dialog"], .modal, .mantine-Modal-root, div[class*="modal"]'));
      for (const modal of modals) {
        const buttons = Array.from(modal.querySelectorAll('button, a, div[role="button"]'));
        const pagarBtn = buttons.find(btn => {
          const text = (btn.textContent || '').trim();
          const isVisible = btn.offsetParent !== null;
          const isDisabled = btn.hasAttribute('disabled') || btn.getAttribute('aria-disabled') === 'true' || btn.disabled;
          return /Pagar/i.test(text) && isVisible && !isDisabled;
        });
        if (pagarBtn) return pagarBtn;
      }
      return null;
    });
    
    if (pagarModalButton && pagarModalButton.asElement()) {
      await pagarModalButton.asElement().click();
      console.log('✅ Click en segundo "Pagar" - Esperando redirección...');
    } else {
      console.log('ℹ️ No se encontró modal, esperando redirección directa...');
    }
    
    await navigationPromise;
    await delay(2000);
    
    const linkPago = page.url();
    console.log(`🔗 Link de pago capturado: ${linkPago}`);
    
    // Cerrar browser para liberar RAM
    await browserPool.discardBrowser(browser);
    
    return {
      success: true,
      linkPago: linkPago
    };
    
  } catch (error) {
    console.error('❌ Error en obtenerLinkPagoBoleto:', error);
    
    if (browser) {
      await browserPool.discardBrowser(browser);
    }
    
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  obtenerDeudaYBoleto,
  obtenerSoloBoleto,
  obtenerDeudaPadron,
  obtenerBoletoPadron,
  obtenerLinkPagoBoleto
};

