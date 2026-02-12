# 🔌 API Documentation - Bot de Irrigación

## 📍 Base URL

```
Production:  https://chat.irrigacionmalargue.net
Development: http://localhost:3000
```

---

## 🔑 Autenticación

### Header Required
```
Authorization: Bearer <JWT_TOKEN>
```

### Obtener JWT Token

**POST** `/api/auth/login`

```json
{
  "username": "admin",
  "password": "MiPassword123!"
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "admin",
    "email": "admin@example.com"
  }
}
```

---

## 📋 Endpoints

### 1️⃣ CHATS - Obtener Conversaciones

**GET** `/api/chats`

```
Headers: Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "chats": [
    {
      "telefono": "5491234567890",
      "nombre_whatsapp": "Juan García",
      "foto_perfil": "https://...",
      "estado_deuda": "Con deuda",
      "ultima_consulta": "2026-02-11T15:30:00Z",
      "activo": true
    }
  ]
}
```

---

### 2️⃣ MENSAJES - Obtener Historial

**GET** `/api/messages/{telefono}`

```
Headers: Authorization: Bearer <token>
Params:  telefono = "5491234567890"
```

**Response:**
```json
{
  "success": true,
  "mensajes": [
    {
      "id": 1,
      "telefono": "5491234567890",
      "tipo": "usuario",
      "contenido": "¿Cuál es mi deuda?",
      "respuesta": "Tu deuda actual es...",
      "created_at": "2026-02-11T15:30:00Z"
    },
    {
      "id": 2,
      "telefono": "5491234567890",
      "tipo": "bot",
      "contenido": "Tu deuda actual es $1,250",
      "created_at": "2026-02-11T15:31:00Z"
    }
  ]
}
```

---

### 3️⃣ MENSAJES - Enviar Mensaje

**POST** `/api/send`

```
Headers: 
  Authorization: Bearer <token>
  Content-Type: application/json

Body:
{
  "telefono": "5491234567890",
  "texto": "Hola, ¿cómo estás?",
  "url_archivo": null
}
```

**Response:**
```json
{
  "success": true,
  "message": "Mensaje enviado correctamente",
  "messageId": "wamid.xxxxx"
}
```

---

### 4️⃣ MENSAJES - Marcar como Leído

**POST** `/api/mark-read/{telefono}`

```
Headers: Authorization: Bearer <token>
Params:  telefono = "5491234567890"
```

**Response:**
```json
{
  "success": true,
  "message": "Conversación marcada como leída"
}
```

---

### 5️⃣ ESTADÍSTICAS - Panel

**GET** `/api/stats`

```
Headers: Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "stats": {
    "totalClientes": 450,
    "clientesActivos": 87,
    "mensajesHoy": 342,
    "deudaTotalPendiente": "$125,450",
    "promedioDeudasPorCliente": "$278.50"
  }
}
```

---

### 6️⃣ CLIENTES - Pausar Bot

**POST** `/api/chats/{phone}/pause`

```
Headers: Authorization: Bearer <token>
Params:  phone = "5491234567890"
```

**Response:**
```json
{
  "success": true,
  "message": "Bot pausado para este cliente"
}
```

---

### 7️⃣ CLIENTES - Activar Bot

**POST** `/api/chats/{phone}/activate`

```
Headers: Authorization: Bearer <token>
Params:  phone = "5491234567890"
```

**Response:**
```json
{
  "success": true,
  "message": "Bot activado para este cliente"
}
```

---

### 8️⃣ VENTANA 24H - Verificar Estado

**GET** `/api/chats/{phone}/window-status`

```
Headers: Authorization: Bearer <token>
Params:  phone = "5491234567890"
```

**Response:**
```json
{
  "success": true,
  "windowStatus": {
    "isOpen": true,
    "remainingTime": 3600,
    "expiresAt": "2026-02-12T15:30:00Z",
    "message": "Ventana abierta, puedes enviar mensajes"
  }
}
```

---

### 9️⃣ REACTIVAR - Reabrir Conversación (>24h)

**POST** `/api/chats/{phone}/reactivate`

```
Headers: 
  Authorization: Bearer <token>
  Content-Type: application/json

Params:  phone = "5491234567890"

Body:
{
  "template": "hello_world",
  "parameters": [
    {
      "type": "text",
      "text": "Hola de nuevo!"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Conversación reactivada con plantilla"
}
```

---

### 🔟 ARCHIVOS - Subir Archivo

**POST** `/api/upload`

```
Headers: 
  Authorization: Bearer <token>
  Content-Type: multipart/form-data

Body:
  file: <binary file>
```

**Response:**
```json
{
  "success": true,
  "fileUrl": "https://chat.irrigacionmalargue.net/uploads/abc123.pdf",
  "fileName": "documento.pdf",
  "fileSize": 2048000
}
```

---

### 1️⃣1️⃣ ARCHIVOS - Descargar Media

**GET** `/api/media/{mediaId}`

```
Headers: Authorization: Bearer <token>
Params:  mediaId = "abc123xyz"
```

**Response:** Binary file (imagen, PDF, etc)

---

### 1️⃣2️⃣ WEBHOOK - Verificación (GET)

**GET** `/webhook`

```
Query Params:
  hub.mode = "subscribe"
  hub.verify_token = "tu_webhook_verify_token"
  hub.challenge = "challenge_string"
```

**Response:**
```
challenge_string
```

---

### 1️⃣3️⃣ WEBHOOK - Recibir Mensajes (POST)

**POST** `/webhook`

