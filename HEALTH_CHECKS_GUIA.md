# 🏥 Health Checks - Guía Completa

## Descripción General

El sistema de **health checks** proporciona visibilidad en tiempo real del estado de todos los componentes críticos del bot de WhatsApp. Permite:

✅ **Monitoreo proactivo** - Detectar fallos antes de que afecten usuarios  
✅ **Load balancer integration** - Kubernetes, Docker Swarm pueden retirar instancias caídas  
✅ **Alertas automáticas** - Integración con Prometheus, Datadog, Grafana  
✅ **Debugging rápido** - Identificar exactamente qué componente falla  

## Endpoints Health Check

### 1️⃣ `GET /api/health` (Público)

Health check **básico y rápido** - Sin autenticación, ideal para load balancers.

**Respuesta (Status OK):**
```json
{
  "status": "ok",
  "timestamp": "2026-01-07T14:30:00.000Z",
  "uptime": 3600.5,
  "checkDuration": 125,
  "checks": {
    "database": {
      "status": "ok",
      "message": "Base de datos funcionando correctamente",
      "latency": "12ms"
    },
    "whatsapp": {
      "status": "ok",
      "message": "Credenciales de WhatsApp configuradas correctamente",
      "version": "v21.0"
    },
    "puppeteer": {
      "status": "ok",
      "message": "Puppeteer y Chrome disponibles para web scraping",
      "canLaunchBrowser": true
    },
    "resources": {
      "status": "ok",
      "message": "✅ Espacio disponible: 50.25 GB",
      "disk": {
        "total": 238,
        "free": 50,
        "used": 188,
        "percentUsed": "78.99"
      },
      "memory": {
        "total": 16384,
        "free": 4096,
        "used": 12288,
        "percentUsed": "75.00"
      }
    }
  }
}
```

**HTTP Status Codes:**
- `200 OK` - Todo bien ✅
- `503 Service Unavailable` - Componentes críticos caídos ⚠️

---

### 2️⃣ `GET /api/health/detailed` (Requiere Auth)

Health check **detallado** - Incluye información sensible (solo para admins).

**Headers requeridos:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Respuesta adicional (además de `/api/health`):**
```json
{
  "environment": {
    "nodeVersion": "v18.15.0",
    "platform": "win32",
    "arch": "x64",
    "env": "production"
  },
  "config": {
    "port": 3000,
    "databaseName": "irrigacion_bot",
    "whatsappApiVersion": "v21.0",
    "jwtExpiry": "8h",
    "backupEnabled": true,
    "backupSchedule": "0 2 */3 * *"
  }
}
```

---

### 3️⃣ `GET /api/health/database`

Verifica **solo la base de datos**.

```bash
curl http://localhost:3000/api/health/database
```

**Respuesta:**
```json
{
  "component": "database",
  "status": "ok",
  "message": "Base de datos funcionando correctamente",
  "latency": "12ms"
}
```

---

### 4️⃣ `GET /api/health/puppeteer`

Verifica disponibilidad de **Chrome y Puppeteer** para web scraping.

```bash
curl http://localhost:3000/api/health/puppeteer
```

**Respuesta OK:**
```json
{
  "component": "puppeteer",
  "status": "ok",
  "message": "Puppeteer y Chrome disponibles para web scraping",
  "canLaunchBrowser": true
}
```

**Respuesta Down:**
```json
{
  "component": "puppeteer",
  "status": "down",
  "message": "Chrome no encontrado en: /usr/bin/google-chrome",
  "canLaunchBrowser": false
}
```

---

### 5️⃣ `GET /api/health/whatsapp`

Verifica configuración de **WhatsApp Cloud API**.

```bash
curl http://localhost:3000/api/health/whatsapp
```

**Respuesta OK:**
```json
{
  "component": "whatsapp",
  "status": "ok",
  "message": "Credenciales de WhatsApp configuradas correctamente",
  "version": "v21.0"
}
```

**Respuesta Degradada:**
```json
{
  "component": "whatsapp",
  "status": "degraded",
  "message": "Credenciales de WhatsApp no configuradas",
  "version": "v21.0"
}
```

---

### 6️⃣ `GET /api/health/resources`

Verifica **espacio en disco y uso de memoria**.

```bash
curl http://localhost:3000/api/health/resources
```

**Respuesta:**
```json
{
  "component": "resources",
  "status": "ok",
  "message": "✅ Espacio disponible: 50.25 GB",
  "disk": {
    "total": 238,
    "free": 50,
    "used": 188,
    "percentUsed": "78.99"
  },
  "memory": {
    "total": 16384,
    "free": 4096,
    "used": 12288,
    "percentUsed": "75.00"
  }
}
```

**Status Degradado:**
```json
{
  "component": "resources",
  "status": "degraded",
  "message": "⚠️ Espacio bajo: 95.00% usado",
  "disk": { ... },
  "memory": { ... }
}
```

---

## Funciones de Servicio

### `performHealthCheck()`

Realiza un health check completo de todos los componentes.

```javascript
const { performHealthCheck } = require('./services/healthService');

const health = await performHealthCheck();
// Retorna: {status, timestamp, uptime, checks, checkDuration}
```

---

### `checkDatabase()`

Verifica conexión a BD midiendo latencia.

```javascript
const { checkDatabase } = require('./services/healthService');

const dbCheck = await checkDatabase();
// Retorna: {status, message, latency}
```

