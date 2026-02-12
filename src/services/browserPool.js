const puppeteer = require('puppeteer');

/**
 * Pool de instancias de Puppeteer para optimizar scraping concurrente
 * Evita crear/destruir browsers constantemente
 */
class BrowserPool {
  constructor(maxBrowsers = 3) {
    this.maxBrowsers = maxBrowsers;
    this.browsers = [];
    this.queue = [];
    this.activeBrowsers = 0;
  }

  async getBrowser() {
    // Si hay un browser disponible, reutilizarlo
    if (this.browsers.length > 0) {
      const browser = this.browsers.pop();
      console.log(`♻️ Reutilizando browser existente (${this.browsers.length} disponibles)`);
      return { browser, isNew: false };
    }

    // Si podemos crear más browsers, crear uno nuevo
    if (this.activeBrowsers < this.maxBrowsers) {
      this.activeBrowsers++;
      console.log(`🆕 Creando nuevo browser (${this.activeBrowsers}/${this.maxBrowsers})`);
      
      const browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-extensions',
          '--disable-software-rasterizer'
        ],
        timeout: 30000
      });

      return { browser, isNew: true };
    }

    // Si llegamos al límite, esperar en cola
    console.log(`⏳ Pool lleno, esperando browser disponible...`);
    return new Promise((resolve) => {
      this.queue.push(resolve);
    });
  }

  async releaseBrowser(browser) {
    // Si hay alguien esperando en la cola, dárselo
    if (this.queue.length > 0) {
      const resolve = this.queue.shift();
      console.log(`➡️ Entregando browser a petición en cola (${this.queue.length} esperando)`);
      resolve({ browser, isNew: false });
      return;
    }

    // Si no hay nadie esperando, guardarlo para reutilizar
    this.browsers.push(browser);
    console.log(`💾 Browser guardado en pool (${this.browsers.length} disponibles)`);

    // Si tenemos demasiados browsers guardados, cerrar algunos
    if (this.browsers.length > 2) {
      const browserToClose = this.browsers.shift();
      await browserToClose.close();
      this.activeBrowsers--;
      console.log(`🗑️ Browser cerrado (exceso en pool)`);
    }
  }

  async closeAll() {
    console.log(`🛑 Cerrando todos los browsers del pool...`);
    for (const browser of this.browsers) {
      try {
        await browser.close();
      } catch (err) {
        console.error('Error cerrando browser:', err.message);
      }
    }
    this.browsers = [];
    this.activeBrowsers = 0;
  }
}

// Singleton del pool
const browserPool = new BrowserPool(parseInt(process.env.MAX_BROWSERS) || 3);

// Limpiar al cerrar el proceso
process.on('SIGINT', async () => {
  await browserPool.closeAll();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await browserPool.closeAll();
  process.exit(0);
});

module.exports = browserPool;