```
Headers: 
  X-Hub-Signature-256: sha256=signature
  Content-Type: application/json

Body:
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "...",
      "changes": [
        {
          "value": {
            "messaging_product": "whatsapp",
            "metadata": {
              "phone_number_id": "...",
              "display_phone_number": "+54..."
            },
            "messages": [
              {
                "from": "5491234567890",
                "id": "wamid.xxxxx",
                "timestamp": "1707604800",
                "type": "text",
                "text": {
                  "body": "Hola, consulto sobre mi deuda"
                }
              }
            ]
          },
          "field": "messages"
        }
      ]
    }
  ]
}
```

---

### 1️⃣4️⃣ SALUD - Health Check

**GET** `/health`

```
No auth required
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-02-11T15:30:00Z",
  "database": "connected",
  "redis": "connected",
  "uptime": 86400
}
```

---

## 📊 Modelos de Datos

### Cliente
```json
{
  "telefono": "5491234567890",
  "nombre_whatsapp": "Juan García",
  "nombre_asignado": "Sr. García",
  "foto_perfil": "https://...",
  "padron": "ABC-123",
  "padron_superficial": "S-456",
  "padron_subterraneo": "SUB-789",
  "padron_contaminacion": "CONT-012",
  "estado_deuda": "Con deuda",
  "tipo_consulta_preferido": "deuda",
  "ultima_consulta": "2026-02-11T15:30:00Z",
  "activo": true,
  "created_at": "2025-01-01T00:00:00Z",
  "updated_at": "2026-02-11T15:30:00Z"
}
```

### Mensaje
```json
{
  "id": 1,
  "telefono": "5491234567890",
  "tipo": "usuario|bot",
  "contenido": "¿Cuál es mi deuda?",
  "respuesta": "Tu deuda es...",
  "metadata": {
    "mediaId": "...",
    "mediaType": "image|video|audio|document"
  },
  "created_at": "2026-02-11T15:30:00Z"
}
```

### Deuda
```json
{
  "id": 1,
  "telefono": "5491234567890",
  "dni_consultado": "12345678",
  "titular": "Juan García",
  "cuit": "20-12345678-9",
  "hectareas": "15.5",
  "capital": 1000.00,
  "interes": 150.00,
  "apremio": 50.00,
  "total": 1200.00,
  "pdf_path": "/temp/deuda_12345678.pdf",
  "created_at": "2026-02-11T15:30:00Z"
}
```

---

## ⚡ Rate Limiting

```
General:        100 requests per 15 minutes
Operador:       30 requests per 15 minutes
Webhook:        Unlimited (verificado por firma)
```

---

## 🔐 Errores

### 400 - Bad Request
```json
{
  "success": false,
  "error": "Validación fallida",
  "details": "El campo 'texto' es requerido"
}
```

### 401 - Unauthorized
```json
{
  "success": false,
  "error": "No autenticado",
  "message": "Token inválido o expirado"
}
```

### 403 - Forbidden
```json
{
  "success": false,
  "error": "Acceso denegado",
  "message": "No tienes permisos para esta acción"
}
```

### 404 - Not Found
```json
{
  "success": false,
  "error": "Recurso no encontrado",
  "message": "El cliente no existe"
}
```

### 429 - Too Many Requests
```json
{
  "success": false,
  "error": "Límite de requests excedido",
  "retryAfter": 60
}
```

### 500 - Server Error
```json
{
  "success": false,
  "error": "Error interno del servidor",
  "message": "Algo salió mal"
}
```

---

## 📚 OpenAPI/Swagger

La documentación completa de Swagger está disponible en:

```
http://localhost:3000/api-docs
https://chat.irrigacionmalargue.net/api-docs
```

---

## 🧪 Ejemplos con cURL

### Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "MiPassword123!"
  }'
```

### Obtener Chats
```bash
curl -X GET http://localhost:3000/api/chats \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

### Enviar Mensaje
```bash
curl -X POST http://localhost:3000/api/send \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "telefono": "5491234567890",
    "texto": "Hola, ¿cómo estás?"
  }'
```

### Health Check
```bash
curl -X GET http://localhost:3000/health
```

---

## 🔗 URLs de Referencia

- **API Base**: `https://chat.irrigacionmalargue.net/api`
- **Swagger Docs**: `https://chat.irrigacionmalargue.net/api-docs`
- **Health Check**: `https://chat.irrigacionmalargue.net/health`
- **Webhook**: `https://chat.irrigacionmalargue.net/webhook`

---

## 📱 Variables de Frontend

Configura estas variables en tu frontend (.env):

```env
VITE_API_URL=https://chat.irrigacionmalargue.net/api
VITE_WEBHOOK_URL=https://chat.irrigacionmalargue.net/webhook
VITE_BASE_URL=https://chat.irrigacionmalargue.net
```

---

## 🚀 Socket.io (Real-time)

Para actualizaciones en tiempo real del estado de conversaciones:

```javascript
import io from 'socket.io-client';

const socket = io('https://chat.irrigacionmalargue.net', {
  auth: {
    token: JWT_TOKEN
  }
});

// Escuchar nuevos mensajes
socket.on('new-message', (data) => {
  console.log('Nuevo mensaje:', data);
});

// Escuchar cambios de estado
socket.on('chat-status-changed', (data) => {
  console.log('Estado cambió:', data);
});

// Escuchar escritura
socket.on('user-typing', (data) => {
  console.log('Usuario escribiendo:', data);
});
```

---

## 📞 Soporte

Para documentación completa de la API, ver:
- [SWAGGER_DOCS.md](./SWAGGER_DOCS.md) - Documentación detallada
- [DOCKER.md](./DOCKER.md) - Despliegue
- [README.md](./README.md) - Información general
