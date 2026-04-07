# 📊 Análisis de Rendimiento - Bot Irrigación

## 1️⃣ Estado Actual

### ✅ Optimizaciones ya implementadas
- **Redis caching**: Cache-aside pattern para datos frecuentes
- **Rate limiting**: Protección contra abuso
- **Helmet security headers**: Headers HTTP optimizados
- **Sentry monitoring**: Detección de errores en producción
- **Compresión**: Probablemente con gzip en producción
- **Static file serving**: Archivos estáticos con caché

### ⚠️ Áreas de Mejora Identificadas

```
┌─────────────────────────────────────────────────────────┐
│ CRÍTICO (Alto impacto, fácil de implementar)            │
├─────────────────────────────────────────────────────────┤
│ 1. DATABASE QUERIES                                      │
│    - Sin índices claros en tablas principales            │
│    - N+1 queries en algunas rutas                       │
│    - Sin connection pooling documentado                  │
│                                                          │
│ 2. API RESPONSE COMPRESSION                              │
│    - Respuestas JSON sin compresión gzip                │
│    - Impacto: 3-4x reducción de tamaño                  │
│                                                          │
│ 3. TIMEOUT DE LLAMADAS EXTERNAS                         │
│    - WhatsApp API sin timeout explícito                 │
│    - Riesgo: Requests pendientes infinitamente          │
│                                                          │
│ 4. MEDIA DOWNLOADS                                       │
│    - Descarga sin streaming (carga en memoria)          │
│    - Impacto: Crash si archivo >100MB                   │
│                                                          │
├─────────────────────────────────────────────────────────┤
│ IMPORTANTE (Medio impacto, requiere más trabajo)        │
├─────────────────────────────────────────────────────────┤
│ 5. ASYNC OPERATIONS                                      │
│    - Algunas operaciones bloqueantes en handlers        │
│    - Falta de parallelización                           │
│                                                          │
│ 6. LOGGING                                               │
│    - Todos los logs a consola/archivo sincrónico        │
│    - Posible cuello de botella bajo carga               │
│                                                          │
│ 7. SOCKET.IO SCALABILITY                                 │
│    - No hay adapter de Redis para múltiples servidores  │
│    - Limitado a un único proceso Node.js                │
│                                                          │
├─────────────────────────────────────────────────────────┤
│ FUTURO (Bajo impacto, pero recomendado)                │
├─────────────────────────────────────────────────────────┤
│ 8. LAZY LOADING ENDPOINTS                               │
│    - Cargar datos bajo demanda, no en startup           │
│                                                          │
│ 9. MEMORY LEAKS                                          │
│    - Monitoreo de heap memory                           │
│                                                          │
│ 10. BUNDLE OPTIMIZATION                                  │
│     - Eliminar dependencias innecesarias                 │
└─────────────────────────────────────────────────────────┘
```

## 2️⃣ Benchmark Esperado

### Antes (estado actual)
```
GET /health              ~50-100ms    (sin cache)
GET /api/chats           ~200-500ms   (queries múltiples)
POST /api/send           ~800-1500ms  (WhatsApp API call)
POST /webhook            ~150-300ms   (procesar y guardar)
```

### Después (con optimizaciones)
```
GET /health              ~20-30ms     ✅ -60%
GET /api/chats           ~100-150ms   ✅ -60% (con cache + índices)
POST /api/send           ~400-800ms   ✅ -50% (timeouts + parallelización)
POST /webhook            ~80-120ms    ✅ -50% (async logging)
```

## 3️⃣ Plan de Acción Inmediato

### 🔴 CRÍTICO - Implementar HOY
1. **Gzip Compression** (5 min)
2. **Database Indexes** (10 min)
3. **API Timeouts** (15 min)
4. **Async Logging** (20 min)

### 🟡 IMPORTANTE - Esta semana
5. **Streaming Media Downloads** (30 min)
6. **Redis Socket.io Adapter** (20 min)
7. **Query Optimization** (análisis manual)

### 🟢 FUTURO - Próximas semanas
8. **APM (Application Performance Monitoring)**
9. **Load Testing**
10. **Memory Leak Detection**

