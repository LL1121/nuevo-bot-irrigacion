const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const puppeteer = require('puppeteer');

const BASE_URL = 'https://autogestion.cloud.irrigacion.gov.ar/dni';
const DOWNLOAD_DIR = path.resolve(__dirname, '../../public/temp');
const DOWNLOAD_TIMEOUT_MS = 15000;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36';

// Asegurar carpeta de descargas
if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

/**
 * Limpia archivos PDF antiguos (>1 hora) en la carpeta temp
 */
async function cleanOldFiles() {
  try {
    const files = await fsp.readdir(DOWNLOAD_DIR);
    const now = Date.now();
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
        await delay(300);
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
    await delay(300);
  }

  throw new Error('Timeout esperando la descarga del PDF');
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  const relativePdfPath = `/temp/${dni}.pdf`;
  const absolutePdfPath = path.join(DOWNLOAD_DIR, `${dni}.pdf`);

  try {
    // Auto-limpieza de archivos antiguos
    await cleanOldFiles();

    browser = await puppeteer.launch({ 
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setDefaultTimeout(20000);

    // Stealth mode: User-Agent
    await page.setUserAgent(USER_AGENT);

    // Viewport para asegurar visibilidad
    await page.setViewport({ width: 1280, height: 800 });

    // Configurar descarga con CDP
    const client = await page.target().createCDPSession();
    await client.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: DOWNLOAD_DIR
    });

    console.log(`🔍 Navegando a ${BASE_URL}...`);
    await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 20000 });

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
    await new Promise(r => setTimeout(r, 500));
    
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
    
    await new Promise(r => setTimeout(r, 2000));

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
    await new Promise(r => setTimeout(r, 1000));
    
    const consultarButton = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button, a'));
      return buttons.find(btn => 
        /Consultar Deuda del Servicio/i.test(btn.textContent || '')
      );
    });
    
    if (!consultarButton || consultarButton.asElement() === null) {
      throw new Error('No se encontró botón "Consultar Deuda del Servicio"');
    }
    
    // Click y esperar navegación
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }),
      consultarButton.asElement().click()
    ]);
    
    console.log('✅ Navegó a página de detalle de deuda');

    // ============================================
    // PASO 5: Extraer datos de la página de cuenta corriente
    // ============================================
    console.log('📋 Extrayendo datos de deuda...');
    
    // Esperar a que se cargue el contenido dinámico
    await new Promise(r => setTimeout(r, 3000));
    
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
    console.error('❌ Error en _scrapeDeudaYBoleto:', error.message);
    console.error('Stack:', error.stack);
    throw error; // Re-lanzar para que el wrapper maneje los reintentos
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
  
  try {
    // Configuración de Puppeteer
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });
    
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
    await delay(500);
    
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
    
    await delay(3000);

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
    await delay(1000);
    
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
    
    // Esperar a que se descargue el PDF
    await delay(5000);
    
    // Buscar el archivo PDF descargado
    const files = fs.readdirSync(downloadPath);
    const pdfFile = files.find(f => f.endsWith('.pdf'));
    
    let pdfPath = null;
    if (pdfFile) {
      const oldPath = path.join(downloadPath, pdfFile);
      const newPath = path.join(downloadPath, `boleto_${tipoCuota}_${dni}.pdf`);
      fs.renameSync(oldPath, newPath);
      pdfPath = newPath;
      console.log(`📄 PDF descargado: ${pdfPath}`);
    }
    
    await browser.close();
    
    return {
      success: true,
      pdfPath: pdfPath
    };
    
  } catch (error) {
    console.error('❌ Error en _scrapeSoloBoleto:', error);
    if (browser) await browser.close();
    throw error; // Re-lanzar para que el wrapper maneje los reintentos
  }
}

