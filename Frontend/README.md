# 🌾 Bot de Irrigación Malargüe - Frontend

Panel de operador para gestionar conversaciones de WhatsApp con clientes de irrigación. Construido con React, TypeScript y optimizado para producción.

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)](https://github.com)
[![Coverage](https://img.shields.io/badge/coverage-85%25-green)](https://github.com)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

---

## 🚀 Inicio Rápido

### Prerrequisitos

- Node.js 18+
- npm o yarn
- Backend corriendo en `https://whatsapp.irrigacionmalargue.net`

### Instalación

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con tus credenciales

# 3. Iniciar servidor de desarrollo
npm run dev
```

Abre [http://localhost:5173](http://localhost:5173) en tu navegador.

---

## 📦 Stack Tecnológico

| Categoría | Tecnologías |
|-----------|------------|
| **Core** | React 18, TypeScript, Vite |
| **UI** | Tailwind CSS, Radix UI, Lucide Icons |
| **Estado** | React Hooks, Context API |
| **Comunicación** | Axios, Socket.io Client |
| **Formularios** | React Hook Form, Zod |
| **Testing** | Vitest, Testing Library |
| **Build** | Vite, PostCSS, PWA Plugin |

---

## 🎯 Características Principales

### ✅ Gestión de Conversaciones
- Lista de chats en tiempo real
- Historial de mensajes con scroll infinito
- Búsqueda y filtrado de conversaciones
- Indicadores de mensajes no leídos

### 💬 Mensajería Avanzada
- Envío de texto y archivos multimedia
- Formateo WhatsApp (*negrita*, _cursiva_, ~tachado~, ```código```)
- Estado de mensajes (enviado ✓, entregado ✓✓)
- Indicadores de escritura en tiempo real

### 🤖 Control del Bot
- Pausar/activar bot por cliente
- Reactivar conversaciones (>24h)
- Marcar conversaciones como atendidas
- Eliminar conversaciones

### 🎨 Personalización
- Modo oscuro/claro
- 5 temas de color (Emerald, Blue, Violet, Amber, Rose)
- Backgrounds personalizables
- Notificaciones con sonido

### 🔐 Seguridad
- Autenticación JWT con refresh automático
- Manejo de sesión expirada
- Interceptores de autenticación
- Protección XSS/CSRF

---

## 🏗️ Estructura del Proyecto

```
Frontend/
├── src/
│   ├── components/          # Componentes React
│   │   ├── ui/             # Componentes base (Radix UI)
│   │   ├── Login.tsx       # Autenticación
│   │   ├── chat-*.tsx      # Componentes de chat
│   │   └── ...
│   ├── config/             # Configuración
│   │   ├── env.ts          # Variables de entorno
│   │   └── auth.ts         # Config de autenticación
│   ├── utils/              # Utilidades
│   │   ├── axiosInterceptor.ts
│   │   └── ...
│   ├── styles/             # Estilos globales
│   ├── App.tsx             # Componente principal
│   └── main.tsx            # Entry point
├── public/                 # Assets estáticos
├── docs/                   # Documentación detallada
│   ├── DEPLOYMENT.md       # Guía de despliegue
│   ├── API.md              # Documentación de API
│   └── CONTRIBUTING.md     # Guía de contribución
├── dist/                   # Build de producción
├── .env.example            # Variables de entorno ejemplo
├── .env.production         # Config de producción
├── vite.config.ts          # Configuración Vite
├── tailwind.config.js      # Configuración Tailwind
└── package.json            # Dependencias
```

---

## 🔧 Scripts Disponibles

```bash
# Desarrollo
npm run dev              # Servidor de desarrollo (localhost:5173)

# Build
npm run build            # Build de producción
npm run preview          # Preview del build

# Testing
npm run test             # Ejecutar tests
npm run test:critical    # Tests críticos de mensajería/cache
npm run test:ui          # UI de testing
npm run test:coverage    # Reporte de cobertura

# Calidad de Código
npm run lint             # Linter ESLint

# Release hardening
npm run release:check        # Gate mínima (tests críticos + build)
npm run release:check:full   # Gate completa (lint + tests + build)
```

---

## 🌍 Variables de Entorno

### Producción (`.env.production`)

```env
VITE_API_URL=https://whatsapp.irrigacionmalargue.net
VITE_SOCKET_URL=https://whatsapp.irrigacionmalargue.net
VITE_TOKEN_KEY=token
VITE_OPERADOR_KEY=operador
VITE_JWT_EXPIRY_MS=3600000
VITE_ENABLE_LOGGING=false
VITE_ENABLE_SENTRY=true
VITE_SENTRY_DSN=your-sentry-dsn
```

### Desarrollo (`.env.local`)

```env
VITE_API_URL=http://localhost:3000
VITE_SOCKET_URL=http://localhost:3000
VITE_ENABLE_LOGGING=true
VITE_ENABLE_SENTRY=false
```

Ver [.env.example](.env.example) para todas las variables disponibles.

---

## 📚 Documentación

- **[Guía de Despliegue](docs/DEPLOYMENT.md)** - Cómo desplegar en producción
- **[Documentación de API](docs/API.md)** - Endpoints y contratos
- **[Guía de Contribución](docs/CONTRIBUTING.md)** - Cómo contribuir al proyecto
- **[Release Hardening Checklist](docs/RELEASE_HARDENING_CHECKLIST.md)** - Gate de calidad previa a producción
- **[Changelog](CHANGELOG.md)** - Historial de cambios

---

## 🚢 Despliegue a Producción

### Build

```bash
# 1. Instalar dependencias
npm ci

# 2. Generar build
npm run build

# 3. Verificar build
npm run preview
```

### Desplegar

La carpeta `dist/` contiene todos los archivos estáticos listos para desplegar:

```bash
# Opción 1: SCP al servidor
scp -r dist/* usuario@servidor:/var/www/frontend/

# Opción 2: Docker
docker build -t irrigacion-frontend .
docker run -p 80:80 irrigacion-frontend

# Opción 3: Netlify/Vercel
# Conectar repo y configurar:
# - Build command: npm run build
# - Publish directory: dist
```

Ver [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) para guía completa.

---

## 🧪 Testing

```bash
# Ejecutar todos los tests
npm run test

# Tests con UI interactiva
npm run test:ui

# Cobertura de código
npm run test:coverage
```

Cobertura actual: **85%** ✅

---

## 🎨 Personalización

### Temas de Color

El frontend soporta 5 temas predefinidos editables en `src/App.tsx`:

```typescript
const themeColors = {
  emerald: { hex: '#10b981', name: 'Esmeralda' },
  blue: { hex: '#3b82f6', name: 'Azul' },
  violet: { hex: '#8b5cf6', name: 'Violeta' },
  amber: { hex: '#f59e0b', name: 'Ámbar' },
  rose: { hex: '#f43f5e', name: 'Rosa' }
};
```

### Modo Oscuro

Activar/desactivar desde el sidebar o por defecto en `src/App.tsx`:

```typescript
const [darkMode, setDarkMode] = useState(
  () => localStorage.getItem('darkMode') === 'true'
);
```

---

## 🐛 Solución de Problemas

### Error de conexión con backend

```bash
# Verificar que el backend esté corriendo
curl https://whatsapp.irrigacionmalargue.net/health

# Verificar variables de entorno
cat .env.local
```

### Build falla

```bash
# Limpiar cache y reinstalar
rm -rf node_modules dist
npm install
npm run build
```

### Tests fallan

```bash
# Actualizar snapshots
npm run test -- -u

# Ejecutar tests en modo watch
npm run test -- --watch
```

---

## 📊 Métricas de Rendimiento

| Métrica | Valor | Estado |
|---------|-------|--------|
| Bundle Size (gzipped) | 260 KB | ✅ |
| First Contentful Paint | < 1.5s | ✅ |
| Time to Interactive | < 3.0s | ✅ |
| Lighthouse Score | 95+ | ✅ |
| Test Coverage | 85% | ✅ |

---

## 🤝 Contribuir

¡Las contribuciones son bienvenidas! Por favor lee [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) para detalles sobre el proceso de contribución.

### Pasos básicos:

1. Fork el proyecto
2. Crea una rama feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit tus cambios (`git commit -m 'Agregar nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Abre un Pull Request

---

## 📄 Licencia

Este proyecto está bajo la Licencia MIT - ver [LICENSE](LICENSE) para detalles.

---

## 👥 Equipo

Desarrollado por el equipo de Irrigación Malargüe.

- **Contacto**: info@irrigacionmalargue.net
- **Website**: https://whatsapp.irrigacionmalargue.net
- **Soporte**: Crear issue en GitHub

---

## 🔗 Enlaces Útiles

- [Documentación Backend](../Backend/README.md)
- [API Swagger](https://whatsapp.irrigacionmalargue.net/api-docs)
- [WhatsApp Business API](https://developers.facebook.com/docs/whatsapp)
- [React Docs](https://react.dev)
- [Vite Docs](https://vitejs.dev)
- [Tailwind CSS](https://tailwindcss.com)

---

**Hecho con ❤️ para Irrigación Malargüe**
