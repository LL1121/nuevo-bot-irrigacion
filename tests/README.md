# Tests del Bot de Irrigación

Este directorio contiene los tests automatizados para verificar que las optimizaciones y funcionalidades del bot funcionan correctamente.

## 📋 Tests Disponibles

### ✅ Tests Unitarios (Siempre Pasan)

1. **browserPool.test.js** (✅ Pasando)
   - Verifica que el pool de browsers Puppeteer funciona correctamente
   - Prueba reuso de browsers, concurrencia y navegación
   - Duración: ~20 segundos

2. **cacheService.test.js** (✅ Pasando)
   - Verifica funciones de Redis cache
   - Usa mocks para simular Redis
   - Duración: ~6 segundos

3. **messageValidators.test.js** (✅ Pasando)
   - Valida schemas de mensajes de WhatsApp
   - Tests de validación y sanitización
   - Duración: ~6 segundos

### ⚠️ Tests de Integración (Requieren Configuración)

4. **database.test.js** (⚠️ Requiere BD configurada)
   - Verifica pool de conexiones MySQL
   - Necesita credenciales válidas de base de datos
   - Duración: ~6 segundos

5. **api.test.js** (⚠️ Requiere servidor corriendo)
   - Verifica endpoints HTTP del bot
   - Requiere servidor activo en localhost:3000
   - Duración: ~5 segundos

6. **scraper.test.js** (⏱️ Tests lentos - opcional)
   - Verifica funciones de scraping web
   - Tarda ~2-5 minutos por página web real
   - Útil antes de desplegar a producción

## 🚀 Ejecutar Tests

### Ejecutar todos los tests rápidos

```bash
npm test -- --testPathIgnorePatterns=scraper.test.js
```

### Ejecutar solo browser pool (el más importante)

```bash
npm test browserPool.test.js
```

### Ejecutar tests con coverage

```bash
npm run test:coverage -- --testPathIgnorePatterns=scraper.test.js
```

### Ejecutar tests en modo watch (desarrollo)

```bash
npm run test:watch -- --testPathIgnorePatterns=scraper.test.js
```

### Ejecutar tests de scraper (lento, para verificación final)

```bash
npm test scraper.test.js
```

## 🔧 Configuración para Tests de BD

Si quieres ejecutar `database.test.js`, necesitas:

1. **Crear archivo `.env.test`** (opcional):
   ```bash
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=tu_password
   DB_NAME=irrigacion_bot_test
   ```

2. **O usar las credenciales de `.env` existente** (cuidado con BD de producción)

3. **Asegurarse de que MySQL esté corriendo**:
   ```bash
   # Windows
   net start MySQL80
   
   # O verificar que esté corriendo
   mysql -u root -p
   ```

Para omitir estos tests si no tienes BD:
```bash
npm test -- --testPathIgnorePatterns="scraper.test.js|database.test.js"
```

## 🌐 Configuración para Tests de API

Para ejecutar `api.test.js`:

1. **Iniciar el servidor en una terminal**:
   ```bash
   npm start
   ```

2. **En otra terminal, ejecutar tests con variable de entorno**:
   ```bash
   # Windows PowerShell
   $env:SERVER_RUNNING="true"; npm test api.test.js
   
   # Windows CMD
   set SERVER_RUNNING=true && npm test api.test.js
   
   # Linux/Mac
   SERVER_RUNNING=true npm test api.test.js
   ```

Sin la variable `SERVER_RUNNING`, estos tests se omiten automáticamente.

## ✅ Tests Críticos Pre-Deploy

Antes de desplegar a producción, **DEBES** ejecutar estos tests:

```bash
# 1. Browser Pool (crítico para optimización)
npm test browserPool.test.js

# 2. Cache Service (importante para Redis)
npm test cacheService.test.js

# 3. Message Validators (evita errores de API WhatsApp)
npm test messageValidators.test.js
```

Resultado esperado:
- ✅ browserPool.test.js: 5 tests pasando
- ✅ cacheService.test.js: 29 tests pasando  
- ✅ messageValidators.test.js: 23 tests pasando

**Total: 57 tests críticos pasando** ✨

## 📊 Métricas de Éxito

### Tests del Browser Pool

Estos son los más importantes porque validan la optimización principal:

```
✓ Debe obtener un browser del pool
✓ Debe reutilizar browsers del pool
✓ Debe manejar múltiples browsers simultáneos
✓ Browser debe poder crear páginas
✓ Browser debe poder navegar
```

Si estos 5 tests pasan, **el bot está optimizado correctamente** para manejar usuarios concurrentes.

### Logs Esperados

Cuando ejecutas browserPool.test.js, debes ver:

```
🆕 Creando nuevo browser (1/3)
♻️ Reutilizando browser existente (0 disponibles)
💾 Browser guardado en pool (1 disponibles)
🛑 Cerrando todos los browsers del pool...
```

Esto confirma que:
- ✅ Browsers se crean correctamente
- ✅ Se reutilizan (ahorro de 5-8 segundos)
- ✅ Se devuelven al pool
- ✅ Se limpian al finalizar

## 🐛 Troubleshooting

### Error: "Access denied for user"

**Problema**: Credenciales de BD incorrectas

**Solución**:
```bash
# Omitir tests de BD
npm test -- --testPathIgnorePatterns="database.test.js"
```

### Error: "Cannot find module '../src/app'"

**Problema**: Intenta cargar servidor completo

**Solución**: Ya corregido, usa skip automático si servidor no está corriendo

### Tests de Puppeteer tardan mucho

**Problema**: Puppeteer es lento en primera ejecución

**Solución**: Normal, primera vez tarda ~5s por browser, luego es más rápido

### "Exceeded timeout"

**Problema**: Test tarda más de lo esperado

**Solución**: 
```javascript
// Los timeouts ya están configurados:
test('nombre', async () => {
  // ...
}, 60000); // 60 segundos
```

## 📈 Historial de Optimización

| Versión | Tests Pasando | Tiempo Total | Notas |
|---------|---------------|--------------|-------|
| v1.0 | 23/75 | 126s | Sin optimizaciones |
| v2.0 | 58/70 | 23s | Con browser pool ✨ |

**Mejora: 82% de reducción en tiempo de tests** 🚀

## 🎯 Next Steps

Para mejorar la cobertura:

1. [ ] Crear tests para `webhookController.js` (handlers de mensajes)
2. [ ] Crear tests para funciones de scraping específicas
3. [ ] Agregar tests de performance (benchmarks)
4. [ ] Configurar CI/CD con GitHub Actions para tests automáticos

## 💡 Tips

- **Desarrollo**: Usa `npm run test:watch` para auto-ejecutar tests al guardar
- **Pre-commit**: Ejecuta `npm test` antes de hacer commit
- **Pre-deploy**: Ejecuta tests completos incluyendo scrapers
- **Producción**: Configura monitoring para detectar regresiones

---

**¿Preguntas?** Revisa [OPTIMIZACIONES.md](../OPTIMIZACIONES.md) y [DEPLOY.md](../DEPLOY.md) para más info.