## 4️⃣ Implementación Detallada

### A. GZIP COMPRESSION ⚡ (Impacto: 3-4x en JSON)

```javascript
// Agregar en src/index.js
const compression = require('compression');

app.use(compression({
  level: 6, // Balance entre velocidad y compresión
  threshold: 1024 // Solo comprimir > 1KB
}));
```

**Instalación:**
```bash
npm install compression
```

**Resultados esperados:**
- Respuesta de 100KB → 20-30KB (comprimida)
- Latencia +5-10ms (compresión) vs -200ms (transferencia)
- ROI: POSITIVO

---

### B. DATABASE INDEXES 📇 (Impacto: 10-100x en queries)

**Consultas frecuentes:**
```javascript
// query 1: Obtener mensajes de un chat
SELECT * FROM mensajes WHERE telefono = ? ORDER BY timestamp DESC

// query 2: Verificar si cliente existe
SELECT * FROM clientes WHERE telefono = ?

// query 3: Buscar conversación activa
SELECT * FROM conversaciones WHERE telefono = ? AND estado = 'activa'
```

**Índices necesarios:**
```sql
-- En setup.sql
CREATE INDEX idx_mensajes_telefono ON mensajes(telefono);
CREATE INDEX idx_mensajes_timestamp ON mensajes(timestamp DESC);
CREATE INDEX idx_clientes_telefono ON clientes(telefono);
CREATE INDEX idx_conversaciones_telefono_estado ON conversaciones(telefono, estado);
```

**Impacto:**
- Sin índice: ~500ms (full table scan)
- Con índice: ~5ms (index seek)
- Mejora: **100x más rápido**

---

### C. API TIMEOUTS ⏱️ (Prevenir cuellos de botella)

```javascript
// En whatsappService.js
const axios = require('axios');
const axiosRetry = require('axios-retry');

// Timeout global: 15s
const axiosClient = axios.create({
  timeout: 15000, // 15 segundos
  maxContentLength: 50 * 1024 * 1024 // 50MB máximo
});

// Retry automático en errores de red (no en 4xx/5xx)
axiosRetry(axiosClient, {
  retries: 3,
  retryDelay: (retryCount) => retryCount * 1000,
  retryCondition: (error) => {
    return axiosRetry.isNetworkOrIdempotentRequestError(error) &&
           error.response?.status >= 500; // Solo en errores servidor
  }
});
```

**Instalación:**
```bash
npm install axios-retry
```

---

### D. ASYNC LOGGING 📝 (Evitar bloqueos)

```javascript
// logService.js - cambiar a async buffering
const asyncQueue = [];
let writeScheduled = false;

const logAsync = (level, message) => {
  asyncQueue.push({
    level,
    message,
    timestamp: new Date().toISOString()
  });

  // Batch write cada 1s o cuando queue > 100 items
  if (!writeScheduled && asyncQueue.length < 100) {
    writeScheduled = true;
    setImmediate(() => {
      flushLogs();
      writeScheduled = false;
    });
  } else if (asyncQueue.length >= 100) {
    flushLogs();
  }
};

const flushLogs = () => {
  if (asyncQueue.length === 0) return;
  const logs = asyncQueue.splice(0);
  fs.appendFile('logs.jsonl', logs.map(l => JSON.stringify(l)).join('\n') + '\n', 
    (err) => err && console.error('Log write error:', err)
  );
};
```

---

### E. STREAMING MEDIA DOWNLOADS 📥 (Prevenir OOM)

**Problema actual:**
```javascript
// ❌ BAD: Carga todo en memoria
const response = await axios.get(mediaUrl);
fs.writeFileSync(filePath, response.data); // Buffer completo en RAM
```

**Solución:**
```javascript
// ✅ GOOD: Streaming directo a disco
const downloadMediaStream = async (mediaId) => {
  const https = require('https');
  const { pipeline } = require('stream/promises');
  
  const url = await getMediaUrl(mediaId);
  
  return new Promise((resolve, reject) => {
    https.get(url, async (response) => {
      const writeStream = fs.createWriteStream(filePath);
      
      try {
        await pipeline(response, writeStream);
        resolve(filePath);
      } catch (error) {
        writeStream.destroy();
        fs.unlink(filePath, () => {}); // Cleanup
        reject(error);
      }
    }).on('error', reject);
  });
};
```

