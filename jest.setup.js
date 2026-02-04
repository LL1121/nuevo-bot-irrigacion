// Setup global para Jest
// Aquí puedes configurar mocks globales, variables de entorno, etc.

// Mock de variables de entorno para tests
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.JWT_SECRET = 'test_jwt_secret_key_for_testing_only';
process.env.WHATSAPP_TOKEN = 'test_whatsapp_token';
process.env.WHATSAPP_PHONE_ID = 'test_phone_id';
process.env.WEBHOOK_VERIFY_TOKEN = 'test_webhook_token';
process.env.WEBHOOK_APP_SECRET = 'test_app_secret';
process.env.DB_HOST = 'localhost';
process.env.DB_USER = 'test';
process.env.DB_PASSWORD = 'test';
process.env.DB_NAME = 'irrigacion_test';

// Silenciar console.log en tests (opcional)
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
//   error: jest.fn(),
// };
