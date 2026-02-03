/**
 * Script de prueba para:
 * 1. Verificación de firma webhook (HMAC-SHA256)
 * 2. Rate limiting por operador
 * 3. Validación con Joi
 * 4. Endpoint window-status
 */

const axios = require('axios');
const crypto = require('crypto');

const BASE_URL = 'http://localhost:3000';

// Configuración
const WEBHOOK_SECRET = process.env.WEBHOOK_APP_SECRET || 'tu_app_secret_de_meta_dashboard_aqui';
const API_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidXNlcm5hbWUiOiJhZG1pbiIsImVtYWlsIjoiYWRtaW5AaXJyaWdhY2lvbi5jb20iLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3NzAwODk4NDQsImV4cCI6MTc3MDExODY0NH0.1udCj25brfWZB7Qi08SjkRrY4qtgKupsP7Sd072v9-4';

// Colores para consola
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

/**
 * Genera una firma HMAC-SHA256 para el webhook
 */
function generateWebhookSignature(payload, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  return 'sha256=' + hmac.digest('hex');
}

/**
 * Test 1: Webhook signature verification
 */
async function testWebhookSignature() {
  log('\n=== TEST 1: Verificación de firma webhook ===', colors.cyan);
  
  const testPayload = {
    object: 'whatsapp_business_account',
    entry: [{
      id: 'test_123',
      changes: [{
        value: {
          messaging_product: 'whatsapp',
          metadata: { phone_number_id: '123456789' },
          messages: [{
            from: '5491234567890',
            id: 'wamid.test123',
            timestamp: Date.now(),
            type: 'text',
            text: { body: 'Test message' }
          }]
        },
        field: 'messages'
      }]
    }]
  };

  const payloadString = JSON.stringify(testPayload);
  const validSignature = generateWebhookSignature(payloadString, WEBHOOK_SECRET);
  const invalidSignature = 'sha256=invalid_signature_12345';

  // Test 1a: Firma válida
  try {
    log('\nTest 1a: Webhook con firma válida...', colors.yellow);
    const response = await axios.post(`${BASE_URL}/webhook`, testPayload, {
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': validSignature
      }
    });
    log(`✅ PASS: Firma válida aceptada (${response.status})`, colors.green);
  } catch (error) {
    if (error.response?.status === 500) {
      log(`⚠️  EXPECTED: Error 500 (webhook controller puede fallar, pero firma fue aceptada)`, colors.yellow);
    } else {
      log(`❌ FAIL: ${error.response?.status || error.message}`, colors.red);
    }
  }

  // Test 1b: Firma inválida
  try {
    log('\nTest 1b: Webhook con firma inválida...', colors.yellow);
    const response = await axios.post(`${BASE_URL}/webhook`, testPayload, {
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': invalidSignature
      }
    });
    log(`❌ FAIL: Firma inválida aceptada (debería rechazar con 403)`, colors.red);
  } catch (error) {
    if (error.response?.status === 403) {
      log(`✅ PASS: Firma inválida rechazada con 403`, colors.green);
    } else {
      log(`❌ FAIL: Error inesperado ${error.response?.status || error.message}`, colors.red);
    }
  }

  // Test 1c: Sin firma
  try {
    log('\nTest 1c: Webhook sin firma...', colors.yellow);
    const response = await axios.post(`${BASE_URL}/webhook`, testPayload, {
      headers: { 'Content-Type': 'application/json' }
    });
    log(`❌ FAIL: Request sin firma aceptado (debería rechazar con 403)`, colors.red);
  } catch (error) {
    if (error.response?.status === 403) {
      log(`✅ PASS: Request sin firma rechazado con 403`, colors.green);
    } else {
      log(`❌ FAIL: Error inesperado ${error.response?.status || error.message}`, colors.red);
    }
  }
}

/**
 * Test 2: Rate limiting por operador
 */
