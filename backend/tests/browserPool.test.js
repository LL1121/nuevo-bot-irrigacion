/**
 * Tests del Browser Pool
 * Verifica que el pool de browsers funcione correctamente
 */

const browserPool = require('../src/services/browserPool');

describe('Browser Pool', () => {
  
  afterAll(async () => {
    // Limpiar al terminar todos los tests
    await browserPool.closeAll();
  });

  test('Debe obtener un browser del pool', async () => {
    const { browser, isNew } = await browserPool.getBrowser();
    
    expect(browser).toBeDefined();
    expect(browser.newPage).toBeDefined();
    expect(typeof isNew).toBe('boolean');
    
    await browserPool.releaseBrowser(browser);
  }, 30000);

  test('Debe reutilizar browsers del pool', async () => {
    // Primera obtención
    const { browser: browser1, isNew: isNew1 } = await browserPool.getBrowser();
    // No verificamos isNew porque puede haber sido usado por otro test
    expect(browser1).toBeDefined();
    
    // Devolver al pool
    await browserPool.releaseBrowser(browser1);
    
    // Segunda obtención
    const { browser: browser2, isNew: isNew2 } = await browserPool.getBrowser();
    expect(isNew2).toBe(false); // Segundo debe ser reutilizado
    expect(browser2).toBe(browser1); // Mismo browser
    
    await browserPool.releaseBrowser(browser2);
  }, 30000);

  test('Debe manejar múltiples browsers simultáneos', async () => {
    const browsers = [];
    
    // Obtener 3 browsers simultáneamente
    for (let i = 0; i < 3; i++) {
      const { browser } = await browserPool.getBrowser();
      browsers.push(browser);
    }
    
    expect(browsers.length).toBe(3);
    expect(browsers[0]).toBeDefined();
    expect(browsers[1]).toBeDefined();
    expect(browsers[2]).toBeDefined();
    
    // Devolver todos al pool
    for (const browser of browsers) {
      await browserPool.releaseBrowser(browser);
    }
  }, 60000);

  test('Browser debe poder crear páginas', async () => {
    const { browser } = await browserPool.getBrowser();
    
    const page = await browser.newPage();
    expect(page).toBeDefined();
    expect(page.goto).toBeDefined();
    
    await page.close();
    await browserPool.releaseBrowser(browser);
  }, 30000);

  test('Browser debe poder navegar', async () => {
    const { browser } = await browserPool.getBrowser();
    const page = await browser.newPage();
    
    // Navegar a una página simple
    await page.goto('https://example.com', { waitUntil: 'networkidle2', timeout: 10000 });
    const title = await page.title();
    
    expect(title).toBeDefined();
    expect(title.length).toBeGreaterThan(0);
    
    await page.close();
    await browserPool.releaseBrowser(browser);
  }, 30000);
});
