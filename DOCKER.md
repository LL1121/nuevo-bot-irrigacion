# 🐳 Guía de Dockerización - Bot de Irrigación

## 📋 Tabla de Contenidos

1. [Requisitos](#requisitos)
2. [Configuración Inicial](#configuración-inicial)
3. [Comandos Docker](#comandos-docker)
4. [Migración de BD](#migración-de-bd)
5. [Deploy en Servidor](#deploy-en-servidor)
6. [Troubleshooting](#troubleshooting)

---

## ✅ Requisitos

### En tu máquina local
- Docker Desktop instalado
- Docker Compose v2.0+
- PostgreSQL 15+ (en el servidor)
- Node.js 20+ (solo si quieres ejecutar localmente)

### En tu servidor (chat.irrigacionmalargue.net)
- Docker instalado
- Docker Compose instalado
- PostgreSQL 15+ corriendo y accessible
- Certificado SSL (Let's Encrypt)
- Puertos 80, 443, 3000 disponibles

---

## 🔧 Configuración Inicial

### 1. Copiar archivo de configuración

```bash
cp .env.example .env
```

### 2. Editar `.env` con tus datos

```bash
# PostgreSQL (usar BD existente en el servidor)
DB_HOST=tu_servidor.com
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=tu_password
DB_NAME=irrigacion_bot

# WhatsApp API
WHATSAPP_TOKEN=tu_token
WHATSAPP_PHONE_NUMBER_ID=tu_phone_id
WHATSAPP_BUSINESS_ACCOUNT_ID=tu_account_id
WEBHOOK_VERIFY_TOKEN=tu_webhook_token

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# Sentry (opcional)
SENTRY_DSN=
```

### 3. Crear estructura de directorios

```bash
mkdir -p public/{images,docs,temp} logs
chmod -R 755 public logs
```

---

## 🚀 Comandos Docker

### Build de la imagen

```bash
# Build normal
docker build -t bot-irrigacion:latest .

# Build sin cache (reconstruir todo)
docker build --no-cache -t bot-irrigacion:latest .

# Build con BuildKit (más rápido)
DOCKER_BUILDKIT=1 docker build -t bot-irrigacion:latest .
```

### Ejecutar con Docker Compose

```bash
# Crear y ejecutar contenedores
docker-compose up -d

# Ver logs en tiempo real
docker-compose logs -f app

# Ver logs solo del app
docker-compose logs -f app

# Detener contenedores
docker-compose down

# Detener y eliminar volúmenes
docker-compose down -v

# Reiniciar contenedores
docker-compose restart

# Recrear contenedores
docker-compose up -d --force-recreate

# Ver estado de servicios
docker-compose ps

# Ejecutar comando en contenedor corriendo
docker-compose exec app npm test

# Ejecutar bash en contenedor
docker-compose exec app bash

# Ver recursos utilizados
docker stats
```

### Comandos Docker individuales

```bash
# Ver imágenes
docker images | grep bot

# Ver contenedores
docker ps -a

# Ver logs
docker logs bot-irrigacion-app -f --tail=100

# Entrar al contenedor
docker exec -it bot-irrigacion-app bash

# Detener contenedor
docker stop bot-irrigacion-app

# Eliminar contenedor
docker rm bot-irrigacion-app

# Limpiar recursos no utilizados
docker system prune -a
```

---

echo "SELECT COUNT(*) FROM clientes" | psql -h tu_servidor.com -U postgres -d irrigacion_bot
## 💾 PostgreSQL

### Crear tablas en una base existente

Si ya tienes una base PostgreSQL creada, solo configura las credenciales en `.env` y ejecuta:

```bash
npm run setup-db
```

### Verificar conexión

```bash
psql -h localhost -U bot_irrigacion_app -d bot_irrigacion_prod -c "SELECT 1;"
```

### Notas de despliegue

- La app usa `DB_CLIENT=pg`.
- El esquema se crea automáticamente con `npm run setup-db` o al iniciar la app.
- El modelo de tablas está documentado en [ESQUEMA_BD.md](ESQUEMA_BD.md).

---

## 📦 Deploy en Servidor

### 1. Conectar al servidor

```bash
ssh usuario@chat.irrigacionmalargue.net
```

### 2. Clonar repositorio

```bash
cd /opt/aplicaciones/
git clone https://github.com/tu_usuario/bot-irrigacion.git
cd bot-irrigacion
```

### 3. Crear archivo .env con datos del servidor

```bash
nano .env
```

**Contenido (ejemplo con datos reales)**:
```env
NODE_ENV=production
PORT=3000
BASE_URL=https://chat.irrigacionmalargue.net

DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=tu_password_seguro
DB_NAME=irrigacion_bot

WHATSAPP_TOKEN=tu_token_real
WHATSAPP_PHONE_NUMBER_ID=tu_phone_id_real
WHATSAPP_BUSINESS_ACCOUNT_ID=tu_account_id_real
WEBHOOK_VERIFY_TOKEN=tu_webhook_token_seguro

REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=tu_redis_password

SENTRY_DSN=https://xxx@sentry.io/xxx
```

### 4. Build y deploy

```bash
# Build de imagen en el servidor
docker build -t bot-irrigacion:prod .

# Ejecutar con Docker Compose
docker-compose -f docker-compose.yml up -d

# Verificar que esté corriendo
docker-compose ps

# Ver logs
docker-compose logs -f app
```

### 5. Verificar que funcione

```bash
# Desde el servidor
curl http://localhost:3000/health

# Desde tu máquina (necesita DNS resuelto)
curl https://chat.irrigacionmalargue.net/health
```

---

## 🌍 Configurar Reverse Proxy (Nginx)

### En el servidor, crear `/etc/nginx/sites-available/chat.irrigacionmalargue.net`

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name chat.irrigacionmalargue.net;

    # Redirigir a HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name chat.irrigacionmalargue.net;

    # SSL (usar Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/chat.irrigacionmalargue.net/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/chat.irrigacionmalargue.net/privkey.pem;

    # Configuración SSL mejorada
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Proxy hacia el contenedor Docker
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_redirect off;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # WebSocket para Socket.io
    location /socket.io {
        proxy_pass http://localhost:3000/socket.io;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

### Habilitar sitio y verificar

```bash
sudo ln -s /etc/nginx/sites-available/chat.irrigacionmalargue.net \
           /etc/nginx/sites-enabled/chat.irrigacionmalargue.net

sudo nginx -t
sudo systemctl restart nginx
```

### Configurar SSL con Let's Encrypt

```bash
# Instalar Certbot
sudo apt-get install certbot python3-certbot-nginx

# Obtener certificado
sudo certbot certonly --nginx -d chat.irrigacionmalargue.net

# Auto-renovación
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
```

---

## 📊 Monitoreo

### Ver logs en tiempo real

```bash
# Logs del app
docker-compose logs -f app

# Logs solo de errores
docker-compose logs app | grep "ERROR\|❌"

# Logs de Redis
docker-compose logs -f redis

# Ver N últimas líneas
docker-compose logs app --tail=50
```

### Salud del contenedor

```bash
# Ver estado de health check
docker-compose ps

# Manual health check
curl http://localhost:3000/health | jq

# Estadísticas de recursos
docker stats bot-irrigacion-app
```

### Verificar BD PostgreSQL

```bash
# Conectar a PostgreSQL desde el contenedor
docker-compose exec app psql -h tu_servidor.com -U postgres -d irrigacion_bot

# Comandos útiles en psql:
# \dt - Ver todas las tablas
# \d clientes - Ver estructura de tabla clientes
# SELECT COUNT(*) FROM clientes; - Contar registros
# \q - Salir
```

---

## 🔄 Actualizaciones

### Actualizar código

```bash
# 1. Pull de cambios
git pull origin main

# 2. Reconstruir imagen
docker-compose build

# 3. Reiniciar contenedores
docker-compose up -d

# 4. Ver que está corriendo
docker-compose ps
```

### Actualizar dependencias

```bash
# 1. Actualizar package.json
npm update

# 2. Reconstruir imagen
docker build -t bot-irrigacion:latest .

# 3. Redeploy
docker-compose up -d --force-recreate
```

---

## 🐛 Troubleshooting

### Error: "Cannot connect to PostgreSQL"

```bash
# Verificar conectividad desde contenedor
docker-compose exec app psql -h tu_servidor.com -U postgres -c "SELECT NOW()"

# Comprobar credenciales en .env
cat .env | grep DB_

# Verificar que PostgreSQL está corriendo en servidor
ssh usuario@tu_servidor.com "sudo systemctl status postgresql"
```

### Error: "Port 3000 already in use"

```bash
# Cambiar puerto en docker-compose.yml
# ports:
#   - "3001:3000"

# O matar proceso en puerto 3000
sudo lsof -i :3000
sudo kill -9 PID
```

### Error: "Redis connection refused"

```bash
# Reiniciar Redis
docker-compose restart redis

# Verificar que Redis está corriendo
docker-compose logs redis

# Verificar conectividad
docker-compose exec app redis-cli -h redis ping
```

### Error: "Puppeteer fails to launch"

```bash
# El Dockerfile ya incluye todas las dependencias
# Si aún falla, reconstruir sin cache
docker-compose build --no-cache app

# O revisar logs del contenedor
docker-compose logs app | grep -i "puppet\|chrome"
```

### Contenedor se reinicia constantemente

```bash
# Ver logs para encontrar el error
docker-compose logs app

# Conectar al contenedor
docker-compose exec app bash

# Verificar que la app inicia correctamente
node src/index.js
```

### Performance lento

```bash
# Ver recursos utilizados
docker stats

# Ver procesos del contenedor
docker-compose top app

# Aumentar memory limits en docker-compose.yml:
# deploy:
#   resources:
#     limits:
#       memory: 2G
```

---

## ✅ Checklist de Deployment

- [ ] Configurar `.env` con credenciales correctas
- [ ] Crear estructura de directorios (`public/`, `logs/`)
- [ ] Testear build localmente: `docker-compose up -d`
- [ ] Verificar health check: `curl http://localhost:3000/health`
- [ ] Migrar datos si es necesario: `node migrate-db.js`
- [ ] Subir código al servidor
- [ ] Crear `.env` en servidor con datos de producción
- [ ] Build en servidor: `docker build -t bot-irrigacion:prod .`
- [ ] Ejecutar: `docker-compose up -d`
- [ ] Verificar logs: `docker-compose logs -f app`
- [ ] Configurar Nginx reverse proxy
- [ ] Certificado SSL con Let's Encrypt
- [ ] Probar acceso a https://chat.irrigacionmalargue.net
- [ ] Configurar backup automático de BD
- [ ] Monitoreo y alertas

---

## 📞 Soporte

Para problemas:

1. Revisar logs: `docker-compose logs app`
2. Verificar `.env`: `cat .env`
3. Probar conectividad BD: `psql -h tu_servidor -U postgres -d irrigacion_bot`
4. Revisar Docker stats: `docker stats`

¡Listo! 🚀 El bot está dockerizado y lista para producción.
