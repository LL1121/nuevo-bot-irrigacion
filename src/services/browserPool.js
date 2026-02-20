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
    this.maxLaunchAttempts = 2;
  }

  buildLaunchOptions(variant = 'primary') {
    const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_PATH || undefined;
    const baseArgs = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
      '--disable-extensions',
      '--disable-software-rasterizer',
      '--disable-features=IsolateOrigins,site-per-process'
    ];

    if (variant === 'fallback') {
      return {
        headless: true,
        pipe: true,
        args: baseArgs,
        executablePath,
        timeout: 30000
      };
    }

    return {
      headless: 'new',
      args: baseArgs,
      executablePath,
      timeout: 30000
    };
  }

  async validateBrowser(browser) {
    if (!browser || !browser.isConnected()) {
      throw new Error('Browser desconectado al iniciar');
    }
    const page = await browser.newPage();
    await page.close();
  }

  async getBrowser() {
    // Si hay un browser disponible, reutilizarlo (solo si sigue conectado)
    while (this.browsers.length > 0) {
      const browser = this.browsers.pop();
      if (browser && browser.isConnected()) {
        console.log(`♻️ Reutilizando browser existente (${this.browsers.length} disponibles)`);
        return { browser, isNew: false };
      }
      await this.discardBrowser(browser);
    }

    // Si podemos crear más browsers, crear uno nuevo
    if (this.activeBrowsers < this.maxBrowsers) {
      console.log(`🆕 Creando nuevo browser (${this.activeBrowsers + 1}/${this.maxBrowsers})`);

      for (let attempt = 1; attempt <= this.maxLaunchAttempts; attempt++) {
        let browser;
        try {
          const options = this.buildLaunchOptions(attempt === 1 ? 'primary' : 'fallback');
          browser = await puppeteer.launch(options);
          await this.validateBrowser(browser);

          this.activeBrowsers++;
          return { browser, isNew: true };
        } catch (err) {
          if (browser) {
            await this.discardBrowser(browser);
          }
          console.error(`❌ Error iniciando browser (intento ${attempt}/${this.maxLaunchAttempts}):`, err.message);
          if (attempt === this.maxLaunchAttempts) {
            throw err;
          }
        }
      }
    }

    // Si llegamos al límite, esperar en cola
    console.log(`⏳ Pool lleno, esperando browser disponible...`);
    return new Promise((resolve) => {
      this.queue.push(resolve);
    });
  }

  async releaseBrowser(browser) {
    if (!browser || !browser.isConnected()) {
      await this.discardBrowser(browser);
      return;
    }

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

  async discardBrowser(browser) {
    if (!browser) return;
    try {
      await browser.close();
    } catch (err) {
      console.error('Error cerrando browser desconectado:', err.message);
    }
    if (this.activeBrowsers > 0) {
      this.activeBrowsers--;
    }
    console.log('🗑️ Browser descartado (desconectado)');
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
