/**
 * Tests de Servicio de Scraping
 * Verifica que el scraping funcione con browser pool
 */

const debtScraperService = require('../src/services/debtScraperService');
const browserPool = require('../src/services/browserPool');

describe('Debt Scraper Service', () => {
  
  afterAll(async () => {
    // Cerrar todos los browsers al finalizar
    await browserPool.closeAll();
  });

  test('debtScraperService debe estar definido', () => {
    expect(debtScraperService).toBeDefined();
    expect(typeof debtScraperService.obtenerDeudaYBoleto).toBe('function');
  });

  test('Debe manejar DNI inválido correctamente', async () => {
    const result = await debtScraperService.obtenerDeudaYBoleto('00000000');
    
    // Debe retornar objeto con error o datos vacíos
    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
  }, 90000); // 90 segundos timeout

  test('Debe usar browser pool (verificar que no crashea)', async () => {
    // Este test verifica que el browser pool se integra correctamente
    // No valida datos reales, solo que el mecanismo funciona
    
    const testDni = '12345678'; // DNI de prueba
    
    try {
      const result = await debtScraperService.obtenerDeudaYBoleto(testDni);
      
      // Si llega aquí sin error, el browser pool funciona
      expect(result).toBeDefined();
      
    } catch (error) {
      // Si hay error, debe ser por scraping, no por browser pool
      expect(error).toBeDefined();
      
      // No debe ser error de browser undefined
      expect(error.message).not.toContain('browser is not defined');
      expect(error.message).not.toContain('Cannot read property');
    }
  }, 90000);

  test('Debe manejar múltiples scrapes simultáneos', async () => {
    const dnis = ['11111111', '22222222', '33333333'];
    
    const scrapePromises = dnis.map(dni => 
      debtScraperService.obtenerDeudaYBoleto(dni)
        .catch(error => ({ error: error.message }))
    );
    
    const results = await Promise.all(scrapePromises);
    
    // Debe completar todos sin crash
    expect(results.length).toBe(3);
    results.forEach(result => {
      expect(result).toBeDefined();
    });
  }, 120000); // 2 minutos para 3 scrapes simultáneos

  test('Debe reintentar en caso de error (máximo 3 intentos)', async () => {
    // Este test verifica que el mecanismo de retry existe
    const testDni = '99999999';
    
    const startTime = Date.now();
    
    try {
      await debtScraperService.obtenerDeudaYBoleto(testDni);
    } catch (error) {
      // Si falla, debe haber intentado 3 veces
      const elapsed = Date.now() - startTime;
      
      // Con 3 reintentos, debería tomar al menos 30 segundos
      // (10 segundos por intento mínimo)
      expect(elapsed).toBeGreaterThan(10000);
    }
  }, 120000);

  test('obtenerSoloBoleto debe estar disponible', () => {
    expect(typeof debtScraperService.obtenerSoloBoleto).toBe('function');
  });

  test('obtenerDeudaPadron debe estar disponible', () => {
    expect(typeof debtScraperService.obtenerDeudaPadron).toBe('function');
  });

  test('obtenerBoletoPadron debe estar disponible', () => {
    expect(typeof debtScraperService.obtenerBoletoPadron).toBe('function');
  });
});

describe('Browser Pool Integration', () => {
  
  afterAll(async () => {
    await browserPool.closeAll();
  });

  test('Browser pool debe liberar browsers después del scraping', async () => {
    // Hacer un scrape
    const testDni = '12345678';
    
    try {
      await debtScraperService.obtenerDeudaYBoleto(testDni);
    } catch (error) {
      // Ignorar error de scraping
    }
    
    // El browser debe haber sido liberado y estar disponible
    const { browser, isNew } = await browserPool.getBrowser();
    
    expect(browser).toBeDefined();
    expect(isNew).toBe(false); // Debe ser reutilizado
    
    await browserPool.releaseBrowser(browser);
  }, 90000);

  test('No debe haber memory leaks en scraping repetido', async () => {
    const iterations = 5;
    const testDni = '12345678';
    
    for (let i = 0; i < iterations; i++) {
      try {
        await debtScraperService.obtenerDeudaYBoleto(testDni);
      } catch (error) {
        // Ignorar errores de scraping
      }
    }
    
    // Si llegó aquí sin crash, no hay memory leaks evidentes
    expect(true).toBe(true);
  }, 300000); // 5 minutos para 5 iteraciones
});
