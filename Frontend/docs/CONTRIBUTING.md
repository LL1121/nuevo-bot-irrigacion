# 🤝 Guía de Contribución

¡Gracias por tu interés en contribuir al Bot de Irrigación Malargüe! Esta guía te ayudará a empezar.

---

## 📋 Tabla de Contenidos

1. [Código de Conducta](#código-de-conducta)
2. [¿Cómo Puedo Contribuir?](#cómo-puedo-contribuir)
3. [Configuración del Entorno](#configuración-del-entorno)
4. [Flujo de Trabajo](#flujo-de-trabajo)
5. [Estándares de Código](#estándares-de-código)
6. [Testing](#testing)
7. [Documentación](#documentación)
8. [Pull Requests](#pull-requests)

---

## 🌟 Código de Conducta

Este proyecto sigue el [Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/version/2/1/code_of_conduct/). Al participar, te comprometes a mantener un ambiente respetuoso e inclusivo.

---

## 🎯 ¿Cómo Puedo Contribuir?

### Reportar Bugs

Antes de crear un issue:
1. Busca si ya existe un issue similar
2. Incluye pasos para reproducir el problema
3. Indica tu entorno (SO, navegador, versión)

**Template de Bug Report**:
```markdown
## Descripción del Bug
[Descripción clara y concisa]

## Pasos para Reproducir
1. Ir a '...'
2. Click en '...'
3. Ver error

## Comportamiento Esperado
[Qué debería pasar]

## Screenshots
[Si aplica]

## Entorno
- SO: [ej. Windows 11]
- Navegador: [ej. Chrome 120]
- Versión: [ej. 1.0.0]
```

### Sugerir Mejoras

Para sugerir nuevas funcionalidades:
1. Explica el problema que resuelve
2. Describe la solución propuesta
3. Incluye mockups o ejemplos si es posible

### Contribuir con Código

1. Busca issues con label `good first issue` o `help wanted`
2. Comenta en el issue que quieres trabajar en él
3. Sigue el [Flujo de Trabajo](#flujo-de-trabajo)

---

## 🔧 Configuración del Entorno

### Prerrequisitos

- Node.js 18+
- npm 9+
- Git
- Editor: VS Code (recomendado)

### Setup Inicial

```bash
# 1. Fork el repositorio en GitHub

# 2. Clonar tu fork
git clone https://github.com/TU-USUARIO/bot-irrigacion-frontend.git
cd bot-irrigacion-frontend

# 3. Agregar upstream
git remote add upstream https://github.com/ORIGINAL/bot-irrigacion-frontend.git

# 4. Instalar dependencias
npm install

# 5. Copiar variables de entorno
cp .env.example .env.local

# 6. Iniciar servidor de desarrollo
npm run dev
```

### Extensiones VS Code Recomendadas

- ESLint
- Prettier
- TypeScript and JavaScript Language Features
- Tailwind CSS IntelliSense
- Vitest

Archivo `.vscode/extensions.json`:
```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "vitest.explorer"
  ]
}
```

---

## 🔄 Flujo de Trabajo

### 1. Sincronizar con Upstream

```bash
git checkout main
git fetch upstream
git merge upstream/main
```

### 2. Crear Rama Feature

```bash
git checkout -b feature/nombre-descriptivo

# O para bugs
git checkout -b fix/descripcion-del-fix
```

**Convención de nombres de ramas**:
- `feature/` - Nuevas funcionalidades
- `fix/` - Correcciones de bugs
- `docs/` - Cambios en documentación
- `refactor/` - Refactorización de código
- `test/` - Agregar o actualizar tests
- `chore/` - Mantenimiento (deps, config, etc)

### 3. Hacer Cambios

```bash
# Hacer cambios en el código
# Commitear con mensajes descriptivos
git add .
git commit -m "feat: agregar funcionalidad X"
```

### 4. Mantener Rama Actualizada

```bash
git fetch upstream
git rebase upstream/main
```

### 5. Push y Pull Request

```bash
git push origin feature/nombre-descriptivo
```

Luego crea un Pull Request en GitHub.

---

## 📝 Estándares de Código

### TypeScript

```typescript
// ✅ Bueno: Interfaces explícitas
interface ChatProps {
  chat: Chat;
  onSelect: (id: string) => void;
}

export function ChatItem({ chat, onSelect }: ChatProps) {
  // ...
}

// ❌ Malo: Sin tipos
export function ChatItem({ chat, onSelect }) {
  // ...
}
```

### React

```typescript
// ✅ Bueno: Componentes funcionales con memo
export const ChatList = memo(function ChatList({ chats }: Props) {
  // ...
});

// ✅ Bueno: Hooks al inicio
const [state, setState] = useState();
const ref = useRef();
useEffect(() => {}, []);

// ❌ Malo: Hooks condicionales
if (condition) {
  useEffect(() => {}, []);
}
```

### Naming Conventions

```typescript
// Componentes: PascalCase
export function ChatWindow() {}

// Funciones: camelCase
function handleClick() {}

// Constantes: UPPER_SNAKE_CASE
const MAX_RETRIES = 3;

// Interfaces: PascalCase con prefijo I (opcional)
interface ChatMessage {}

// Tipos: PascalCase
type Status = 'active' | 'inactive';
```

### Estilos (Tailwind)

```tsx
// ✅ Bueno: Clases ordenadas (layout → spacing → colors)
<div className="flex items-center gap-4 p-4 bg-white rounded-lg">

// ✅ Bueno: Usar componentes de shadcn/ui
<Button variant="outline" size="sm">Click</Button>

// ❌ Malo: Estilos inline
<div style={{ padding: '16px' }}>
```

---

## 🧪 Testing

### Ejecutar Tests

```bash
# Todos los tests
npm run test

# Tests específicos
npm run test -- ChatWindow.test.tsx

# Con cobertura
npm run test:coverage

# UI interactiva
npm run test:ui
```

### Escribir Tests

```typescript
// src/components/ChatWindow.test.tsx
import { render, screen } from '@testing-library/react';
import { ChatWindow } from './ChatWindow';

describe('ChatWindow', () => {
  it('should render chat messages', () => {
    const messages = [
      { id: 1, text: 'Hola', sent: true }
    ];
    
    render(<ChatWindow messages={messages} />);
    
    expect(screen.getByText('Hola')).toBeInTheDocument();
  });
  
  it('should handle send message', async () => {
    const onSend = vi.fn();
    render(<ChatWindow onSend={onSend} />);
    
    // Simular envío
    const input = screen.getByPlaceholderText('Mensaje');
    await userEvent.type(input, 'Test');
    await userEvent.click(screen.getByRole('button', { name: /enviar/i }));
    
    expect(onSend).toHaveBeenCalledWith('Test');
  });
});
```

### Cobertura Mínima

- **Componentes nuevos**: 80%+
- **Funciones críticas**: 100%
- **Utilities**: 90%+

---

## 📚 Documentación

### Comentar Código

```typescript
/**
 * Normaliza el contenido de mensajes de WhatsApp
 * Extrae preview de listas interactivas y retorna texto plano
 * 
 * @param input - Mensaje raw del backend (string o objeto)
 * @returns Objeto con texto normalizado y preview
 */
function normalizeMessageContent(input: string | object) {
  // ...
}
```

### Actualizar Docs

Si tu cambio afecta:
- **API**: Actualizar `docs/API.md`
- **Deployment**: Actualizar `docs/DEPLOYMENT.md`
- **Features**: Actualizar `README.md`
- **Breaking Changes**: Actualizar `CHANGELOG.md`

---

## 🔀 Pull Requests

### Checklist antes de crear PR

- [ ] El código compila sin errores (`npm run build`)
- [ ] Todos los tests pasan (`npm run test`)
- [ ] Cobertura ≥80% en nuevo código
- [ ] Linter pasa sin warnings (`npm run lint`)
- [ ] Documentación actualizada
- [ ] Commits con mensajes descriptivos
- [ ] Sin console.logs en código de producción

### Formato de PR

**Título**: 
```
feat: agregar indicador de escritura en tiempo real
fix: corregir auto-scroll en mensajes largos
```

**Descripción**:
```markdown
## Cambios
- Agregar indicador "escribiendo..." con timeout
- Socket.io event `typing` escuchado
- UI actualizada con animación de puntos

## Screenshots
[Si aplica]

## Testing
- [ ] Tests unitarios agregados
- [ ] Tests de integración actualizados
- [ ] Testeado manualmente en dev

## Breaking Changes
[Si aplica]

## Relacionado
Closes #123
```

### Convención de Commits

Usar [Conventional Commits](https://www.conventionalcommits.org/):

```bash
feat: agregar nueva funcionalidad
fix: corregir bug
docs: actualizar documentación
style: cambios de formato (no afectan código)
refactor: refactorización de código
test: agregar o actualizar tests
chore: mantenimiento (deps, config)
```

**Ejemplos**:
```bash
git commit -m "feat: agregar búsqueda de chats"
git commit -m "fix: corregir duplicación de mensajes en socket"
git commit -m "docs: actualizar guía de deployment"
git commit -m "refactor: extraer lógica de formateo a utils"
```

---

## 🎨 Estructura de Proyecto

Al agregar nuevos archivos, seguir esta estructura:

```
src/
├── components/           # Componentes React
│   ├── ui/              # Componentes base reutilizables
│   ├── Chat*.tsx        # Componentes de chat
│   └── Login.tsx        # Componentes de página
├── utils/               # Funciones utilitarias
├── hooks/               # Custom React hooks
├── types/               # TypeScript types/interfaces
├── config/              # Configuración
├── api/                 # Clientes de API
└── styles/              # Estilos globales
```

---

## 🐛 Debug

### React DevTools

Instalar extensión: [React DevTools](https://react.dev/learn/react-developer-tools)

### Redux DevTools (si usamos Redux)

Instalar extensión: [Redux DevTools](https://github.com/reduxjs/redux-devtools)

### Logs

```typescript
// Usar solo en desarrollo
if (import.meta.env.DEV) {
  console.log('Debug info:', data);
}

// O con env flag
if (env.enableLogging) {
  console.log('Info:', data);
}
```

---

## 📞 Soporte

¿Tienes dudas? ¡Contáctanos!

- **Issues**: GitHub Issues
- **Discussions**: GitHub Discussions
- **Email**: dev@irrigacionmalargue.net

---

## 🎓 Recursos

- [React Docs](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Vite Guide](https://vitejs.dev/guide/)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Testing Library](https://testing-library.com/docs/react-testing-library/intro/)

---

¡Gracias por contribuir! 🎉

**Última actualización**: Febrero 2026
