/**
 * Tests de API REST
 * Verifica que los endpoints del servidor respondan correctamente
 * 
 * Nota: Estos tests requieren que el servidor esté ejecutándose
 * Run: npm start (en otra terminal) antes de ejecutar estos tests
 */

const axios = require('axios');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

describe('API Endpoints', () => {
  // Skip estos tests si el servidor no está corriendo
  const serverRunning = process.env.SERVER_RUNNING === 'true';

  beforeAll(() => {
    if (!serverRunning) {
      console.log('⚠️ Tests de API omitidos. Para ejecutarlos:');
      console.log('   1. Inicia el servidor: npm start');
      console.log('   2. Ejecuta: SERVER_RUNNING=true npm test tests/api.test.js');
    }
  });

  (serverRunning ? test : test.skip)('GET / debe responder con status 200', async () => {
    const response = await axios.get(BASE_URL);
    expect(response.status).toBe(200);
  });

  (serverRunning ? test : test.skip)('GET /webhook debe responder con WEBHOOK_VERIFY_TOKEN', async () => {
    const response = await axios.get(`${BASE_URL}/webhook`, {
      params: {
        'hub.mode': 'subscribe',
        'hub.verify_token': process.env.WEBHOOK_VERIFY_TOKEN || 'test_token',
        'hub.challenge': 'test_challenge'
      }
    });
    
    expect(response.status).toBe(200);
    expect(response.data).toBe('test_challenge');
  });

  (serverRunning ? test : test.skip)('GET /webhook sin parámetros debe responder 403', async () => {
    try {
      await axios.get(`${BASE_URL}/webhook`);
      fail('Debería haber lanzado un error 403');
    } catch (error) {
      expect(error.response.status).toBe(403);
    }
  });

  (serverRunning ? test : test.skip)('GET /health debe responder con estado del sistema', async () => {
    const response = await axios.get(`${BASE_URL}/health`);
    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('status');
  });

  // Test básico que siempre corre
  test('Variables de entorno están configuradas', () => {
    expect(process.env.WHATSAPP_TOKEN).toBeDefined();
    expect(process.env.WHATSAPP_PHONE_NUMBER_ID).toBeDefined();
  });
});
