# 📝 Changelog

Todos los cambios notables en este proyecto serán documentados en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es/1.0.0/),
y este proyecto adhiere a [Semantic Versioning](https://semver.org/lang/es/).

---

## [1.0.0] - 2026-02-11

### ✨ Características Principales

#### Gestión de Conversaciones
- Lista de chats en tiempo real con Socket.io
- Historial de mensajes con scroll infinito
- Búsqueda y filtrado de conversaciones
- Indicadores de mensajes no leídos
- Eliminación de conversaciones

#### Mensajería Avanzada
- Envío de texto y archivos multimedia
- Formateo WhatsApp (*negrita*, _cursiva_, ~tachado~, ```código```)
- Estado de mensajes (enviado ✓, entregado ✓✓)
- Indicadores de escritura en tiempo real
- Auto-scroll suave en mensajes nuevos

#### Control del Bot
- Pausar/activar bot por cliente
- Reactivar conversaciones (>24h) con plantillas
- Marcar conversaciones como atendidas
- Indicador visual de estado del bot

#### UI/UX
- Modo oscuro/claro persistente
- 5 temas de color (Emerald, Blue, Violet, Amber, Rose)
- Backgrounds personalizables con patrones
- Notificaciones con sonido configurable
- Interfaz responsive (mobile + desktop)

#### Seguridad
- Autenticación JWT con refresh automático
- Manejo de sesión expirada
- Interceptores de autenticación en Axios
- Protección XSS con sanitización de HTML

### 🔧 Mejoras Técnicas

#### Performance
- React.memo en componentes críticos (Sidebar, ChatWindow, MessageList, ChatHeader, MessageInput)
- Bundle optimizado: 260 KB gzipped
- Lazy loading de imágenes
- Caché de mensajes en localStorage

#### Código
- ~45 console.logs eliminados (solo console.error en producción)
- Import Clock no utilizado eliminado
- Mapeo de API actualizado para soportar campos `contenido`, `tipo`, `created_at`
- Retrocompatibilidad con formato antiguo de API

#### Configuración
- Variables de entorno centralizadas en `src/config/env.ts`
- `.env.production` con dominio `chat.irrigacionmalargue.net`
- Feature flags para logging y Sentry

### 🐛 Fixes

- **Mensajes duplicados**: Implementado deduplicación multi-capa con IDs estables
- **Fechas "8/1"**: parseMessageDate() con validación isNaN
- **Orden de mensajes**: Cambiado a dedupe→sort (ASC por fecha+ID)
- **Display invertido**: Removido .reverse() mutation
- **Auto-scroll no funcionaba**: useEffect en messages array completo (no solo length)
- **Sesión expirada**: Manejo de 401/403 con logout automático
- **Chat eliminado deja blank**: useEffect valida y clamps selectedChat index

### 📚 Documentación

- README.md principal renovado con badges y estructura clara
- docs/DEPLOYMENT.md con guías para Nginx, Apache, Docker
- docs/API.md con especificación completa de endpoints
- docs/CONTRIBUTING.md con flujo de trabajo y estándares

### 🗑️ Eliminados

- Archivos de documentación redundantes (10+ archivos .md)
- Console.logs de desarrollo (~45 instancias)
- Imports no utilizados (Clock de lucide-react)
- Archivos temporales (PHASE_*.txt, test-results.txt)

---

## [0.9.0] - 2026-01-15

### Agregado
- Sistema de temas con 5 colores predefinidos
- Modo oscuro con persistencia en localStorage
- Control de volumen en mensajes de audio
- Emoji picker integrado

### Cambiado
- Migración de Create React App a Vite
- Actualización de React 17 a React 18
- Refactorización de manejo de estado

### Corregido
- Problema de conexión Socket.io en producción
- Memory leak en useEffect de mensajes
- Scroll automático en Safari

---

## [0.8.0] - 2026-01-07

### Agregado
- Autenticación JWT completa
- Login con tema y modo oscuro
- Headers de autorización en todas las peticiones

### Corregido
- Campo `emisor` inválido en POST /api/send
- Mapeo de socket `nuevo_mensaje` para identificar sender
- Logout dejaba pantalla en blanco

---

## [0.7.0] - 2026-01-05

### Agregado
- Control de volumen en audios
- Adjuntar archivos
- Bearer token en mensajes/pause/activate

### Cambiado
- Axios/socket con tokens en initial data fetch

---

## [0.6.0] - 2025-12-20

### Agregado
- Soporte para mensajes multimedia (imagen, video, audio, documentos)
- Preview de archivos antes de enviar
- Drag & drop para archivos

---

## [0.5.0] - 2025-12-10

### Agregado
- Socket.io para tiempo real
- Indicadores de escritura
- Notificaciones de mensajes nuevos

---

## [0.4.0] - 2025-12-01

### Agregado
- Sidebar con lista de conversaciones
- Búsqueda de chats
- Badges de mensajes no leídos

---

## [0.3.0] - 2025-11-15

### Agregado
- Ventana de chat básica
- Envío de mensajes de texto
- Historial de mensajes

---

## [0.2.0] - 2025-11-01

### Agregado
- Setup inicial del proyecto con Vite
- Configuración de Tailwind CSS
- Estructura de carpetas base

---

## [0.1.0] - 2025-10-20

### Agregado
- Proyecto iniciado
- Configuración básica de TypeScript
- Dependencias iniciales

---

## Tipos de Cambios

- **Agregado** - para nuevas funcionalidades
- **Cambiado** - para cambios en funcionalidades existentes
- **Obsoleto** - para funcionalidades que serán removidas
- **Eliminado** - para funcionalidades removidas
- **Corregido** - para corrección de bugs
- **Seguridad** - para vulnerabilidades

---

**[Unreleased]** - Cambios en desarrollo
- [ ] Panel de estadísticas
- [ ] Export de conversaciones
- [ ] Plantillas de respuestas rápidas
- [ ] Multi-idioma (i18n)

---

[1.0.0]: https://github.com/irrigacion-malargue/frontend/releases/tag/v1.0.0
[0.9.0]: https://github.com/irrigacion-malargue/frontend/releases/tag/v0.9.0
[0.8.0]: https://github.com/irrigacion-malargue/frontend/releases/tag/v0.8.0
