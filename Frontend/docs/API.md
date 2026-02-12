# 📡 Documentación de API - Frontend

Especificación de cómo el frontend se comunica con el backend del Bot de Irrigación Malargüe.

---

## 🌐 Base URL

```
Production:  https://chat.irrigacionmalargue.net
Development: http://localhost:3000
```

**Configurado en**: `.env.production` / `.env.local`

```env
VITE_API_URL=https://chat.irrigacionmalargue.net
VITE_SOCKET_URL=https://chat.irrigacionmalargue.net
```

---

## 🔑 Autenticación

Todos los endpoints (excepto `/health` y `/api/auth/login`) requieren JWT Bearer token.

### Header de Autenticación

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Login

**Endpoint**: `POST /api/auth/login`

**Request**:
```json
{
  "username": "admin",
  "password": "MiPassword123!"
}
```

**Response**:
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

**Implementación Frontend**:
```typescript
// src/components/Login.tsx
const response = await axios.post('/api/auth/login', {
  username, 
  password
});

localStorage.setItem('token', response.data.token);
```

---

## 📋 Endpoints Usados por el Frontend

### 1. Obtener Conversaciones

**Endpoint**: `GET /api/chats`

**Headers**: 
```http
Authorization: Bearer <token>
```

**Response**:
```json
{
  "success": true,
  "chats": [
    {
      "telefono": "5491234567890",
      "nombre_whatsapp": "Juan García",
      "foto_perfil": "https://...",
      "ultimo_mensaje": "¿Cuál es mi deuda?",
      "ultimo_mensaje_fecha": "2026-02-11T15:30:00Z",
      "mensajes_no_leidos": 3,
      "estado_deuda": "Con deuda",
      "activo": true
    }
  ]
}
```

**Frontend Mapping**:
```typescript
// src/App.tsx - loadChats()
const chats = response.data.chats || response.data.data || [];
const mappedChats = chats.map(chat => ({
  id: chat.id,
  name: chat.nombre_whatsapp || chat.telefono,
  phone: chat.telefono,
  lastMessage: chat.ultimo_mensaje,
  lastMessageDate: chat.ultimo_mensaje_fecha,
  unread: chat.mensajes_no_leidos || 0,
  // ...
}));
```

---

### 2. Obtener Mensajes de un Chat

**Endpoint**: `GET /api/messages/{telefono}`

**Params**:
- `telefono`: Número de teléfono (ej: `5491234567890`)
- `limit`: Cantidad de mensajes (opcional, default: 100)
- `offset`: Offset para paginación (opcional, default: 0)

**Headers**: 
```http
Authorization: Bearer <token>
```

**Response**:
```json
{
  "success": true,
  "mensajes": [
    {
      "id": 1,
      "telefono": "5491234567890",
      "tipo": "usuario",
      "contenido": "¿Cuál es mi deuda?",
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

**Frontend Mapping**:
```typescript
// src/App.tsx - loadMessages()
const allMessages = response.data.mensajes || response.data.messages || [];
const mappedMessages = allMessages.map(msg => ({
  id: msg.id,
  text: msg.contenido || msg.cuerpo || '',
  date: msg.created_at || msg.fecha,
  sent: msg.tipo === 'bot' || msg.tipo !== 'usuario',
  read: true,
  type: msg.tipo || 'text',
  // ...
}));
```

---

### 3. Enviar Mensaje

**Endpoint**: `POST /api/send`

**Headers**: 
```http
Authorization: Bearer <token>
Content-Type: application/json
```

**Request**:
```json
{
  "telefono": "5491234567890",
  "texto": "Hola, ¿cómo estás?",
  "url_archivo": null
}
```

**Response**:
```json
{
  "success": true,
  "message": "Mensaje enviado correctamente",
  "messageId": "wamid.xxxxx"
}
```

**Implementación Frontend**:
```typescript
// src/App.tsx - sendMessage()
await axios.post('/api/send', {
  telefono: currentChat.phone,
  mensaje: messageText,
  operador: 'Panel Frontend'
}, {
  headers: { Authorization: `Bearer ${token}` }
});
```

---

### 4. Pausar Bot

**Endpoint**: `POST /api/chats/{phone}/pause`

**Headers**: 
```http
Authorization: Bearer <token>
```

**Response**:
```json
{
  "success": true,
  "message": "Bot pausado para este cliente"
}
```

**Implementación Frontend**:
```typescript
// src/App.tsx - pauseBot()
await axios.post(`/api/chats/${phone}/pause`, {}, {
  headers: { Authorization: `Bearer ${token}` }
});
```

---

### 5. Activar Bot

**Endpoint**: `POST /api/chats/{phone}/activate`

**Headers**: 
```http
Authorization: Bearer <token>
```

**Response**:
```json
{
  "success": true,
  "message": "Bot activado para este cliente"
}
```

**Implementación Frontend**:
```typescript
// src/App.tsx - activateBot()
await axios.post(`/api/chats/${phone}/activate`, {}, {
  headers: { Authorization: `Bearer ${token}` }
});
```

---

### 6. Reactivar Conversación (>24h)

**Endpoint**: `POST /api/chats/{phone}/reactivate`

**Headers**: 
```http
Authorization: Bearer <token>
Content-Type: application/json
```

**Request**:
```json
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

**Response**:
```json
{
  "success": true,
  "message": "Conversación reactivada con plantilla"
}
```

**Implementación Frontend**:
```typescript
// src/App.tsx - sendReactivationTemplate()
await axios.post(`/api/chats/${phone}/reactivate`, {
  template: 'hello_world',
  parameters: [{ type: 'text', text: 'Hola!' }]
});
```

