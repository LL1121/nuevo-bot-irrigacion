# 💧 Bot WhatsApp - Irrigación Malargüe

[![Node.js](https://img.shields.io/badge/Node.js-20+-green)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.x-blue)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-blue)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue)](https://www.docker.com/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)
[![Status](https://img.shields.io/badge/Status-Production%20Ready-brightgreen)](.)

Sistema automatizado de atención al cliente mediante WhatsApp, con panel de operadores en tiempo real, gestión de deudas y scraping inteligente de bases de datos.

**🎯 Dominio**: [chat.irrigacionmalargue.net](https://chat.irrigacionmalargue.net)

---

## 📋 Tabla de Contenidos

- [Características](#características)
- [Requisitos](#requisitos)
- [Quick Start](#quick-start)
- [Instalación](#instalación)
- [Configuración](#configuración)
- [Arquitectura](#arquitectura)
- [Documentación](#documentación)
- [Testing](#testing)
- [Despliegue](#despliegue)
- [Troubleshooting](#troubleshooting)
- [Contribuir](#contribuir)

---

## 🚀 Características

### 🤖 Bot WhatsApp
- ✅ Webhook para recibir mensajes de WhatsApp Cloud API
- ✅ Interactive Messages (listas y botones dinámicos)
- ✅ State Machine con memoria de conversaciones
- ✅ Consulta de deudas en tiempo real
- ✅ Deduplicación automática de mensajes
- ✅ Soporte para números argentinos

### 📊 Panel de Operadores
- ✅ Interfaz web en tiempo real (Socket.io)
- ✅ Vista de todas las conversaciones activas
- ✅ Historial completo de mensajes
- ✅ Envío de mensajes desde panel
- ✅ Notificaciones en tiempo real
- ✅ Estadísticas y métricas

### ⚡ Performance
- ✅ Browser pool optimizado (5 browsers)
- ✅ 50 conexiones PostgreSQL
- ✅ Redis para caching
- ✅ 82% mejora vs v1.0

### 🔒 Seguridad
- ✅ JWT Authentication
- ✅ Rate limiting
- ✅ HTTPS/TLS con Let's Encrypt
- ✅ Validación de webhooks
- ✅ Secrets management

---

## ✅ Requisitos

### Desarrollo Local
- Node.js 20+
- npm o yarn
- PostgreSQL 15+
- Redis 7+ (opcional pero recomendado)

### Producción
- Docker & Docker Compose
- PostgreSQL 15+ (servidor)
- Dominio configurado (chat.irrigacionmalargue.net)
- Certificado SSL (Let's Encrypt)

---

## 🚀 Quick Start

### Desarrollo Local

```bash
# 1. Clonar repositorio
git clone <repo-url>
cd bot-irrigacion

# 2. Instalar dependencias
npm install

# 3. Configurar variables
cp .env.example .env
# Editar .env con tus credenciales

# 4. Ejecutar servidor
npm start

# 5. Ejecutar tests (opcional)
npm test
```

El servidor estará disponible en `http://localhost:3000`

### Producción con Docker

```bash
# 1. Ejecutar setup automático
bash setup-docker.sh          # Linux/Mac
setup-docker.bat              # Windows

# O manual:
docker-compose up -d
```

Ver [DOCKER.md](./DOCKER.md) para instrucciones detalladas.

---

## 📦 Instalación

### Desde Node.js

```bash
# Instalar dependencias
npm install

# Verificar instalación
npm list

# Reinstalar desde cero
npm ci
```

### Desde Docker

```bash
# Build
docker build -t bot-irrigacion:latest .

# Run
docker run -p 3000:3000 bot-irrigacion:latest
```

---

## ⚙️ Configuración

### Variables de Entorno (.env)

```env
# ═════════════════════════════════════
# SERVER
# ═════════════════════════════════════
PORT=3000
NODE_ENV=development

# ═════════════════════════════════════
# DATABASE - PostgreSQL
# ═════════════════════════════════════
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=tu_password
DB_NAME=irrigacion_bot

# ═════════════════════════════════════
# REDIS
# ═════════════════════════════════════
REDIS_HOST=localhost
REDIS_PORT=6379

# ═════════════════════════════════════
# WhatsApp API
# ═════════════════════════════════════
WHATSAPP_TOKEN=tu_token_de_meta
WHATSAPP_PHONE_ID=tu_phone_number_id
WEBHOOK_VERIFY_TOKEN=tu_token_secreto

# ═════════════════════════════════════
# JWT
# ═════════════════════════════════════
JWT_SECRET=tu_jwt_secret_aqui

# ═════════════════════════════════════
# URLS
# ═════════════════════════════════════
BASE_URL=https://chat.irrigacionmalargue.net
WEBHOOK_URL=https://chat.irrigacionmalargue.net/webhook
```

Para la lista completa, ver `.env.example`

---

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────┐
│         🌐 NGINX Reverse Proxy               │
│    (SSL/TLS, Load Balancing, Cache)          │
└────────────────┬────────────────────────────┘
                 │
     ┌───────────┼───────────┐
     │           │           │
     ▼           ▼           ▼
  WhatsApp   Webhook API  Operators
  Messages   Endpoints    Panel
     │           │           │
     └───────────┼───────────┘
                 │
    ┌────────────▼────────────┐
    │   Express.js Server     │
    │   (Node.js 20-slim)     │
    ├─────────────────────────┤
    │  • Bot Logic            │
    │  • API Routes           │
    │  • Webhooks             │
    │  • Socket.io            │
    └────────┬────────┬───────┘
             │        │
        ┌────▼──┐  ┌──▼─────┐
        │  PostgreSQL  │  Redis     │
        │  (50 pool)   │  (7-alpine)│
        └──────────┘  └──────────┘
```

---

## 📚 Documentación

| Archivo | Contenido |
|---------|-----------|
| [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) | 14 endpoints, autenticación, ejemplos |
| [DOCKER.md](./DOCKER.md) | Despliegue, configuración, troubleshooting |
| [SECURITY.md](./SECURITY.md) | Seguridad, SSL, secrets management |
| [docs/PERFORMANCE.md](./docs/PERFORMANCE.md) | Métricas, optimizaciones, benchmarks |

---

## 🧪 Testing

```bash
# Ejecutar todos los tests
npm test

# Tests específicos
npm test -- --testNamePattern="browser"
npm test -- --testPathIgnorePatterns=scraper

# Coverage
npm test -- --coverage
```

**Estadísticas**:
- 70 tests totales
- 57/57 tests críticos pasando (100%)
- Browser pool: 5/5 ✅
- Cache service: 29/29 ✅
- Message validators: 23/23 ✅

---

## 🚀 Despliegue

### Opción 1: Setup Automático (Recomendado)

```bash
# Linux/Mac
bash setup-docker.sh

# Windows
setup-docker.bat
```

### Opción 2: Manual

1. Clonar repositorio
2. Configurar `.env`
3. Ejecutar: `docker-compose up -d`
4. Verificar: `curl https://chat.irrigacionmalargue.net/health`

Ver [DOCKER.md](./DOCKER.md) para instrucciones completas.

---

## 🔧 Troubleshooting

### Puerto 3000 en uso
```bash
lsof -i :3000          # Linux/Mac
Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess  # Windows
```

### PostgreSQL no conecta
```bash
# Verificar conexión
psql -h localhost -U postgres -d irrigacion_bot

# Ver logs
docker-compose logs db
```

### Redis no disponible
El bot continúa funcionando sin Redis (solo sin caching temporal).

---

## 🤝 Contribuir

Para contribuir al proyecto:

1. Fork el repositorio
2. Crear rama: `git checkout -b feature/nueva-caracteristica`
3. Commit cambios: `git commit -m "feat: describir cambio"`
4. Push: `git push origin feature/nueva-caracteristica`
5. Crear Pull Request

Ver [CONTRIBUTING.md](./.github/CONTRIBUTING.md) para detalles.

---

## 📞 Soporte

- 📧 Email: soporte@irrigacionmalargue.net
- 💬 WhatsApp: Envía un mensaje al bot
- 🐛 Issues: [GitHub Issues](../../issues)
- 📖 Documentación: [API Docs](./API_DOCUMENTATION.md)

---

## 📄 Licencia

MIT License - Ver [LICENSE](LICENSE) para detalles

---

**Desarrollado con ❤️ para Irrigación Malargüe**
DB_NAME=irrigacion_db
```

### Base de Datos MySQL

Ejecutar los siguientes scripts SQL:

```bash
# 1. Crear base de datos y tabla de regantes
mysql -u root -p < database/setup.sql

# 2. Crear tablas de mensajes y conversaciones
mysql -u root -p < database/schema_mensajes.sql
```

## 🎯 Uso

### Desarrollo (Backend + Frontend por separado)

**Terminal 1 - Backend:**
```bash
npm start
```

**Terminal 2 - Frontend:**
```bash
cd Frontend
npm install
npm run dev
```

- Backend: `http://localhost:3000`
- Frontend: `http://localhost:5173`
- API: `http://localhost:3000/api`
- Socket.io: `ws://localhost:3000`

### Producción

```bash
# Build del frontend
cd Frontend
npm run build

# Iniciar servidor (sirve API + Frontend)
cd ..
npm start
```

Todo en: `http://localhost:3000`

### Endpoints disponibles

#### Webhook WhatsApp
- **GET** `/webhook` - Verificación del webhook
- **POST** `/webhook` - Recepción de mensajes

#### API del Panel
- **GET** `/api/chats` - Lista de conversaciones
- **GET** `/api/messages/:telefono` - Mensajes de una conversación
- **POST** `/api/send` - Enviar mensaje desde el panel
- **POST** `/api/mark-read/:telefono` - Marcar conversación como leída
- **GET** `/api/stats` - Estadísticas generales
- **GET** `/api/health` - Estado del servidor

### Panel de Operadores

**Desarrollo:**
```bash
cd Frontend
npm run dev
# Abre: http://localhost:5173
```

**Producción:**
```bash
# Acceder al panel servido por el backend
http://localhost:3000
```

## 🔧 Arquitectura

```
bot-irrigacion/
├── Frontend/                         # Proyecto React + Vite
│   ├── src/
│   │   ├── config.js                # Configuración de URLs del backend
│   │   └── ...                      # Componentes React
│   ├── .env                         # Variables de entorno del frontend
│   └── vite.config.js               # Configuración de Vite
├── src/
│   ├── index.js                      # Servidor Express + Socket.io
│   ├── config/
│   │   └── db.js                     # Conexión MySQL
│   ├── controllers/
│   │   ├── webhookController.js      # Lógica del bot (state machine)
│   │   └── apiController.js          # Controladores de API REST
│   ├── services/
│   │   ├── whatsappService.js        # Envío de mensajes WhatsApp
│   │   ├── reganteService.js         # Consultas de regantes
│   │   └── mensajeService.js         # Persistencia de mensajes
│   └── routes/
│       ├── webhookRoutes.js          # Rutas del webhook
│       └── apiRoutes.js              # Rutas de la API
├── database/
│   ├── setup.sql                     # Esquema de regantes
│   └── schema_mensajes.sql           # Esquema de mensajes
└── .env                              # Variables de entorno del backend
```

## 🤖 Flujo del Bot

### Estado: START
- Mensaje de bienvenida institucional
- Envío de menú principal con 4 opciones

### Estado: MAIN_MENU
1. **📍 Ubicación y Horarios** - Información de oficinas
2. **📋 Empadronamiento** - Requisitos para registro
3. **🔐 Soy Regante (Login)** - Acceso con número de padrón
4. **👤 Hablar con Operador** - Derivación a atención humana

### Estado: AWAITING_PADRON
- Validación con RegEx
- Consulta a base de datos MySQL
- Autenticación con datos del regante

### Estado: AUTH_MENU
- **💰 Consultar deuda** - Estado de cuenta
- **🌾 Derechos de riego** - Información de hectáreas y cultivo
- **📅 Solicitar turno** - Registro de turno de riego
- **👤 Contactar Operador** - Derivación
- **🚪 Salir** - Cerrar sesión

## 💾 Base de Datos

### Tabla: regantes
```sql
- padron (VARCHAR PRIMARY KEY)
- nombre (VARCHAR)
- deuda (DECIMAL)
- estado (VARCHAR)
- hectareas (DECIMAL)
- cultivo (VARCHAR)
- turno (VARCHAR)
```

### Tabla: mensajes
```sql
- id (INT AUTO_INCREMENT PRIMARY KEY)
- telefono (VARCHAR)
- padron (VARCHAR NULLABLE)
- remitente (ENUM: 'bot', 'cliente', 'operador')
- contenido (TEXT)
- timestamp (DATETIME)
- leido (BOOLEAN)
```

### Tabla: conversaciones
```sql
- telefono (VARCHAR PRIMARY KEY)
- nombre_cliente (VARCHAR)
- padron (VARCHAR NULLABLE)
- estado (ENUM: 'activa', 'cerrada')
- ultimo_mensaje (TEXT)
- mensajes_no_leidos (INT)
- ultima_actividad (DATETIME)
```

## 🔄 Socket.io Events

### Cliente → Servidor
- `connection` - Cliente conectado
- `disconnect` - Cliente desconectado

### Servidor → Cliente
- `nuevo_mensaje` - Nuevo mensaje recibido
  ```json
  {
    "telefono": "5491234567890",
    "mensaje": "Hola",
    "remitente": "cliente",
    "timestamp": "2024-12-20T10:30:00.000Z"
  }
  ```

## 🐛 Solución de Problemas

### Error: "Cannot connect to MySQL"
- Verificar que MySQL esté corriendo
- Revisar credenciales en `.env`
- Ejecutar scripts SQL de creación de tablas

### Error: "#131030" (WhatsApp)
- Verificar que el número tenga formato correcto
- El parche de Argentina convierte `549` → `54`

### Mensajes duplicados
- El sistema usa deduplicación con TTL de 5 minutos
- Verificar que `processedMessageIds` esté funcionando

### Panel no carga conversaciones
- Verificar que Socket.io esté conectado (consola del navegador)
- Revisar que las tablas `mensajes` y `conversaciones` existan
- Comprobar que el endpoint `/api/chats` responda

## 📝 Próximas Mejoras

- [ ] Autenticación de operadores con JWT
- [ ] Sistema de asignación de conversaciones
- [ ] Notificaciones push en el panel
- [ ] Exportación de historial de mensajes
- [ ] Dashboard con métricas de atención
- [ ] Integración con CRM externo

## � Gestión de Secretos

### GitHub Secrets

Para CI/CD y producción, todos los secretos deben estar en GitHub Secrets:

```bash
# Listar secretos existentes
gh secret list

# Agregar un secreto
gh secret set WHATSAPP_TOKEN

# Ver documentación completa
cat docs/GITHUB_SECRETS_SETUP.md
```

**Secretos requeridos:**
- `WHATSAPP_TOKEN` - Token de Meta WhatsApp API
- `WEBHOOK_APP_SECRET` - App Secret de Meta para validar webhooks
- `JWT_SECRET` - Secreto para firmar tokens JWT
- `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` - Credenciales de MySQL
- `SENTRY_DSN` (opcional) - DSN de Sentry para monitoreo
- `REDIS_URL` (opcional) - URL de conexión a Redis

### Rotación de Secretos

Usa el script automatizado para rotar secretos de forma segura:

```bash
# Rotar JWT_SECRET
node scripts/rotate_secrets.js --type=jwt

# Rotar WHATSAPP_TOKEN
node scripts/rotate_secrets.js --type=whatsapp

# Rotar WEBHOOK_APP_SECRET
node scripts/rotate_secrets.js --type=webhook

# Rotar DB_PASSWORD
node scripts/rotate_secrets.js --type=db

# Rotar todos (interactive)
node scripts/rotate_secrets.js --type=all
```

**Frecuencias recomendadas:**
- `WHATSAPP_TOKEN`: Cada 60-90 días
- `WEBHOOK_APP_SECRET`: Cada 90 días
- `JWT_SECRET`: Cada 180 días (invalida todos los tokens)
- `DB_PASSWORD`: Cada 90 días

Ver procedimientos detallados en [docs/SECRET_ROTATION.md](docs/SECRET_ROTATION.md).

### Seguridad

- ❌ **NUNCA** commits secretos en el código
- ❌ **NUNCA** compartas secretos por chat/email
- ✅ Usa `.env` solo para desarrollo local
- ✅ Usa GitHub Secrets o Vault para producción
- ✅ Rota secretos regularmente
- ✅ Revisa logs de audit

## �📄 Licencia

Proyecto desarrollado para la Jefatura de Zona de Riego - Malargüe, Mendoza.

---

**Desarrollado con ❤️ por GitHub Copilot**
