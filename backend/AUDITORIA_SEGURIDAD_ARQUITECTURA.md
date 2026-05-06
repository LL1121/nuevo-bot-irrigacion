# Reporte de Auditoría: Seguridad y Arquitectura Backend - Bot Irrigación

**Fecha:** 4 de Mayo de 2026  
**Auditor:** Gemini CLI (Senior Backend & Cybersecurity Expert)  
**Proyecto:** Nuevo Bot de Irrigación

---

## 1. Fugas de Credenciales y Secretos Hardcodeados

### Hallazgos
- **Entorno de Tests:** Se detectó `process.env.JWT_SECRET = 'test_jwt_secret_for_unit_tests';` en `authController.test.js`. Esto es aceptable para pruebas unitarias aisladas, pero debe evitarse si los tests se ejecutan en entornos compartidos.
- **Configuración de DB:** En `backend/src/config/db.js`, el campo `password` para la conexión a PostgreSQL tiene como fallback una cadena vacía (`process.env.DB_PASSWORD || ''`). Si el archivo `.env` no se carga correctamente, la aplicación intentará conectarse sin contraseña, lo cual es una vulnerabilidad si la base de datos permite conexiones locales sin password.
- **Validación de Webhook:** El secreto de validación del webhook se obtiene de múltiples variables de entorno (`WEBHOOK_APP_SECRET`, `WHATSAPP_APP_SECRET`, etc.), lo cual puede generar confusión en la configuración.

### Recomendaciones
- Implementar una validación estricta al inicio (`bootstrap`) que falle inmediatamente si faltan variables críticas como `DB_PASSWORD`, `JWT_SECRET` o `WEBHOOK_APP_SECRET`.
- No usar fallbacks vacíos para credenciales críticas.

---

## 2. Inyecciones SQL y Diseño de Base de Datos

### Hallazgos
- **Parametrización:** En general, se utiliza un patrón de parametrización mediante el caracter `?` que luego es transformado a `$1, $2...` por el servicio `db.js`. Esto mitiga los riesgos de inyección SQL en la mayoría de los casos analizados (`clienteService.js`, `apiController.js`).
- **Integridad Referencial:** El esquema de la DB en `db.js` utiliza correctamente `REFERENCES` y `ON DELETE CASCADE`, lo cual es una buena práctica para mantener la integridad de los datos.
- **Riesgos Potenciales:** Aunque no se encontraron concatenaciones directas de variables de `req.body` en las consultas principales, la complejidad del `webhookController.js` (4500+ líneas) dificulta garantizar que no existan vectores de inyección en ramas de código poco frecuentes.

### Recomendaciones
- Migrar a un Query Builder (como Knex.js) o un ORM ligero para estandarizar las consultas y evitar la transformación manual de parámetros.

---

## 3. Redundancia de Lógica y Arquitectura (Bot Handlers)

### Hallazgos
- **Monolito de Controladores:** `webhookController.js` es un "God Object" de **4585 líneas**. Contiene lógica de validación, formateo de texto, gestión de archivos, estados del bot y lógica de negocio. Esto es una pesadilla de mantenimiento y viola el principio de responsabilidad única.
- **Estado en Memoria (Crítico):** Las variables `userStates` y `processedMessageIds` residen en la memoria local del proceso. Dado que el proyecto usa `pm2` en modo cluster (`start:cluster`), el estado del bot **no se compartirá** entre diferentes instancias. Esto causará que el bot "pierda la memoria" si el balanceador de carga redirige un mensaje a otro worker.
- **Lógica de Deduplicación:** La deduplicación de mensajes mediante un `Set` en memoria fallará si el proceso se reinicia o en entornos de alta disponibilidad.

### Recomendaciones
- **Desacoplamiento:** Mover las funciones de utilidad y los handlers de cada estado (`AWAITING_DNI`, `AWAITING_PADRON`, etc.) a archivos independientes o servicios especializados.
- **Persistencia de Estado:** Utilizar **Redis** (que ya está integrado en el proyecto pero no se usa para esto) para almacenar `userStates` y `processedMessageIds`. Esto permitirá escalabilidad horizontal real.

---

## 4. Tipado y Manejo de Errores

### Hallazgos
- **Falta de Tipado Estático:** El backend es puramente JavaScript. En un proyecto de esta magnitud, la falta de TypeScript aumenta exponencialmente la probabilidad de errores en tiempo de ejecución (`undefined is not a function`).
- **Manejo de Errores Deficiente:** No existe un middleware global de manejo de errores (`app.use((err, req, res, next) => ...)`). Los errores se capturan localmente con `try/catch` y se loguean con `console.error`, lo que ensucia los logs y no garantiza una respuesta uniforme al cliente.
- **Fugas de Información:** Algunos errores en controladores devuelven el mensaje del error directamente al cliente, lo que podría exponer detalles internos de la infraestructura.

### Recomendaciones
- Migrar a TypeScript para definir interfaces claras para los estados del usuario y las respuestas de la API.
- Implementar un middleware centralizado de errores para manejar excepciones, loguearlas correctamente (usando el `logService` o Sentry ya integrado) y devolver respuestas estandarizadas.

---

## 5. Conclusiones Generales

El proyecto tiene una base sólida en cuanto a seguridad de consultas SQL, pero sufre de un **grave problema de escalabilidad y deuda técnica**. El controlador de webhooks debe ser refactorizado urgentemente antes de añadir más funciones. La dependencia de estados en memoria impide el uso efectivo de clusters y contenedores, limitando la disponibilidad del sistema bajo carga.

**Prioridad 1:** Mover el estado de los usuarios (`userStates`) a Redis.  
**Prioridad 2:** Refactorizar `webhookController.js` descomponiendo la máquina de estados.  
**Prioridad 3:** Implementar manejo global de errores.