---

## 🔌 WebSocket (Socket.io)

El frontend usa Socket.io para comunicación en tiempo real.

### Conexión

```typescript
// src/App.tsx
import { io, Socket } from 'socket.io-client';

const socket: Socket = io(env.socketUrl, {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionDelay: env.socketReconnectDelayMs,
  reconnectionAttempts: env.socketReconnectAttempts
});
```

### Eventos que Escucha el Frontend

#### 1. `nuevo_mensaje`

Recibe nuevo mensaje en tiempo real.

**Payload**:
```json
{
  "id": 123,
  "telefono": "5491234567890",
  "tipo": "usuario",
  "mensaje": "Hola",
  "timestamp": "2026-02-11T15:30:00Z",
  "emisor": "usuario"
}
```

**Handler**:
```typescript
socket.on('nuevo_mensaje', (data) => {
  // Normalizar contenido
  const messageText = normalizeMessageContent(data.mensaje).text;
  
  // Agregar a conversación
  setConversationsState(prev => {
    // ... actualizar chat con nuevo mensaje
  });
});
```

#### 2. `bot_mode_changed`

Notifica cambio en estado del bot.

**Payload**:
```json
{
  "telefono": "5491234567890",
  "bot_activo": false
}
```

**Handler**:
```typescript
socket.on('bot_mode_changed', (data) => {
  setConversationsState(prev => {
    const chatIndex = prev.findIndex(c => c.phone === data.telefono);
    if (chatIndex !== -1) {
      prev[chatIndex].botActive = data.bot_activo;
    }
    return [...prev];
  });
});
```

#### 3. `typing`

Indica que usuario está escribiendo.

**Payload**:
```json
{
  "telefono": "5491234567890",
  "typing": true
}
```

**Handler**:
```typescript
socket.on('typing', (data) => {
  setTypingUsers(prev => ({
    ...prev,
    [data.telefono]: data.typing
  }));
});
```

---

## 🔄 Interceptores Axios

El frontend usa interceptores para manejar autenticación y errores automáticamente.

### Request Interceptor

```typescript
// src/utils/axiosInterceptor.ts
axios.interceptors.request.use(config => {
  const token = localStorage.getItem(env.tokenKey);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

### Response Interceptor

```typescript
axios.interceptors.response.use(
  response => response,
  async error => {
    // Si token expiró (401), refrescar y reintentar
    if (error.response?.status === 401) {
      try {
        const newToken = await refreshToken();
        localStorage.setItem('token', newToken);
        error.config.headers.Authorization = `Bearer ${newToken}`;
        return axios.request(error.config);
      } catch {
        // Logout si refresh falla
        handleLogout();
      }
    }
    return Promise.reject(error);
  }
);
```

---

## 🔒 Manejo de Errores

### Errores Comunes

#### 401 Unauthorized

**Causa**: Token inválido o expirado

**Acción Frontend**:
```typescript
if (error.response?.status === 401) {
  handleLogout(); // Redirigir a login
  toast.error('Sesión expirada, por favor inicia sesión nuevamente');
}
```

#### 403 Forbidden

**Causa**: Usuario sin permisos

**Acción Frontend**:
```typescript
if (error.response?.status === 403) {
  toast.error('No tienes permisos para esta acción');
}
```

#### 429 Too Many Requests

**Causa**: Límite de requests excedido

**Acción Frontend**:
```typescript
if (error.response?.status === 429) {
  const retryAfter = error.response.data.retryAfter || 60;
  toast.error(`Demasiadas peticiones. Intenta en ${retryAfter}s`);
}
```

#### 500 Server Error

**Causa**: Error interno del servidor

**Acción Frontend**:
```typescript
if (error.response?.status === 500) {
  console.error('Error del servidor:', error);
  toast.error('Error del servidor. Intenta nuevamente');
}
```

---

## 📊 Tipos TypeScript

```typescript
// src/types.ts

interface Chat {
  id: string;
  phone: string;
  name: string;
  lastMessage: string;
  lastMessageDate: string;
  unread: number;
  botActive?: boolean;
  avatar: string;
  profilePic?: string;
}

interface Message {
  id: string | number;
  text: string;
  time: string;
  date: string;
  sent: boolean;  // true = bot/operador, false = usuario
  read: boolean;
  type: 'text' | 'image' | 'video' | 'audio' | 'document';
  fileUrl?: string;
  filename?: string;
  size?: number;
  duration?: number;
}

interface SocketMessage {
  id?: number;
  telefono: string;
  tipo: 'usuario' | 'bot';
  mensaje: string;
  timestamp: string;
  emisor: string;
}
```

---

## 🧪 Testing de API

### Con cURL

```bash
# Login
curl -X POST https://chat.irrigacionmalargue.net/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}'

# Obtener chats
curl -X GET https://chat.irrigacionmalargue.net/api/chats \
  -H "Authorization: Bearer <token>"

# Enviar mensaje
curl -X POST https://chat.irrigacionmalargue.net/api/send \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"telefono":"5491234567890","texto":"Hola"}'
```

### Con Frontend Dev Tools

```javascript
// En consola del navegador
const token = localStorage.getItem('token');

// Test endpoint
fetch('https://chat.irrigacionmalargue.net/api/chats', {
  headers: { 'Authorization': `Bearer ${token}` }
})
.then(r => r.json())
.then(console.log);
```

---

## 📚 Referencias

- **Backend API Docs**: `https://chat.irrigacionmalargue.net/api-docs`
- **Swagger UI**: Documentación interactiva completa
- **Socket.io Docs**: https://socket.io/docs/v4/

---

**Última actualización**: Febrero 2026
