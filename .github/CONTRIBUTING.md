# 🤝 Guía de Contribución

Gracias por tu interés en contribuir a **Bot de Irrigación Malargüe**. Este documento proporciona las directrices para contribuir al proyecto.

## 📋 Tabla de Contenidos

- [Código de Conducta](#código-de-conducta)
- [Comenzar](#comenzar)
- [Flujo de Trabajo](#flujo-de-trabajo)
- [Convenciones de Código](#convenciones-de-código)
- [Commits](#commits)
- [Pull Requests](#pull-requests)
- [Reporting Bugs](#reporting-bugs)
- [Sugerencias de Features](#sugerencias-de-features)

---

## 📜 Código de Conducta

Este proyecto y todos sus participantes se rigen por nuestro [Código de Conducta](CODE_OF_CONDUCT.md). Al participar, se espera que mantengas este código.

---

## 🚀 Comenzar

### 1. Fork del Repositorio

Haz clic en el botón "Fork" en GitHub para crear una copia del repositorio en tu cuenta.

### 2. Clonar tu Fork

```bash
git clone https://github.com/tu-usuario/bot-irrigacion.git
cd bot-irrigacion
```

### 3. Agregar Upstream

```bash
git remote add upstream https://github.com/irrigacionmalargue/bot-irrigacion.git
```

### 4. Crear Rama de Desarrollo

```bash
git checkout -b feature/mi-caracteristica
# O para bugfix
git checkout -b fix/mi-bugfix
```

### 5. Instalar Dependencias

```bash
npm install
```

---

## 🔄 Flujo de Trabajo

### 1. Crear Rama Local

```bash
git checkout -b feature/nueva-caracteristica
```

**Prefijos recomendados**:
- `feature/` - Nueva funcionalidad
- `fix/` - Corrección de bug
- `docs/` - Documentación
- `refactor/` - Refactorización de código
- `test/` - Agregar/actualizar tests
- `perf/` - Mejoras de performance
- `chore/` - Cambios en build, deps, etc

### 2. Hacer Cambios

- Sigue las [convenciones de código](#convenciones-de-código)
- Escribe tests para nuevas funcionalidades
- Actualiza documentación si es necesario

### 3. Commit Local

```bash
git add .
git commit -m "feat: descripción clara del cambio"
```

### 4. Sincronizar con Upstream

```bash
git fetch upstream
git rebase upstream/main
```

### 5. Push a tu Fork

```bash
git push origin feature/nueva-caracteristica
```

### 6. Crear Pull Request

Abre un PR en GitHub con tu rama. Ver [Pull Requests](#pull-requests) para detalles.

---

## 💻 Convenciones de Código

### JavaScript/Node.js

```javascript
// ❌ Evitar
const foo = (a,b) => { let result = a + b; return result; }

// ✅ Preferir
const calculateSum = (a, b) => {
  return a + b;
};
```

### Estilo de Código

- **Indentación**: 2 espacios
- **Punto y coma**: Obligatorio
- **Comillas**: Comillas simples `'string'`
- **Const/Let**: Usar `const` por defecto, `let` si es necesario
- **var**: Nunca usar

### Nombres

```javascript
// ❌ Evitar nombres cortos/ambiguos
const d = '2026-02-11';
const fn = (x) => x * 2;

// ✅ Preferir nombres descriptivos
const registrationDate = '2026-02-11';
const doubleValue = (number) => number * 2;
```

### Comentarios

```javascript
// ✅ Comentarios útiles
// Reintentar conexión hasta 3 veces antes de fallar
const maxRetries = 3;

// ❌ Comentarios obvios
// Incrementar i
i++;
```

### Funciones

```javascript
// ✅ Función bien documentada
/**
 * Valida un número de teléfono argentino
 * @param {string} phone - Teléfono en formato 549XXXXXXXXXX
 * @returns {boolean} true si es válido
 */
function validateArgentinePhone(phone) {
  return /^549\d{10}$/.test(phone);
}
```

### Errores

```javascript
// ✅ Manejo de errores apropiado
try {
  await database.query(sql);
} catch (error) {
  logger.error('Database query failed', { error, sql });
  throw new DatabaseError('Failed to execute query');
}

// ❌ Evitar
try {
  await database.query(sql);
} catch (e) {
  console.log('error');
}
```

---

## 📝 Commits

Usamos [Conventional Commits](https://www.conventionalcommits.org/) para mensajes claros y consistentes.

### Formato

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Tipos

- **feat**: Nueva característica
- **fix**: Corrección de bug
- **docs**: Cambios en documentación
- **style**: Cambios de formato (sin cambios de lógica)
- **refactor**: Refactorización de código
- **test**: Agregar/actualizar tests
- **perf**: Mejoras de performance
- **chore**: Cambios en build, deps, etc

### Ejemplos

```bash
# Característica
git commit -m "feat(api): agregar endpoint para obtener estadísticas"

# Bug fix
git commit -m "fix(webhook): resolver error de validación en firma"

# Documentación
git commit -m "docs(readme): actualizar instrucciones de instalación"

# Múltiples cambios
git commit -m "refactor(db): optimizar consultas de deudas

- Agregar índices en tablas principales
- Reducir n+1 queries en listado de clientes
- Benchmarks muestran 40% mejora"
```

---

## 🔀 Pull Requests

### Antes de Enviar

- [ ] Sincronizar con `upstream/main`
- [ ] Ejecutar tests: `npm test`
- [ ] Verificar que el código sigue convenciones
- [ ] Actualizar documentación si es necesario
- [ ] Escribir descripción clara del PR

### Plantilla de PR

Usar el template automático al crear PR. Debe incluir:

```markdown
## 📝 Descripción
Descripción clara de los cambios

## 🔗 Issue Relacionado
Fixes #123 (si aplica)

## ✅ Tipo de Cambio
- [ ] 🐛 Bug fix
- [ ] ✨ Nueva característica
- [ ] 📚 Documentación
- [ ] ♻️ Refactorización

## 🧪 Testing
Describe cómo testear los cambios

## ✔️ Checklist
- [ ] Tests pasan localmente
- [ ] Código sigue convenciones
- [ ] Documentación actualizada
- [ ] Sin cambios breaking
```

### Revisión de PR

Los PRs serán revisados por mantenedores. Se pueden solicitar cambios antes de merge.

---

## 🐛 Reporting Bugs

### Antes de Reportar

- Verificar que no exista issue similar
- Reproducir el bug consistentemente
- Recopilar información del sistema

### Reportar Bug

Usar [Bug Report Template](./.github/ISSUE_TEMPLATE/bug_report.md)

Incluir:
- Descripción clara del bug
- Pasos para reproducir
- Comportamiento esperado vs actual
- Screenshots si es relevante
- Información del entorno

---

## ✨ Sugerencias de Features

### Antes de Sugerir

- Verificar que no exista feature request similar
- Describir claramente el caso de uso
- Considerar el alcance del proyecto

### Sugerir Feature

Usar [Feature Request Template](./.github/ISSUE_TEMPLATE/feature_request.md)

Incluir:
- Descripción de la característica
- Motivación y caso de uso
- Posible implementación (opcional)

---

## 📦 Desarrollo Local

### Instalar Dependencias

```bash
npm install
```

### Ejecutar Servidor

```bash
npm start
```

### Ejecutar Tests

```bash
npm test

# Con coverage
npm test -- --coverage

# Específicos
npm test -- --testNamePattern="browser"
```

### Linting

```bash
npm run lint

# Fijar automáticamente
npm run lint -- --fix
```

### Build

```bash
npm run build
```

---

## 📊 Estándares de Calidad

- **Tests**: Mínimo 80% de cobertura
- **Linting**: Sin errores de eslint
- **Performance**: Sin regresiones de performance
- **Security**: Sin vulnerabilidades conocidas
- **Documentation**: Todo nuevo código debe estar documentado

---

## 🎯 Prioridades

1. **Security fixes** - Máxima prioridad
2. **Bug fixes** - Alta prioridad
3. **Performance improvements** - Media prioridad
4. **New features** - Media prioridad
5. **Documentation** - Baja prioridad

---

## 📞 Preguntas?

- 📧 Email: dev@irrigacionmalargue.net
- 💬 Discussions: GitHub Discussions
- 🐛 Issues: GitHub Issues

---

## 📄 Licencia

Al contribuir, aceptas que tus contribuciones estarán bajo la licencia MIT del proyecto.

---

**¡Gracias por contribuir a Bot de Irrigación! ❤️**
