#!/usr/bin/env node

/**
 * Script de Load Testing con Autocannon
 * Simula carga realista y mide performance
 */

const autocannon = require('autocannon');

async function runLoadTest() {
  console.log('🚀 Iniciando Load Test...\n');
  
  const result = await autocannon({
    url: 'http://localhost:3000',
    connections: 100, // 100 conexiones simultáneas
    pipelining: 10, // 10 requests en pipeline
    duration: 30, // 30 segundos
    requests: [
      {
        path: '/health',
        method: 'GET',
        weight: 5, // 50% de las requests
        title: 'Health Check'
      },
      {
        path: '/api/chats',
        method: 'GET',
        weight: 3, // 30% de las requests
        title: 'Get Chats'
      },
      {
        path: '/webhook',
        method: 'POST',
        method: 'POST',
        weight: 2, // 20% de las requests
        body: JSON.stringify({
          entry: [{
            changes: [{
              value: {
                messaging_product: 'whatsapp',
                messages: [{
                  from: '5491234567890',
                  id: 'test123',
                  timestamp: Date.now(),
                  text: { body: 'Test message' }
                }]
              }
            }]
          }],
          object: 'whatsapp_business_account'
        }),
        title: 'Webhook Event'
      }
    ]
  });

  // Mostrar resultados
  console.log('\n' + '='.repeat(70));
  console.log('📊 LOAD TEST RESULTS');
  console.log('='.repeat(70));
  
  console.log('\n⚡ THROUGHPUT');
  console.log(`  Requests/sec: ${Math.round(result.throughput.average)}`);
  console.log(`  Min: ${Math.round(result.throughput.min)}`);
  console.log(`  Max: ${Math.round(result.throughput.max)}`);
  
  console.log('\n⏱️  LATENCY');
  console.log(`  Mean: ${Math.round(result.latency.mean)}ms`);
  console.log(`  P50: ${Math.round(result.latency.p50)}ms`);
  console.log(`  P95: ${Math.round(result.latency.p95)}ms`);
  console.log(`  P99: ${Math.round(result.latency.p99)}ms`);
  
  console.log('\n✅ REQUESTS');
  console.log(`  Total: ${result.requests.total}`);
  console.log(`  Average/sec: ${Math.round(result.requests.average)}`);
  
  console.log('\n❌ ERRORS & ISSUES');
  console.log(`  Errors: ${result.errors || 0}`);
  console.log(`  Timeouts: ${result.timeouts || 0}`);
  console.log(`  2xx: ${result.statusCodeStats['2xx'] || 0}`);
  console.log(`  4xx: ${result.statusCodeStats['4xx'] || 0}`);
  console.log(`  5xx: ${result.statusCodeStats['5xx'] || 0}`);
  
  console.log('\n📈 PERFORMANCE ASSESSMENT');
  
  const meanLatency = result.latency.mean;
  if (meanLatency < 50) {
    console.log('  ✅ Excelente - Latencia < 50ms');
  } else if (meanLatency < 100) {
    console.log('  ✅ Muy bueno - Latencia < 100ms');
  } else if (meanLatency < 200) {
    console.log('  ⚠️  Aceptable - Latencia < 200ms');
  } else if (meanLatency < 500) {
    console.log('  ⚠️  Lento - Latencia < 500ms');
  } else {
    console.log('  ❌ Muy lento - Latencia > 500ms');
  }
  
  const p99 = result.latency.p99;
  if (p99 < 200) {
    console.log('  ✅ P99 bajo - Buena experiencia de usuarios');
  } else if (p99 < 500) {
    console.log('  ⚠️  P99 medio - Algunos usuarios experimentan latencia');
  } else {
    console.log('  ❌ P99 alto - Muchos usuarios afectados');
  }
  
  const errorRate = (result.errors / result.requests.total) * 100;
  if (errorRate === 0) {
    console.log('  ✅ Sin errores - Confiabilidad perfecta');
  } else if (errorRate < 0.1) {
    console.log(`  ✅ ${errorRate.toFixed(2)}% errors - Muy confiable`);
  } else if (errorRate < 1) {
    console.log(`  ⚠️  ${errorRate.toFixed(2)}% errors - Aceptable`);
  } else {
    console.log(`  ❌ ${errorRate.toFixed(2)}% errors - Problemas de confiabilidad`);
  }
  
  console.log('\n' + '='.repeat(70));
  
  // Definir límites de performance (SLA)
  const sla = {
    maxLatency: 200, // P99 < 200ms
    maxP95: 150,     // P95 < 150ms
    minThroughput: 50, // Al menos 50 req/s
    maxErrorRate: 0.1 // Máximo 0.1% errores
  };
  
  let slaPass = true;
  
  if (result.latency.p99 > sla.maxLatency) {
    console.log(`\n❌ FAILED SLA: P99 latency ${result.latency.p99}ms > ${sla.maxLatency}ms`);
    slaPass = false;
  }
  
  if (result.latency.p95 > sla.maxP95) {
    console.log(`\n❌ FAILED SLA: P95 latency ${result.latency.p95}ms > ${sla.maxP95}ms`);
    slaPass = false;
  }
  
  if (result.throughput.average < sla.minThroughput) {
    console.log(`\n❌ FAILED SLA: Throughput ${Math.round(result.throughput.average)} < ${sla.minThroughput} req/s`);
    slaPass = false;
  }
  
  if (errorRate > sla.maxErrorRate) {
    console.log(`\n❌ FAILED SLA: Error rate ${errorRate.toFixed(2)}% > ${sla.maxErrorRate}%`);
    slaPass = false;
  }
  
  if (slaPass) {
    console.log('\n✅ ALL SLA CHECKS PASSED');
  }
  
  process.exit(slaPass ? 0 : 1);
}

// Verificar que el servidor esté corriendo
const http = require('http');
const checkServer = () => {
  return new Promise((resolve) => {
    const req = http.get('http://localhost:3000/health', (res) => {
      resolve(res.statusCode === 200);
    }).on('error', () => resolve(false));
  });
};

(async () => {
  const serverRunning = await checkServer();
  if (!serverRunning) {
    console.error('❌ Servidor no está corriendo en http://localhost:3000');
    console.error('💡 Inicia el servidor con: npm start');
    process.exit(1);
  }
  
  runLoadTest();
})();
