# 🚀 IRRIGACIÓN BOT - INFRAESTRUCTURA DOCKER

## ✅ Estado: COMPLETADO

Todo está listo para desplegar en servidor Ubuntu con Docker.

---

## 📋 ARCHIVOS CREADOS

### Backend
- **`Backend/Dockerfile`** - Node.js 18-alpine con todas las dependencias

### Frontend  
- **`Frontend/Dockerfile`** - Multi-stage: Node build + Nginx serving
- **`Frontend/nginx.conf`** - Configuración Nginx completa (reverse proxy, WebSocket, webhooks)

### Orquestación Docker
- **`docker-compose.yml`** - 5 servicios: PostgreSQL, Backend, Redis, Nginx, Cloudflare Tunnel
- **`docker-compose.override.yml`** - Override para desarrollo local

### Base de Datos
- **`scripts/init-db.sql`** - Schema PostgreSQL, tablas, índices, funciones

### Deployment
- **`scripts/deploy.sh`** - Script automático para Ubuntu (instala Docker, configura, inicia)
- **`DEPLOYMENT.md`** - Documentación completa (450+ líneas)

### Configuración
- **`.env.production.example`** - Template con 50+ variables documentadas
- **`.gitignore`** - Actualizado: .env, datos, temporales, certificados, IDE

---

## 🏗️ Arquitectura

```
Internet (HTTPS)
    ↓ (chat.irrigacionmalargue.net)
Cloudflare Tunnel
    ↓
Nginx (puerto 80)
    ├→ Reverse Proxy → Backend (puerto 3000)
    ├→ WebSocket → Socket.io
    └→ Static Files → SPA React/Vue
    
Backend Node.js
    ├→ PostgreSQL (puerto 5432)
    └→ Redis (puerto 6379)
```

---

## 🔧 Servicios Docker

| Servicio | Imagen | Puerto | Función |
|----------|--------|--------|---------|
| **db** | postgres:15-alpine | 5432 | Base de datos |
| **backend** | node:18-alpine | 3000 | API Node.js |
| **redis** | redis:7-alpine | 6379 | Cache y sesiones |
| **nginx** | nginx:alpine | 80/443 | Reverse proxy + Frontend |
| **tunnel** | cloudflare/cloudflared | - | Túnel Cloudflare |

---

## 🚀 Deployment en Ubuntu

### Opción Rápida (Recomendada)
```bash
# En tu máquina local
scp -r . ubuntu@chat.irrigacionmalargue.net:/opt/irrigacion-bot

# En el servidor
ssh ubuntu@chat.irrigacionmalargue.net
cd /opt/irrigacion-bot
sudo bash scripts/deploy.sh

# El script solicitará:
# 1. Cloudflare Tunnel Token
# 2. PostgreSQL Password
# 3. Redis Password  
# 4. Meta Access Token
# 5. WhatsApp Phone ID
# 6. Meta App Secret
```

El script automáticamente:
- ✓ Instala Docker y Docker Compose
- ✓ Crea estructura de directorios
- ✓ Construye imágenes Docker
- ✓ Inicia servicios
- ✓ Verifica salud
- ✓ Muestra resumen

---

## ✅ Verificaciones

```bash
# Ver estado de servicios
docker compose ps

# Health check del backend
curl http://localhost:3000/health

# Ver logs
docker compose logs -f backend

# Conectar a PostgreSQL
docker exec -it irrigacion_db psql -U postgres -d irrigacion_db
```

---

## 🔐 Seguridad

✓ Usuarios no-root en todos los contenedores  
✓ Network Docker aislado (solo Nginx:80 expuesto)  
✓ Secrets en .env (protegidos en .gitignore)  
✓ Health checks en todos los servicios  
✓ Volúmenes persistentes con permisos correctos  
✓ No hay hardcoding de credenciales

---

## 📊 Base de Datos

**Schema**: `irrigacion`

**Tablas**:
- `users` - Usuarios de WhatsApp
- `conversations` - Conversaciones
- `messages` - Mensajes
- `webhooks` - Webhooks de Meta
- `tokens` - Tokens de acceso

**Índices** para optimización:
- `users(phone_number)`
- `conversations(user_id, status)`
- `messages(conversation_id, created_at)`

---

## 📞 Comandos Útiles

```bash
# Reiniciar un servicio
docker compose restart backend

# Ver logs en tiempo real
docker compose logs -f

# Detener sin eliminar datos
docker compose down

# Acceder a bash en backend
docker exec -it irrigacion_backend sh

# Ver uso de recursos
docker stats

# Respaldar base de datos
docker exec irrigacion_db pg_dump -U postgres irrigacion_db > backup.sql
```

---

## 📝 Variables de Entorno

**Críticas**:
- `DB_PASSWORD` - Contraseña PostgreSQL
- `REDIS_PASSWORD` - Contraseña Redis
- `META_ACCESS_TOKEN` - Token Meta (long-lived)
- `JWT_SECRET` - Secret para JWT
- `TUNNEL_TOKEN` - Token Cloudflare Tunnel

**Configurables**:
- `LOG_LEVEL` - Nivel de logging (debug, info, warn, error)
- `DB_POOL_MAX` - Máximo de conexiones DB (recomendado 20)

---

## 🎯 Próximos Pasos

1. ✅ Arquivos creados ← **COMPLETADO**
2. ⏳ Copiar a servidor Ubuntu
3. ⏳ Ejecutar `sudo bash scripts/deploy.sh`
4. ⏳ Ingresar credenciales
5. ⏳ Verificar en `https://chat.irrigacionmalargue.net`

---

**Última actualización**: 11/02/2026  
**Versión**: 1.0
**Estado**: ✅ Listo para producción