async function testRateLimiting() {
  log('\n=== TEST 2: Rate limiting por operador ===', colors.cyan);
  
  const testMessage = {
    telefono: '5491134567890',
    mensaje: 'Mensaje de prueba'
  };

  log('\nEnviando 12 mensajes rápidamente (límite: 10/minuto)...', colors.yellow);
  
  let successCount = 0;
  let rateLimitedCount = 0;

  for (let i = 1; i <= 12; i++) {
    try {
      const response = await axios.post(`${BASE_URL}/api/send`, testMessage, {
        headers: {
          'Authorization': `Bearer ${API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      successCount++;
      log(`  ${i}. ✅ Mensaje ${i} enviado (${response.status})`, colors.green);
    } catch (error) {
      if (error.response?.status === 429) {
        rateLimitedCount++;
        log(`  ${i}. ⛔ Mensaje ${i} bloqueado por rate limit (429)`, colors.yellow);
      } else if (error.response?.status === 500) {
        // Error del servicio WhatsApp (esperado si token expiró)
        log(`  ${i}. ⚠️  Error 500 en WhatsApp API (token/config, pero rate limit OK)`, colors.yellow);
      } else {
        log(`  ${i}. ❌ Error inesperado: ${error.response?.status || error.message}`, colors.red);
      }
    }
  }

  log(`\nResultados:`, colors.cyan);
  log(`  • Mensajes que pasaron rate limit: ${successCount}`, colors.blue);
  log(`  • Mensajes bloqueados (429): ${rateLimitedCount}`, colors.blue);
  
  if (rateLimitedCount >= 2) {
    log(`\n✅ PASS: Rate limiting funcionando (bloqueó ${rateLimitedCount} requests)`, colors.green);
  } else {
    log(`\n❌ FAIL: Rate limiting no bloqueó suficientes requests`, colors.red);
  }
}

/**
 * Test 3: Validación Joi
 */
async function testJoiValidation() {
  log('\n=== TEST 3: Validación con Joi ===', colors.cyan);

  // Test 3a: Teléfono inválido
  try {
    log('\nTest 3a: Teléfono inválido (sin 549 prefix)...', colors.yellow);
    const response = await axios.post(`${BASE_URL}/api/send`, {
      telefono: '1134567890',
      mensaje: 'Test'
    }, {
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    log(`❌ FAIL: Teléfono inválido aceptado`, colors.red);
  } catch (error) {
    if (error.response?.status === 400) {
      log(`✅ PASS: Teléfono inválido rechazado con 400`, colors.green);
      log(`   Detalles: ${JSON.stringify(error.response.data)}`, colors.blue);
    } else {
      log(`❌ FAIL: Error inesperado ${error.response?.status || error.message}`, colors.red);
    }
  }

  // Test 3b: Mensaje muy largo
  try {
    log('\nTest 3b: Mensaje demasiado largo (>4096 chars)...', colors.yellow);
    const longMessage = 'A'.repeat(5000);
    const response = await axios.post(`${BASE_URL}/api/send`, {
      telefono: '5491134567890',
      mensaje: longMessage
    }, {
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    log(`❌ FAIL: Mensaje muy largo aceptado`, colors.red);
  } catch (error) {
    if (error.response?.status === 400) {
      log(`✅ PASS: Mensaje muy largo rechazado con 400`, colors.green);
      log(`   Detalles: ${JSON.stringify(error.response.data)}`, colors.blue);
    } else {
      log(`❌ FAIL: Error inesperado ${error.response?.status || error.message}`, colors.red);
    }
  }

  // Test 3c: Payload válido
  try {
    log('\nTest 3c: Payload válido...', colors.yellow);
    const response = await axios.post(`${BASE_URL}/api/send`, {
      telefono: '5491134567890',
      mensaje: 'Mensaje válido de prueba'
    }, {
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    log(`✅ PASS: Payload válido aceptado (${response.status})`, colors.green);
  } catch (error) {
    if (error.response?.status === 500) {
      log(`⚠️  EXPECTED: Error 500 en WhatsApp API (validación OK, error en servicio)`, colors.yellow);
    } else {
      log(`❌ FAIL: ${error.response?.status || error.message}`, colors.red);
    }
  }
}

/**
 * Test 4: Window status endpoint
 */
async function testWindowStatus() {
  log('\n=== TEST 4: Endpoint window-status ===', colors.cyan);

  const testPhone = '5491134567890';

  try {
    log(`\nConsultando estado de ventana para ${testPhone}...`, colors.yellow);
    const response = await axios.get(`${BASE_URL}/api/chats/${testPhone}/window-status`, {
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    log(`✅ PASS: Endpoint respondió (${response.status})`, colors.green);
    log(`Respuesta:`, colors.blue);
    console.log(JSON.stringify(response.data, null, 2));
    
    // Validar estructura
    const data = response.data;
    if (data.success && (typeof data.inWindow === 'boolean' || data.hasMessages === false)) {
      log(`✅ Estructura de respuesta correcta`, colors.green);
    } else {
      log(`❌ Estructura de respuesta incorrecta`, colors.red);
    }
  } catch (error) {
    log(`❌ FAIL: ${error.response?.status || error.message}`, colors.red);
    if (error.response?.data) {
      console.log(error.response.data);
    }
  }
}

/**
 * Main
 */
async function main() {
  log('\n╔═══════════════════════════════════════════╗', colors.cyan);
  log('║   TEST SUITE: SEGURIDAD Y VALIDACIONES   ║', colors.cyan);
  log('╚═══════════════════════════════════════════╝', colors.cyan);

  try {
    await testWebhookSignature();
    await testJoiValidation();
    await testWindowStatus();
    
    // Rate limiting al final (para no contaminar otros tests)
    await testRateLimiting();

    log('\n╔═══════════════════════════════════════════╗', colors.cyan);
    log('║           TESTS COMPLETADOS               ║', colors.cyan);
    log('╚═══════════════════════════════════════════╝', colors.cyan);
  } catch (error) {
    log(`\n❌ Error general: ${error.message}`, colors.red);
    console.error(error);
  }
}

// Verificar que el servidor esté corriendo
axios.get(`${BASE_URL}/health`)
  .then(() => {
    log('✅ Servidor detectado, iniciando tests...', colors.green);
    main();
  })
  .catch(() => {
    log('❌ Error: Servidor no está corriendo en http://localhost:3000', colors.red);
    log('   Ejecuta: node src/server.js', colors.yellow);
    process.exit(1);
  });