---

### `checkWhatsAppAPI()`

Valida configuración de WhatsApp Cloud API.

```javascript
const { checkWhatsAppAPI } = require('./services/healthService');

const waCheck = await checkWhatsAppAPI();
// Retorna: {status, message, version}
```

---

### `checkPuppeteer()`

Verifica disponibilidad de Chrome para web scraping.

```javascript
const { checkPuppeteer } = require('./services/healthService');

const puppeteerCheck = await checkPuppeteer();
// Retorna: {status, message, canLaunchBrowser}
```

---

### `checkDiskAndMemory()`

Analiza espacio en disco y RAM disponible.

```javascript
const { checkDiskAndMemory } = require('./services/healthService');

const resourcesCheck = await checkDiskAndMemory();
// Retorna: {status, message, disk, memory}
```

---

## Uso en Monitoreo

### Prometheus Integration

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'bot-irrigacion'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/api/health'
    scrape_interval: 30s
```

### Kubernetes Liveness Probe

```yaml
# deployment.yaml
containers:
  - name: bot-irrigacion
    livenessProbe:
      httpGet:
        path: /api/health
        port: 3000
      initialDelaySeconds: 10
      periodSeconds: 30
      failureThreshold: 3
      
    readinessProbe:
      httpGet:
        path: /api/health
        port: 3000
      initialDelaySeconds: 5
      periodSeconds: 10
```

### Docker Health Check

```dockerfile
FROM node:18-alpine

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1
```

### Bash Monitoring Script

```bash
#!/bin/bash
# check_health.sh

RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health)

if [ $RESPONSE -eq 200 ]; then
  echo "✅ Bot saludable (HTTP 200)"
  exit 0
else
  echo "❌ Bot caído (HTTP $RESPONSE)"
  exit 1
fi
```

### Grafana Dashboard Query

```
# Latencia de BD (Prometheus)
rate(db_latency_ms[5m])

# Uptime
rate(process_uptime_seconds[5m])

# Status codes
rate(http_requests_total{endpoint="/api/health"}[5m])
```

---

## Alertas Recomendadas

### Email Alerts (usando nodemailer)

```javascript
const { performHealthCheck } = require('./services/healthService');

// Ejecutar cada 5 minutos
setInterval(async () => {
  const health = await performHealthCheck();
  
  if (health.status === 'down') {
    // Enviar email de alerta crítica
    await sendEmailAlert('admin@bot.com', 'BOT CAÍDO', health);
  }
  
  if (health.status === 'degraded') {
    // Enviar alerta de degradación
    await sendEmailAlert('admin@bot.com', 'BOT DEGRADADO', health);
  }
}, 5 * 60 * 1000);
```

### Slack Integration

```javascript
const axios = require('axios');

async function notifySlack(health) {
  const emoji = health.status === 'ok' ? '✅' : '⚠️';
  
  await axios.post(process.env.SLACK_WEBHOOK, {
    text: `${emoji} Health Check: ${health.status.toUpperCase()}`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Health Status:* ${health.status}\n` +
                `*Uptime:* ${health.uptime}s\n` +
                `*Database:* ${health.checks.database.status}\n` +
                `*Puppeteer:* ${health.checks.puppeteer.status}\n` +
                `*Memory Usage:* ${health.checks.resources.memoryUsage.percentUsed}%`
        }
      }
    ]
  });
}
```

---

## Status Codes y Significados

| Status | HTTP | Significado | Acción |
|--------|------|-------------|--------|
| `ok` | 200 | Todo bien ✅ | Continuar normal |
| `degraded` | 503 | Algún componente lento/limitado | Monitorear, no es crítico |
| `down` | 503 | Componente crítico caído ❌ | Alertar, escalar |

---

## Casos de Uso

### 1. **Load Balancer (Nginx)**
```nginx
upstream bot_app {
  server localhost:3000 weight=1 max_fails=3 fail_timeout=30s;
  server localhost:3001 weight=1 max_fails=3 fail_timeout=30s;
}

server {
  location / {
    proxy_pass http://bot_app;
    proxy_intercept_errors on;
  }
}
```

El load balancer verifica `/api/health` cada 30s - si falla 3 veces, retira la instancia.

### 2. **Debugging en Desarrollo**
```bash
# Ver health check detallado
curl -H "Authorization: Bearer $JWT" http://localhost:3000/api/health/detailed | jq

# Monitorear en tiempo real
watch -n 1 'curl -s http://localhost:3000/api/health | jq .checks'
```

### 3. **Migración a Producción**
```javascript
// Antes de desplegar, verificar que todos los checks sean 'ok'
const health = await performHealthCheck();
const allOk = Object.values(health.checks).every(c => c.status === 'ok');

if (!allOk) {
  throw new Error('Health check falló - no desplegar');
}
```

---

## Performance

- **Latencia típica:** 125ms para health check completo
- **CPU:** < 1% durante check
- **Rate limit:** 100 requests/15min (por IP)

---

## Roadmap

- [ ] Métricas de respuesta de WhatsApp API (tiempo real)
- [ ] Check de conectividad a AWS S3
- [ ] Monitoreo de tamaño de cola de jobs
- [ ] Estadísticas de mensajes procesados/hora
- [ ] Integración con DataDog/New Relic
