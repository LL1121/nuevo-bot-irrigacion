const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const puppeteer = require('puppeteer');

const BASE_URL = 'https://www.irrigacion.gov.ar/';
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
 * Scrapea deuda e intenta descargar boleto PDF para un DNI/CUIT dado.
 * Retorna { success, data: { titular, cuit, hectareas, deuda, servicio }, pdfPath }
 */
async function obtenerDeudaYBoleto(dni) {
  let browser;
  const relativePdfPath = `/temp/${dni}.pdf`;
  const absolutePdfPath = path.join(DOWNLOAD_DIR, `${dni}.pdf`);

  try {
    // Auto-limpieza de archivos antiguos
    await cleanOldFiles();

    browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setDefaultTimeout(15000);

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

    // Ir al sitio
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

    // Navegar por las opciones usando XPath por texto
    await clickByText(page, ['Pagar', 'Descargar Boleto']);
    await clickByText(page, ['Boleto Vigente']);
    await clickByText(page, ['DNI', 'CUIT']);

    // Completar DNI/CUIT (primer input de texto visible)
    const inputXPath = "//input[not(@type) or @type='text']";
    const [input] = await page.$x(inputXPath);
    if (!input) throw new Error('No se encontró input de DNI/CUIT');
    await input.click({ clickCount: 3 });
    await input.type(String(dni));

    // Click en Buscar
    await clickByText(page, ['Buscar']);

    // Esperar resultados con Promise.race (tabla vs error)
    let monto = null;
    const raceResult = await Promise.race([
      page.waitForSelector('table', { timeout: 12000 }).then(() => 'success'),
      page.waitForXPath("//*[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'no se encontraron') or contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'verifique')]", { timeout: 12000 }).then(() => 'error')
    ]).catch(() => 'timeout');

    if (raceResult === 'error') {
      return { success: false, error: 'DNI/CUIT no encontrado o inválido' };
    }

    if (raceResult === 'timeout') {
      return { success: false, error: 'Timeout esperando resultados' };
    }

    // ============================================
    // EXTRACCIÓN DE DATOS COMPLETOS
    // ============================================
    const datos = await page.evaluate(() => {
      const resultado = {
        titular: 'No disponible',
        cuit: 'No disponible',
        hectareas: 'No disponible',
        deuda: 'No disponible',
        servicio: 'No disponible'
      };
      
      const bodyText = document.body.innerText || '';
      
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
      const cuitMatch = bodyText.match(/CUIT[:\s]*(\d{2}-\d{8}-\d{1}|\d{11})/i);
      if (cuitMatch) {
        resultado.cuit = cuitMatch[1];
      }
      
      // Extraer Hectáreas
      const hectareasMatch = bodyText.match(/(\d+[,.]?\d*)\s*(ha|hectáreas|hectareas)/i);
      if (hectareasMatch) {
        resultado.hectareas = `${hectareasMatch[1]} ha`;
      }
      
      // Extraer Servicio/Nomenclatura
      const servicioMatch = bodyText.match(/(?:Servicio|Nomenclatura|Padrón|Padron):\s*([A-Z0-9-]+)/i);
      if (servicioMatch) {
        resultado.servicio = servicioMatch[1];
      }
      
      // Extraer Monto de Deuda
      const montoMatch = bodyText.match(/\$\s?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?/);
      if (montoMatch) {
        resultado.deuda = montoMatch[0];
      }
      
      return resultado;
    });
    
    monto = datos.deuda;
    console.log('📋 Datos extraídos:', datos);

    // Disparar descarga del PDF (botón PDF/Imprimir)
    await clickByText(page, ['PDF', 'Imprimir']);

    // Esperar la descarga y renombrar
    const finalPath = await waitForDownload(DOWNLOAD_DIR, `${dni}.pdf`, DOWNLOAD_TIMEOUT_MS);

    return {
      success: true,
      data: datos,
      pdfPath: relativePdfPath,
      absolutePdfPath: finalPath
    };
  } catch (error) {
    console.error('❌ Error en obtenerDeudaYBoleto:', error.message);
    return { success: false, error: error.message };
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (_) {
        // ignore
      }
    }
  }
}

/**
 * Click en el primer elemento que coincida con alguno de los textos indicados (case-insensitive)
 */
async function clickByText(page, texts) {
  const xpath = `//*[${texts
    .map((t, i) => `contains(translate(normalize-space(text()), '${t.toUpperCase()}', '${t.toUpperCase()}'), '${t.toUpperCase()}')`)
    .join(' or ')}]`;
  const [el] = await page.$x(xpath);
  if (!el) throw new Error(`No se encontró elemento con texto: ${texts.join(' / ')}`);
  await el.click();
  await page.waitForTimeout(500);
}

module.exports = {
  obtenerDeudaYBoleto
};
