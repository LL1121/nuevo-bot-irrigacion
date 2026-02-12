# Guía Rápida de Testing y Despliegue

## 🧪 Probar las Optimizaciones Localmente

### 1. Verificar que todo funciona:
```bash
npm start
```

El servidor debería iniciar sin errores y mostrar:
```
✅ Sistema de scraping listo
🚀 Servidor corriendo en puerto 3000
```

### 2. Test Manual (con WhatsApp):
- Envía "Hola" al bot
- Selecciona "Consultar Deuda"
- La primera consulta tomará ~3-5 segundos (inicialización del browser)
- Las siguientes consultas tomarán ~1-2 segundos (browser reutilizado)

### 3. Verificar el Pool de Browsers:
En la consola verás logs como:
```
🆕 Creando nuevo browser (1/3)
♻️ Reutilizando browser existente (2 disponibles)
💾 Browser guardado en pool (2 disponibles)
```

## 🚀 Desplegar en Producción

### Opción 1: Despliegue Simple (sin PM2)
```bash
# En el servidor
git pull
npm install
npm start
```

### Opción 2: Despliegue con PM2 (Recomendado)
```bash
# En el servidor
git pull
npm install

# Instalar PM2 (si no está instalado)
npm install -g pm2

# Iniciar bot
pm2 start ecosystem.config.js

# Configurar para auto-start al reiniciar servidor
pm2 startup
pm2 save

# Ver status
pm2 status
pm2 logs bot-irrigacion
```

### Verificar que está funcionando:
```bash
curl http://localhost:3000/health
# Debería responder: {"status":"ok","uptime":123}
```

## 📊 Monitorear Performance

### Ver Logs en Tiempo Real:
```bash
pm2 logs bot-irrigacion
```

### Ver Métricas:
```bash
pm2 monit
```

Deberías ver:
- CPU: < 70%
- Memory: < 500MB por instancia
- Status: online (ambas instancias)

### Ver Pool de Conexiones MySQL:
```sql
SHOW PROCESSLIST;
```

Deberías ver entre 2-10 conexiones activas normalmente.

## ⚡ Activar Redis (Opcional pero Recomendado)

Redis cachea las consultas repetidas haciendo el bot 10x más rápido:

```bash
# Opción 1: Con Docker
docker run -d -p 6379:6379 redis:latest

# Opción 2: Instalación directa
apt-get install redis-server
systemctl start redis
systemctl enable redis
```

Verificar:
```bash
redis-cli ping
# Debería responder: PONG
```

El bot detectará Redis automáticamente y lo usará.

## 🐛 Troubleshooting

### Bot lento después del despliegue:
```bash
# Reiniciar PM2
pm2 restart bot-irrigacion

# O reiniciar todo
pm2 delete bot-irrigacion
pm2 start ecosystem.config.js
```

### Error "Too many connections" en MySQL:
```bash
# Aumentar límite en MySQL
mysql -u root -p
SET GLOBAL max_connections = 100;
```

### Puppeteer no funciona en servidor:
```bash
# Instalar dependencias de Chrome
apt-get install -y \
  chromium-browser \
  libx11-xcb1 \
  libxcomposite1 \
  libxdamage1 \
  libxi6 \
  libxtst6 \
  libnss3 \
  libcups2 \
  libxss1 \
  libxrandr2 \
  libasound2 \
  libpangocairo-1.0-0 \
  libatk1.0-0 \
  libatk-bridge2.0-0 \
  libgtk-3-0
```

## 📈 Métricas Esperadas

Con las optimizaciones, deberías ver:

| Métrica | Valor Esperado |
|---------|----------------|
| Tiempo de respuesta (primera consulta) | 3-5 segundos |
| Tiempo de respuesta (siguientes) | 1-2 segundos |
| Usuarios simultáneos soportados | 50+ |
| Tasa de éxito | > 95% |
| CPU usage | < 70% |
| Memory usage | < 500MB |

## ✅ Checklist Pre-Producción

- [ ] Git pull con últimos cambios
- [ ] npm install para dependencias
- [ ] .env configurado correctamente
- [ ] PM2 instalado globalmente
- [ ] Logs directory existe
- [ ] public/temp directory existe
- [ ] MySQL con max_connections >= 100
- [ ] Redis instalado y corriendo (opcional)
- [ ] Webhook URL configurada en Meta
- [ ] PM2 iniciado y guardado
- [ ] Test manual realizado

## 🎯 Resultado Final

Si todo está bien configurado, el bot debería:
- ✅ Responder en 1-3 segundos
- ✅ Manejar 50+ usuarios sin problemas
- ✅ Mantenerse estable 24/7
- ✅ Recuperarse automáticamente de errores
