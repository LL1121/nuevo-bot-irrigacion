# 🔧 Guía de Configuración - Bot de Irrigación

## 📋 Tabla de Contenidos

1. [Configuración Inicial](#configuración-inicial)
2. [Variables Obligatorias](#variables-obligatorias)
3. [Variables Opcionales](#variables-opcionales)
4. [Cómo Obtener Credenciales](#cómo-obtener-credenciales)
5. [Validación](#validación)
6. [Troubleshooting](#troubleshooting)

---

## 🚀 Configuración Inicial

### Paso 1: Copiar Template

```bash
cp .env.example .env
```

### Paso 2: Editar con tus Credenciales

```bash
# En Linux/Mac
nano .env
# O con VS Code
code .env

# En Windows
notepad .env
```

### Paso 3: Llenar Variables

Sigue la sección "Variables Obligatorias" para completar los datos requeridos.

---

## ⚡ Variables Obligatorias

Estas variables **DEBEN** ser configuradas para que la app funcione:

### 🗄️ PostgreSQL

```env
DB_HOST=localhost                    # Host del servidor
DB_PORT=5432                        # Puerto PostgreSQL
DB_USER=postgres                    # Usuario
DB_PASSWORD=tu_password_aqui        # Contraseña segura (16+ caracteres)
DB_NAME=irrigacion_bot              # Nombre BD
```

**¿Cómo configurar PostgreSQL?**

1. Verificar que PostgreSQL esté corriendo:
   ```bash
   # Linux
   sudo systemctl status postgresql
   
   # Windows (si está instalado)
   sc query PostgreSQL
   ```

2. Conectar y verificar:
   ```bash
   psql -U postgres -h localhost
   \l                              # Listar bases de datos
   \q                              # Salir
   ```

3. Si no existe la BD, crearla:
   ```bash
   createdb -U postgres irrigacion_bot
   ```

---

### 📱 WhatsApp Cloud API (Meta)

```env
WHATSAPP_TOKEN=tu_token_de_meta_aqui
WHATSAPP_PHONE_NUMBER_ID=1234567890123456
WHATSAPP_BUSINESS_ACCOUNT_ID=1234567890123456
WEBHOOK_VERIFY_TOKEN=tu_token_de_verificacion_aqui
WEBHOOK_APP_SECRET=tu_app_secret_aqui
```

**¿Cómo obtener credenciales de WhatsApp?**

1. **Crear App en Facebook Developer**:
   - Ir a: https://developers.facebook.com/
   - Login con cuenta Meta Business
   - Crear nueva app > "Business" type

2. **Obtener Token**:
   - En app settings > Settings > Basic
   - Copiar "App ID" y "App Secret"
   - Generar token de acceso en: Tools > Access Token Tool

3. **Configurar WhatsApp Business Account**:
   - Ir a: https://business.facebook.com/
   - WhatsApp > Getting Started
   - Obtener "Phone Number ID" y "Business Account ID"

4. **Configurar Webhook**:
   - Apps > tu_app > WhatsApp > Configuration
   - Webhook URL: `https://chat.irrigacionmalargue.net/webhook`
   - Webhook Token: Tu valor personalizado (generar uno aleatorio)
   - Verify Token: El mismo valor
   - Subscribe a: messages, message_status

---

### 🔐 JWT Secret

```env
JWT_SECRET=tu_jwt_secret_super_seguro_y_aleatorio_aqui
```

**Generar JWT Secret seguro**:

```bash
# En Linux/Mac
openssl rand -base64 32

# En Windows PowerShell
[System.Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))

# Resultado ejemplo: 
# X7k2pL9vQ4mN8wJ3hF6bA1cD5eG7rT2sU9mX4nY5oZ6pA
```

---

### 🔴 Redis (Recomendado)

```env
REDIS_HOST=redis          # En Docker: 'redis' | En local: 'localhost'
REDIS_PORT=6379          # Puerto default
REDIS_PASSWORD=          # Vacío si no tiene protección
```

**Verificar Redis**:

```bash
# Si está en Docker
docker ps | grep redis

# Si está local
redis-cli ping           # Debe responder "PONG"
```

---

## 📦 Variables Opcionales

Puedes dejarlas en blanco o configurarlas según necesidad:

### 🚨 Sentry (Error Tracking)

```env
SENTRY_DSN=https://xxxxx@sentry.io/xxxxx
SENTRY_ENVIRONMENT=production
```

**Obtener Sentry DSN**:
1. Crear cuenta en: https://sentry.io
2. Crear proyecto para Node.js
3. Copiar DSN de Settings > Client Keys

### ☁️ AWS S3 (Backups)

```env
AWS_REGION=us-east-1
AWS_S3_BUCKET=irrigacion-backups
AWS_ACCESS_KEY_ID=tu_access_key
AWS_SECRET_ACCESS_KEY=tu_secret_key
```

### 💾 Backups

```env
BACKUP_ENABLED=true
BACKUP_CRON_SCHEDULE=0 2 */3 * *      # Cron format
BACKUP_RETENTION_DAYS=7               # Mantener últimos 7 días
BACKUP_DESTINATION=local              # local, s3, or both
```

---

## ✅ Validación

Después de configurar, verificar que todo está bien:

### 1️⃣ Verificar Archivo .env

```bash
cat .env | grep -E "^[A-Z_]" | wc -l    # Debe mostrar cantidad de variables

# Ver variables importante
cat .env | grep "DB_\|WHATSAPP_\|JWT_\|REDIS_"
```

### 2️⃣ Iniciar Aplicación

```bash
# Desarrollo
npm start

# Producción con Docker
docker-compose up -d

# Ver logs
docker-compose logs -f app
```

### 3️⃣ Health Check

```bash
curl http://localhost:3000/health

# Respuesta esperada:
# {"status":"ok","database":"connected","redis":"connected"}
```

### 4️⃣ Test de Conexiones

```bash
# Probar PostgreSQL
npm run test:db

# Probar Redis
npm run test:redis

# Probar WhatsApp
npm run test:whatsapp
```

---

## 🐛 Troubleshooting

### Error: "Connect ECONNREFUSED 127.0.0.1:5432"

**Solución**: PostgreSQL no está corriendo

```bash
# Linux
sudo systemctl start postgresql

# Mac
brew services start postgresql

# Windows
# Abrir Services (services.msc) y buscar "PostgreSQL"
```

### Error: "Cannot connect to Redis"

**Solución**: Redis no está corriendo (opcional, pero recomendado)

```bash
# Si usas Docker Compose
docker-compose start redis

# Si es local
redis-server
```

### Error: "Invalid WhatsApp Token"

**Solución**: Token expirado o incorrecto

```bash
# Regenerar token en:
# https://developers.facebook.com/tools/access-token-tool
```

### Error: "JWT_SECRET is required"

**Solución**: JWT_SECRET está vacío en .env

```bash
# Generar uno nuevo
openssl rand -base64 32
# Copiar valor a JWT_SECRET en .env
```

### Error: "Webhook verification failed"

**Solución**: WEBHOOK_VERIFY_TOKEN no coincide con Meta

```bash
# Verificar que en .env tengas:
# WEBHOOK_VERIFY_TOKEN=el_mismo_valor_en_meta_settings
```

---

## 🔒 Seguridad

### ⚠️ Nunca:

- ❌ Commitear `.env` con credenciales reales
- ❌ Compartir `JWT_SECRET`, `WHATSAPP_TOKEN`, o credenciales BD
- ❌ Usar contraseña simple en PostgreSQL
- ❌ Exponer `WEBHOOK_APP_SECRET`

### ✅ Siempre:

- ✅ Usar `.env.example` como template
- ✅ Agregar `.env` a `.gitignore`
- ✅ Cambiar credenciales regularmente
- ✅ Usar variables de entorno en servidores
- ✅ Revisar logs para acceso no autorizado

---

## 📝 Ejemplo Completo de .env (DEV)

```env
# SERVIDOR
NODE_ENV=development
PORT=3000
BASE_URL=http://localhost:3000

# POSTGRESQL - LOCAL
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=MiPasswordSeguro123!
DB_NAME=irrigacion_bot

# WHATSAPP - SANDBOX
WHATSAPP_TOKEN=EAAxxxxxxxxxxxxxxxxxxxxxx
WHATSAPP_PHONE_NUMBER_ID=1234567890123
WHATSAPP_BUSINESS_ACCOUNT_ID=9876543210
WEBHOOK_VERIFY_TOKEN=mi_token_verificacion_secreto_123
WEBHOOK_APP_SECRET=app_secret_meta_aqui

# REDIS - LOCAL
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT
JWT_SECRET=LongSecureRandomStringGeneratedWith32Characters1234567890
JWT_EXPIRY=8h

# LOGGING
LOG_LEVEL=debug
LOG_TO_FILE=false

# OPCIONAL
SENTRY_DSN=
AWS_REGION=us-east-1
```

---

## 🚀 Siguientes Pasos

1. ✅ Completar `.env` con credenciales
2. ✅ Ejecutar: `npm start` (dev) o `docker-compose up -d` (prod)
3. ✅ Verificar: `curl http://localhost:3000/health`
4. ✅ Configurar webhook en Meta
5. ✅ Enviar mensaje de prueba

---

## 📞 Soporte

- 📖 Ver: [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)
- 🐳 Docker: [DOCKER.md](./DOCKER.md)
- 🔒 Seguridad: [SECURITY.md](./SECURITY.md)

---

**¡Listo! Tu bot está configurado y listo para empezar. 🚀**
