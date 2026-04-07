# 🚀 DEPLOYMENT IRRIGACIÓN BOT EN UBUNTU SERVER

## 📋 Tabla de Contenidos
1. [Arquitectura](#arquitectura)
2. [Requisitos](#requisitos)
3. [Deployment Automático](#deployment-automático)
4. [Configuración Manual](#configuración-manual)
5. [Verificaciones](#verificaciones)
6. [Comandos Útiles](#comandos-útiles)
7. [Troubleshooting](#troubleshooting)

---

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│                    DOMINIO PÚBLICO (HTTPS)                       │
│            api-bot.irrigacionmalargue.net:443                    │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
        ┌────────────────────────────────┐
        │  Docker Compose (Ubuntu)       │
        │  /opt/irrigacion-bot           │
        └────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┬──────────────┐
        │                │                │              │
        ▼                ▼                ▼              ▼
    ┌──────────┐    ┌──────────┐    ┌────────┐
    │ Backend  │    │ Postgres │    │ Redis  │
    │ :3000    │    │ :5432    │    │ :6379  │
    │ Node.js  │    │ DB       │    │ Cache  │
    └──────────┘    └──────────┘    └────────┘
        │                │              │
        └────────────────┴──────────────┘
         Comunicación interna (Docker Network)
```

### 📦 Servicios Docker

| Servicio | Imagen | Puerto | Volumen | Función |
|----------|--------|--------|---------|---------|
| **db** | postgres:15-alpine | 5432 | postgres_data | Base de datos |
| **backend** | custom (node:18) | 3000 | uploads, tokens, logs | API Node.js |
| **redis** | redis:7-alpine | 6379 | redis_data | Cache y sesiones |

---

## ✅ Requisitos

### Hardware Mínimo
- **CPU**: 2 cores
- **RAM**: 2 GB (4 GB recomendado)
- **Disco**: 20 GB (SSD recomendado)

### Software
- **OS**: Ubuntu 20.04 LTS o superior / Debian 11+
- **Docker**: 20.10+
- **Docker Compose**: 1.29+
- **Git**: Para clonar repositorio (opcional)

### Conectividad
- ✓ Acceso a internet
- ✓ DNS del dominio `api-bot.irrigacionmalargue.net` apuntando al servidor

### Credenciales Necesarias
- Meta Long-Lived Access Token
- WhatsApp Phone Number ID
- Meta App Secret
- Webhook Verify Token
- Cloudflare Tunnel Token

---

## 🚀 Deployment Automático

### Paso 1: Conectarse al Servidor
```bash
ssh ubuntu@api-bot.irrigacionmalargue.net
# o tu usuario y dirección IP
```

### Paso 2: Descargar Script
```bash
cd /tmp
curl -O https://raw.githubusercontent.com/tu-repo/bot-irrigacion/main/scripts/deploy.sh
chmod +x deploy.sh
```

### Paso 3: Ejecutar Deployment
```bash
sudo bash deploy.sh
```

El script solicitará:
- ✅ Contraseña PostgreSQL
- ✅ Contraseña Redis
- ✅ META_ACCESS_TOKEN
- ✅ WHATSAPP_PHONE_NUMBER_ID
- ✅ META_APP_SECRET

### Paso 4: Verificar
```bash
# Checklist automático al final del script
# O verificar manualmente:
docker compose ps
curl http://localhost:3000/health
```

---

## 🔧 Configuración Manual

Si prefieres configurar manualmente:

### 1. Instalar Docker
```bash
# Actualizar paquetes
sudo apt update && sudo apt upgrade -y

# Instalar Docker
sudo apt install -y docker.io docker-compose

# Agregar usuario actual a grupo docker
sudo usermod -aG docker $USER
newgrp docker
```

### 2. Clonar Repositorio
```bash
mkdir -p /opt && cd /opt
sudo git clone <repo-url> irrigacion-bot
cd irrigacion-bot
```

### 3. Crear Archivo .env
```bash
cp .env.production.example .env
nano .env
```

**Editar en .env**:
```env
DB_CLIENT=pg
DB_HOST=db_central
DB_PORT=5432
DB_USER=user_bot_irrigacion
DB_PASSWORD=l3NDuJOTLs8YFy
DB_NAME=bot_irrigacion
REDIS_PASSWORD=tu_password_redis
META_ACCESS_TOKEN=EAAB...
WHATSAPP_PHONE_NUMBER_ID=123456789
META_APP_SECRET=abc123...
WEBHOOK_VERIFY_TOKEN=webhook_secret...
JWT_SECRET=$(openssl rand -base64 32)
BASE_URL=https://api-bot.irrigacionmalargue.net
```

### 4. Construir Imágenes
```bash
docker compose build --no-cache
```

### 5. Iniciar Servicios
```bash
docker compose up -d
```

### 6. Verificar Inicialización
```bash
# Esperar 30 segundos
sleep 30

# Ver logs
docker compose logs -f
```

---

## ✔️ Verificaciones

### Health Check
```bash
# Backend
curl http://localhost:3000/health

# Respuesta esperada:
# {"status":"ok","timestamp":"2026-02-11T...","uptime":123.45}
```

### Estado de Servicios
```bash
# Ver todos los servicios
docker compose ps

# Resultado esperado:
# NAME              STATUS      PORTS
# irrigacion_db      Up 2m       5432/tcp
# irrigacion_backend Up 2m       3000/tcp
# irrigacion_redis   Up 2m       6379/tcp
# (solo backend, db y redis)
```

### Conectividad de Base de Datos
```bash
# Conectar a PostgreSQL
docker exec -it irrigacion_db psql -U postgres -d irrigacion_db

# En psql:
# \dt           - Listar tablas
# \l            - Listar bases de datos
# SELECT * FROM irrigacion.users LIMIT 1;
# \q            - Salir
```

### Redis
```bash
# Verificar Redis
docker exec irrigacion_redis redis-cli ping

# Respuesta esperada: PONG
```

### Acceso HTTP
```bash
# Desde local o remoto:
curl https://api-bot.irrigacionmalargue.net/health

# O acceder en navegador:
# https://api-bot.irrigacionmalargue.net
```

---

## 🛠️ Comandos Útiles

### Ver Logs
```bash
# Todos los servicios
docker compose logs -f

# Solo backend
docker compose logs -f backend

# Solo últimas 50 líneas
docker compose logs --tail=50

# Backend con timestamps
docker compose logs -f backend --timestamps
```

### Reiniciar Servicios
```bash
# Reiniciar todo
docker compose restart

# Reiniciar solo backend
docker compose restart backend

# Reiniciar después de cambio en .env
docker compose restart -t 30 backend
```

### Detener/Iniciar
```bash
# Detener servicios (sin eliminar datos)
docker compose down

# Iniciar nuevamente
docker compose up -d

# Detener eliminando datos (¡CUIDADO!)
docker compose down -v
```

### Acceder a Contenedores
```bash
# Shell en Backend
docker exec -it irrigacion_backend sh

# Shell en PostgreSQL
docker exec -it irrigacion_db bash

# Ejecutar comando
docker exec irrigacion_backend npm --version
```

### Limpiar y Reiniciar
```bash
# Eliminar contenedores (mantiene volúmenes)
docker compose down

# Reconstruir imágenes
docker compose build --no-cache

# Iniciar nuevamente
docker compose up -d
```

### Respaldar Base de Datos
```bash
# Crear backup
docker exec irrigacion_db pg_dump -U postgres irrigacion_db > backup_$(date +%Y%m%d).sql

# Restaurar backup
docker exec -i irrigacion_db psql -U postgres irrigacion_db < backup_20260211.sql
```

---

## 🔍 Troubleshooting

### Backend no inicia
```bash
# Ver logs completos
docker compose logs backend

# Verificar variables de entorno
docker exec irrigacion_backend env | grep DB_

# Reiniciar con output detallado
docker compose restart backend && docker compose logs -f backend
```

### PostgreSQL no se conecta
```bash
# Verificar que PostgreSQL está listo
docker compose logs db | grep "database system is ready"

# Probar conexión
docker exec irrigacion_db psql -U postgres -c "SELECT version();"

# Verificar volumen
docker volume inspect irrigacion-bot_postgres_data
```

### Redis no accesible
```bash
# Verificar Redis
docker exec irrigacion_redis redis-cli info

# Verificar conexión desde backend
docker exec irrigacion_backend redis-cli -h redis ping
```

### Cloudflare Tunnel desconectado
```bash
# Ver estado del túnel
docker compose logs tunnel | tail -20

# Verificar token
docker compose restart tunnel

# Token inválido? Regenerar en dashboard.cloudflare.com
```

### Nginx devuelve 502 Bad Gateway
```bash
# Verificar que backend está corriendo
docker compose ps backend

# Ver logs nginx
docker compose logs nginx

# Verificar red Docker
docker network ls
docker network inspect irrigacion-bot_irrigacion_network
```

### Puerto ya en uso
```bash
# Encuentar qué usa puerto 80
sudo lsof -i :80

# Cambiar puerto en docker-compose.yml
# ports:
#   - "8080:80"

# Luego: docker compose up -d
```

### Permisos denegados
```bash
# Agregar usuario a grupo docker
sudo usermod -aG docker $USER

# O usar sudo siempre
sudo docker compose ps
```

---

## 📊 Monitoreo

### Ver Estadísticas
```bash
# CPU, memoria, red
docker stats

# Solo backend
docker stats irrigacion_backend
```

### Logs de Acceso Nginx
```bash
# Ver accesos en tiempo real
docker exec irrigacion_frontend tail -f /var/log/nginx/access.log
```

### Alertas Automáticas
```bash
# Ver estado cada 5 minutos
watch -n 5 'docker compose ps'
```

---

## 🔐 Seguridad

### Cambiar Contraseñas
```bash
# Editar .env
nano .env

# Cambiar:
DB_PASSWORD=nueva_password
REDIS_PASSWORD=nueva_password
JWT_SECRET=$(openssl rand -base64 32)

# Reiniciar servicios
docker compose down
docker compose up -d
```

### Verificar Permisos
```bash
# Archivo .env debe ser legible solo por propietario
ls -la .env
# Resultado: -rw------- (600)

# Corregir si es necesario
chmod 600 .env
```

### Firewall
```bash
# Limitar acceso a puertos internos (si es necesario)
# Nota: Cloudflare Tunnel ya oculta el servidor

sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP (Nginx)
# PostgreSQL y Redis NO deben estar expuestos (Docker internal)
```

---

## 📞 Soporte

Para problemas:
1. Revisar logs: `docker compose logs -f`
2. Verificar archivo .env
3. Confirmar conectividad de red
4. Reintentar: `docker compose restart`

---

**Última actualización**: 11/02/2026
**Versión**: 1.0
