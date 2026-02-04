# 💧 Bot WhatsApp - Irrigación Malargüe

Sistema completo de atención al cliente con bot WhatsApp y panel de operadores en tiempo real.

## 🚀 Características

### Bot WhatsApp
- ✅ Webhook para recibir mensajes de WhatsApp Cloud API
- ✅ Interactive Messages (listas y botones)
- ✅ State Machine con memoria temporal de conversaciones
- ✅ Consulta de deudas de regantes (MySQL)
- ✅ Deduplicación de mensajes
- ✅ Parche para números argentinos (sandbox)

### Panel de Operadores
- ✅ Interfaz web en tiempo real con Socket.io
- ✅ Vista de todas las conversaciones activas
- ✅ Historial completo de mensajes
- ✅ Envío de mensajes desde el panel
- ✅ Notificaciones en tiempo real
- ✅ Estadísticas de conversaciones y mensajes no leídos

## 📦 Instalación

```bash
# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales
```

## ⚙️ Configuración

### Variables de entorno (.env)

```env
# Servidor
PORT=3000

# WhatsApp Cloud API
WEBHOOK_VERIFY_TOKEN=tu_token_secreto
WHATSAPP_TOKEN=tu_token_de_meta
WHATSAPP_PHONE_ID=tu_phone_number_id

# MySQL
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=tu_password
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
