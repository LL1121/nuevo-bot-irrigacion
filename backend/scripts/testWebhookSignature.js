#!/usr/bin/env node
const crypto = require('crypto');
const axios = require('axios');

const BASE_URL = process.env.WEBHOOK_TEST_BASE_URL || process.env.BASE_URL || 'http://localhost:3000';
const WEBHOOK_PATH = process.env.WEBHOOK_TEST_PATH || '/webhook';
const WEBHOOK_SECRET = process.env.WEBHOOK_APP_SECRET || process.env.WHATSAPP_APP_SECRET || process.env.META_APP_SECRET;
const MODE = String(process.env.WEBHOOK_SIGNATURE_TEST_MODE || 'both').toLowerCase();

if (!WEBHOOK_SECRET) {
  console.error('❌ Falta secret: WEBHOOK_APP_SECRET / WHATSAPP_APP_SECRET / META_APP_SECRET');
  process.exit(2);
}

const endpoint = `${BASE_URL.replace(/\/+$/, '')}${WEBHOOK_PATH.startsWith('/') ? WEBHOOK_PATH : `/${WEBHOOK_PATH}`}`;
const nowTs = String(Math.floor(Date.now() / 1000));
const body = {
  object: 'whatsapp_business_account',
  entry: [{
    changes: [{
      value: {
        messaging_product: 'whatsapp',
        metadata: { display_phone_number: '5492600000000', phone_number_id: '1234567890' },
        contacts: [{ wa_id: '5492600000000', profile: { name: 'WebhookSigTest' } }],
        messages: [{ from: '5492600000000', id: `sig_test_${Date.now()}`, timestamp: nowTs, type: 'text', text: { body: 'hola firma' } }]
      }
    }]
  }]
};

const payload = JSON.stringify(body);
const sign = (secret, data) => `sha256=${crypto.createHmac('sha256', secret).update(data, 'utf8').digest('hex')}`;

async function postWithSignature(signature) {
  return axios.post(endpoint, payload, {
    headers: { 'Content-Type': 'application/json', 'x-hub-signature-256': signature },
    validateStatus: () => true,
    timeout: Number(process.env.WEBHOOK_SIGNATURE_TEST_TIMEOUT_MS || 15000)
  });
}

async function run() {
  console.log(`🔎 Probando firma webhook en ${endpoint}`);
  console.log(`🧪 Modo: ${MODE}`);

  let hasFailure = false;

  if (MODE === 'both' || MODE === 'valid') {
    const r = await postWithSignature(sign(WEBHOOK_SECRET, payload));
    console.log(`\n✅ Caso firma válida:\n   Status: ${r.status}\n   Body: ${JSON.stringify(r.data)}`);
    if (!(r.status >= 200 && r.status < 300)) {
      hasFailure = true;
      console.error('   ❌ Esperaba 2xx para firma válida');
    }
  }

  if (MODE === 'both' || MODE === 'invalid') {
    const r = await postWithSignature(sign(`${WEBHOOK_SECRET}_invalid`, payload));
    console.log(`\n🚫 Caso firma inválida:\n   Status: ${r.status}\n   Body: ${JSON.stringify(r.data)}`);
    if (r.status !== 403) {
      hasFailure = true;
      console.error('   ❌ Esperaba 403 para firma inválida');
    }
  }

  if (hasFailure) {
    console.error('\n❌ Test de firma webhook FALLÓ');
    process.exit(1);
  }

  console.log('\n✅ Test de firma webhook OK');
  process.exit(0);
}

run().catch((error) => {
  console.error('\n❌ Error ejecutando test de firma webhook');
  console.error(error?.response?.status ? `Status: ${error.response.status}` : error.message);
  console.error(error?.response?.data ? `Body: ${JSON.stringify(error.response.data)}` : '');
  process.exit(1);
});
