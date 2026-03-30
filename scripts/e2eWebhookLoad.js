#!/usr/bin/env node
const crypto = require('crypto');
const autocannon = require('autocannon');

const baseUrl = process.env.LOAD_BASE_URL || 'http://localhost:3000';
const secret = process.env.WEBHOOK_APP_SECRET || process.env.WHATSAPP_APP_SECRET || process.env.META_APP_SECRET;
const connections = Number(process.env.LOAD_CONNECTIONS || 50);
const duration = Number(process.env.LOAD_DURATION || 20);
const usersPool = Number(process.env.LOAD_USERS_POOL || 5000);
const templates = Number(process.env.LOAD_REQUEST_TEMPLATES || 1000);
const p95Sla = Number(process.env.LOAD_SLA_P95_MS || 500);
const errorSla = Number(process.env.LOAD_SLA_ERROR_RATE || 1.0);

if (!secret) {
  console.error('❌ WEBHOOK_APP_SECRET/WHATSAPP_APP_SECRET/META_APP_SECRET no configurado');
  process.exit(2);
}

const buildPayload = (index) => {
  const uid = (index % usersPool) + 1;
  const phone = `54926${String(uid).padStart(7, '0')}`;
  const body = {
    object: 'whatsapp_business_account',
    entry: [{
      changes: [{
        value: {
          messaging_product: 'whatsapp',
          metadata: {
            display_phone_number: '5492600000000',
            phone_number_id: '1234567890'
          },
          contacts: [{ wa_id: phone, profile: { name: `LoadUser_${uid}` } }],
          messages: [{
            from: phone,
            id: `m_${Date.now()}_${index}`,
            timestamp: String(Math.floor(Date.now() / 1000)),
            type: 'text',
            text: { body: `hola ${index}` }
          }]
        }
      }]
    }]
  };

  const payload = JSON.stringify(body);
  const signature = `sha256=${crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex')}`;
  return { payload, signature };
};

const firstTemplate = buildPayload(0);

console.log(`🚀 Load test webhook -> ${baseUrl}/webhook`);
console.log(`⚙️ connections=${connections} duration=${duration}s templates=${templates} usersPool=${usersPool}`);

const instance = autocannon({
  url: `${baseUrl.replace(/\/$/, '')}/webhook`,
  method: 'POST',
  connections,
  duration,
  headers: {
    'content-type': 'application/json',
    'x-hub-signature-256': firstTemplate.signature
  },
  body: firstTemplate.payload
}, (err, result) => {
  if (err) {
    console.error('❌ Error en load test:', err.message);
    process.exit(1);
  }

  const p95 = result.latency?.p95 || 0;
  const total = result.requests?.total || 0;
  const errors = (result.errors || 0) + (result.timeouts || 0);
  const errorRate = total > 0 ? (errors * 100) / total : 100;

  console.log(`\n📊 Requests total=${total} | errors=${errors} (${errorRate.toFixed(2)}%) | p95=${p95}ms`);

  const p95Ok = p95 <= p95Sla;
  const errOk = errorRate <= errorSla;

  if (p95Ok && errOk) {
    console.log('✅ SLA OK');
    process.exit(0);
  }

  console.error(`❌ SLA FAIL -> p95<=${p95Sla}ms:${p95Ok} | errorRate<=${errorSla}%:${errOk}`);
  process.exit(1);
});

autocannon.track(instance, { renderProgressBar: true });