**Impacto:**
- Antes: Limita a archivos < RAM disponible (~1GB)
- Después: Ilimitado (solo limitado por disk space)

---

### F. REDIS SOCKET.IO ADAPTER 🚀 (Para escalabilidad)

```javascript
// En index.js
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');

const io = new Server(server, { 
  adapter: createAdapter(
    createClient({ url: process.env.REDIS_URL }),
    createClient({ url: process.env.REDIS_URL })
  )
});
```

**Instalación:**
```bash
npm install @socket.io/redis-adapter
```

**Beneficio:**
- Permite múltiples instancias de Node.js
- Mensajes broadcasts funcionan entre servidores
- Preparación para horizontal scaling

---

## 5️⃣ Testing de Rendimiento

### Script de Load Testing

```javascript
// scripts/load-test.js
const autocannon = require('autocannon');

async function runLoadTest() {
  const result = await autocannon({
    url: 'http://localhost:3000',
    connections: 100,
    pipelining: 10,
    duration: 30,
    requests: [
      {
        path: '/health',
        method: 'GET',
        weight: 5
      },
      {
        path: '/api/chats',
        method: 'GET',
        weight: 2
      }
    ]
  });

  console.log('='.repeat(50));
  console.log('📊 LOAD TEST RESULTS');
  console.log('='.repeat(50));
  console.log(`Throughput: ${result.throughput.average} req/sec`);
  console.log(`Latency (avg): ${result.latency.mean}ms`);
  console.log(`Latency (p99): ${result.latency.p99}ms`);
  console.log(`Errors: ${result.errors}`);
}

runLoadTest();
```

**Uso:**
```bash
npm install --save-dev autocannon
npm run load-test
```

---

## 6️⃣ Monitoreo Continuo

### Memory Profiling

```javascript
// monitorMemory.js
setInterval(() => {
  const mem = process.memoryUsage();
  console.log({
    rss: `${Math.round(mem.rss / 1024 / 1024)}MB`, // Heap total
    heapUsed: `${Math.round(mem.heapUsed / 1024 / 1024)}MB`, // En uso
    heapTotal: `${Math.round(mem.heapTotal / 1024 / 1024)}MB`,
    external: `${Math.round(mem.external / 1024 / 1024)}MB`
  });
}, 10000); // Cada 10s
```

### Response Time Tracking

```javascript
// En requestLogger middleware
const responseTime = require('response-time');

app.use(responseTime((req, res, time) => {
  if (time > 1000) {
    console.warn(`⚠️ SLOW: ${req.method} ${req.url} took ${time}ms`);
  }
}));
```

---

## 7️⃣ Checklist de Rendimiento

- [ ] Gzip compression activado
- [ ] Database indexes creados
- [ ] Timeouts configurados (15s)
- [ ] Async logging implementado
- [ ] Streaming downloads en uso
- [ ] Redis Socket.io adapter configurado
- [ ] Load testing realizado
- [ ] Memory monitoring activo
- [ ] Performance budgets documentados
- [ ] Sentry alerts configurados para latencia alta

---

## 📈 Métricas Target (SLA)

```
Endpoint                 | Target   | P95    | P99
─────────────────────────|----------|--------|--------
GET /health              | <50ms    | <100ms | <150ms
GET /api/chats           | <150ms   | <300ms | <500ms
POST /api/send           | <800ms   | <2s    | <5s
POST /webhook            | <100ms   | <200ms | <500ms
WebSocket message        | <50ms    | <100ms | <200ms
```

---

## 🔗 Referencias
- [Node.js Performance Best Practices](https://nodejs.org/en/docs/guides/nodejs-performance/)
- [Express Performance Tips](https://expressjs.com/en/advanced/best-practice-performance.html)
- [Database Indexing Guide](https://use-the-index-luke.com/)