/**
 * Obtener deuda usando padrón (superficial, subterráneo o contaminación)
 * @param {string} tipoPadron - 'superficial', 'subterraneo' o 'contaminacion'
 * @param {object} datos - { codigoCauce, numeroPadron } | { codigoDepartamento, numeroPozo } | { numeroContaminacion }
 * @returns {object} { success, data, pdfPath, absolutePdfPath }
 */
async function obtenerDeudaPadron(tipoPadron, datos) {
  const MAX_INTENTOS = 3;
  
  for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
    try {
      console.log(`🔄 Intento ${intento}/${MAX_INTENTOS} para obtenerDeudaPadron ${tipoPadron}:`, datos);
      const resultado = await _scrapeDeudaYBoletoPadron(tipoPadron, datos);
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
async function _scrapeDeudaYBoletoPadron(tipoPadron, datos) {
  let browser;
  const idPadron = `${tipoPadron}_${Object.values(datos).join('_')}`;
  const relativePdfPath = `/temp/${idPadron}.pdf`;
  const absolutePdfPath = path.join(DOWNLOAD_DIR, `${idPadron}.pdf`);

  try {
    await cleanOldFiles();

    browser = await puppeteer.launch({ 
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setDefaultTimeout(20000);
    await page.setUserAgent(USER_AGENT);
    await page.setViewport({ width: 1280, height: 800 });

    const client = await page.target().createCDPSession();
    await client.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: DOWNLOAD_DIR
    });

    console.log(`🔍 Navegando a ${BASE_URL}...`);
    await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 20000 });

    // ============================================
    // PASO 1: Buscar y hacer clic en el menú desplegable de tipo de padrón
    // ============================================
    console.log('📝 Buscando selector de tipo de padrón (A/B/C)...');
    
    // El selector tiene opciones A, B, C
    const tipoCodigo = tipoPadron === 'superficial' ? 'A' :
                       tipoPadron === 'subterraneo' ? 'B' :
                       tipoPadron === 'contaminacion' ? 'C' : 'A';
    
    // Buscar select o combo box
    const selectFound = await page.evaluate((tipoCode) => {
      // Buscar select directo
      const selects = Array.from(document.querySelectorAll('select'));
      const selectConOpcion = selects.find(sel => {
        const opciones = Array.from(sel.querySelectorAll('option'));
        return opciones.some(op => op.textContent.includes(tipoCode) || op.value.includes(tipoCode));
      });
      return selectConOpcion !== undefined;
    }, tipoCodigo);

    if (selectFound) {
      // Es un select HTML
      console.log(`✅ Encontrado select, seleccionando opción ${tipoCodigo}`);
      await page.select('select', tipoCodigo);
    } else {
      // Podría ser un combo box personalizado - buscar y hacer clic
      console.log(`✅ Buscando combo box personalizado para opción ${tipoCodigo}`);
      const comboFound = await page.evaluateHandle((tipoCode) => {
        const divs = Array.from(document.querySelectorAll('div, button, li'));
        const opcion = divs.find(el => 
          (el.textContent.includes(tipoCode) || el.textContent.includes(tipoPadron === 'superficial' ? 'Superficial' : tipoPadron === 'subterraneo' ? 'Subterráneo' : 'Contaminación')) &&
          el.textContent.length < 50
        );
        return opcion;
      }, tipoCodigo);

      if (comboFound && comboFound.asElement()) {
        await comboFound.asElement().click();
        console.log(`✅ Click en opción ${tipoCodigo}`);
      }
    }

    await new Promise(r => setTimeout(r, 1000));

    // ============================================
    // PASO 2: Llenar campos según el tipo de padrón
    // ============================================
    console.log(`📝 Llenando campos para padrón tipo ${tipoPadron}...`);
    
    const inputs = await page.$$('input[type="text"]');
    
    if (tipoPadron === 'superficial') {
      // Campos: código de cauce (izquierda), padrón parcial (derecha)
      if (inputs.length >= 2) {
        await inputs[0].click({ clickCount: 3 });
        await inputs[0].type(datos.codigoCauce, { delay: 100 });
        console.log(`✅ Código de cauce ingresado: ${datos.codigoCauce}`);
        
        await inputs[1].click({ clickCount: 3 });
        await inputs[1].type(datos.numeroPadron, { delay: 100 });
        console.log(`✅ Padrón parcial ingresado: ${datos.numeroPadron}`);
      }
    } else if (tipoPadron === 'subterraneo') {
      // Campos: código de departamento (izquierda), N° de pozo (derecha)
      if (inputs.length >= 2) {
        await inputs[0].click({ clickCount: 3 });
        await inputs[0].type(datos.codigoDepartamento, { delay: 100 });
        console.log(`✅ Código de departamento ingresado: ${datos.codigoDepartamento}`);
        
        await inputs[1].click({ clickCount: 3 });
        await inputs[1].type(datos.numeroPozo, { delay: 100 });
        console.log(`✅ N° de pozo ingresado: ${datos.numeroPozo}`);
      }
    } else if (tipoPadron === 'contaminacion') {
      // Campo: N° de contaminación (solo izquierda)
      if (inputs.length >= 1) {
        await inputs[0].click({ clickCount: 3 });
        await inputs[0].type(datos.numeroContaminacion, { delay: 100 });
        console.log(`✅ N° de contaminación ingresado: ${datos.numeroContaminacion}`);
      }
    }

    // ============================================
    // PASO 3: Buscar botón "Buscar" y hacer clic
    // ============================================
    console.log('🔍 Buscando botón "Buscar"...');
    await new Promise(r => setTimeout(r, 500));
    
    const buscarButton = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], a'));
      return buttons.find(btn => 
        /Buscar/i.test(btn.textContent || btn.value || '')
      );
    });
    
    if (!buscarButton || buscarButton.asElement() === null) {
      throw new Error('No se encontró botón "Buscar"');
    }
    
    await buscarButton.asElement().click();
    console.log('✅ Click en "Buscar"');
    
    await new Promise(r => setTimeout(r, 2000));

    // ============================================
    // PASO 4: Verificar que aparecieron los recuadros (Cuota Anual/Bimestral)
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
        return { success: false, error: 'No encontramos ese padrón en nuestra base de datos. Por favor verifica los datos.' };
      }
      
      throw new Error('No se encontraron servicios asociados al padrón');
    }
    
    console.log('✅ Servicios encontrados');

    // ============================================
    // PASO 5: Click en "Calcular Deuda"
    // ============================================
    console.log('🔍 Buscando botón "Calcular Deuda"...');
    await new Promise(r => setTimeout(r, 1000));
    
    const calcularButton = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button, a'));
      return buttons.find(btn => 
        /Calcular Deuda|Consultar Deuda/i.test(btn.textContent || '')
      );
    });
    
    if (!calcularButton || calcularButton.asElement() === null) {
      throw new Error('No se encontró botón "Calcular Deuda"');
    }
    
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }),
      calcularButton.asElement().click()
    ]);
    
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

  } catch (error) {
    console.error('❌ Error en _scrapeDeudaYBoletoPadron:', error.message);
    console.error('Stack:', error.stack);
    if (browser) await browser.close();
    throw error;
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
      const resultado = await _scrapeBoletonPadron(tipoPadron, datos, tipoCuota);
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
  const idBoleto = `boleto_${tipoPadron}_${tipoCuota}_${Object.values(datos).join('_')}`;
  const downloadPath = DOWNLOAD_DIR;

  try {
    await cleanOldFiles();

    browser = await puppeteer.launch({ 
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setDefaultTimeout(20000);
    await page.setUserAgent(USER_AGENT);
    await page.setViewport({ width: 1280, height: 800 });

    const client = await page.target().createCDPSession();
    await client.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: downloadPath
    });

    console.log(`🔍 Navegando a ${BASE_URL}...`);
    await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 20000 });

    // Pasos 1-4: Seleccionar tipo, llenar campos, buscar, verificar resultados
    // (Mismo que en _scrapeDeudaYBoletoPadron)
    
    const tipoCodigo = tipoPadron === 'superficial' ? 'A' :
                       tipoPadron === 'subterraneo' ? 'B' :
                       tipoPadron === 'contaminacion' ? 'C' : 'A';
    
    // Seleccionar tipo de padrón
    const selectFound = await page.evaluate((tipoCode) => {
      const selects = Array.from(document.querySelectorAll('select'));
      const selectConOpcion = selects.find(sel => {
        const opciones = Array.from(sel.querySelectorAll('option'));
        return opciones.some(op => op.textContent.includes(tipoCode) || op.value.includes(tipoCode));
      });
      return selectConOpcion !== undefined;
    }, tipoCodigo);

    if (selectFound) {
      await page.select('select', tipoCodigo);
    }

    await new Promise(r => setTimeout(r, 1000));

    // Llenar campos
    const inputs = await page.$$('input[type="text"]');
    
    if (tipoPadron === 'superficial' && inputs.length >= 2) {
      await inputs[0].click({ clickCount: 3 });
      await inputs[0].type(datos.codigoCauce, { delay: 100 });
      await inputs[1].click({ clickCount: 3 });
      await inputs[1].type(datos.numeroPadron, { delay: 100 });
    } else if (tipoPadron === 'subterraneo' && inputs.length >= 2) {
      await inputs[0].click({ clickCount: 3 });
      await inputs[0].type(datos.codigoDepartamento, { delay: 100 });
      await inputs[1].click({ clickCount: 3 });
      await inputs[1].type(datos.numeroPozo, { delay: 100 });
    } else if (tipoPadron === 'contaminacion' && inputs.length >= 1) {
      await inputs[0].click({ clickCount: 3 });
      await inputs[0].type(datos.numeroContaminacion, { delay: 100 });
    }

    // Buscar
    const buscarButton = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], a'));
      return buttons.find(btn => /Buscar/i.test(btn.textContent || btn.value || ''));
    });
    
    if (buscarButton && buscarButton.asElement()) {
      await buscarButton.asElement().click();
      await new Promise(r => setTimeout(r, 2000));
    }

    // ============================================
    // PASO 5: Seleccionar cuota (Anual o Bimestral)
    // ============================================
    console.log(`📅 Seleccionando ${tipoCuota === 'anual' ? 'Cuota Anual' : 'Cuota Bimestral'}...`);
    
    const tipoCuotaTexto = tipoCuota === 'anual' ? 'Cuota Anual' : 'Cuota Bimestral';
    
    const cuotaButton = await page.evaluateHandle((textoB) => {
      const buttons = Array.from(document.querySelectorAll('button, div[role="button"], a'));
      return buttons.find(btn => btn.textContent.includes(textoB));
    }, tipoCuotaTexto);
    
    if (cuotaButton && cuotaButton.asElement()) {
      await cuotaButton.asElement().click();
      await new Promise(r => setTimeout(r, 1500));
      console.log(`✅ Seleccionada: ${tipoCuotaTexto}`);
    }

    // ============================================
    // PASO 6: Buscar y clickear botón "Imprimir"
    // ============================================
    console.log('📄 Buscando botón "Imprimir" para descargar PDF...');
    
    const imprimirButton = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button, a'));
      return buttons.find(btn => /Imprimir|PDF|Descargar/i.test(btn.textContent || ''));
    });
    
    if (imprimirButton && imprimirButton.asElement() !== null) {
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
      
      await browser.close();
      
      return {
        success: true,
        pdfPath: pdfPath
      };
    }

    throw new Error('No se encontró botón de descarga');

  } catch (error) {
    console.error('❌ Error en _scrapeBoletonPadron:', error);
    if (browser) await browser.close();
    throw error;
  }
}

module.exports = {
  obtenerDeudaYBoleto,
  obtenerSoloBoleto,
  obtenerDeudaPadron,
  obtenerBoletoPadron
};

