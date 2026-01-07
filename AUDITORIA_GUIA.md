# 📋 Audit Log - Guía de Implementación

## Descripción General

El **audit log** es un sistema completo de auditoría que registra todos los cambios realizados en las tablas críticas de la base de datos. Proporciona una **pista de auditoría completa** para fines de compliance, debugging y análisis de seguridad.

## Tabla: `audit_log`

```sql
CREATE TABLE audit_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario VARCHAR(255) NOT NULL,           -- Usuario que realizó el cambio
  accion VARCHAR(50) NOT NULL,             -- INSERT, UPDATE, DELETE
  tabla VARCHAR(50) NOT NULL,              -- Tabla afectada (clientes, mensajes, etc)
  id_registro VARCHAR(255) NOT NULL,       -- Clave primaria del registro
  valores_anteriores JSON,                 -- Estado anterior (null para INSERT)
  valores_nuevos JSON,                     -- Estado nuevo
  ip_address VARCHAR(45),                  -- IP del cliente que hizo el cambio
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_usuario_timestamp (usuario, timestamp),
  INDEX idx_tabla_id (tabla, id_registro),
  INDEX idx_accion (accion),
  INDEX idx_timestamp (timestamp)
);
```

## Funciones Disponibles

### `registrarCambio(usuario, accion, tabla, idRegistro, valoresAnteriores, valoresNuevos, ipAddress)`

Registra un evento en el audit log.

**Parámetros:**
- `usuario` (string): Email/usuario que realizó la acción
- `accion` (string): INSERT, UPDATE, DELETE
- `tabla` (string): Nombre de la tabla (ej: "clientes")
- `idRegistro` (string/number): Clave primaria del registro
- `valoresAnteriores` (object): Estado anterior {campo: valor} (null para INSERT)
- `valoresNuevos` (object): Estado nuevo {campo: valor}
- `ipAddress` (string): IP del cliente (default: "SYSTEM")

**Ejemplo:**
```javascript
const { registrarCambio } = require('./services/auditService');

await registrarCambio(
  'admin@bot.com',      // usuario
  'UPDATE',             // accion
  'clientes',           // tabla
  '541234567890',       // idRegistro
  { padron: null },     // valores anteriores
  { padron: '12345' },  // valores nuevos
  '192.168.1.100'       // ip_address
);
```

**Respuesta:**
```json
{
  "success": true,
  "id": 42
}
```

---

### `obtenerHistorial(tabla, idRegistro)`

Obtiene el historial completo de cambios de un registro específico.

**Parámetros:**
- `tabla` (string): Nombre de la tabla
- `idRegistro` (string/number): ID del registro

**Ejemplo:**
```javascript
const historial = await obtenerHistorial('clientes', '541234567890');

// Retorna: Array con hasta 50 cambios más recientes
[
  {
    id: 45,
    usuario: 'admin@bot.com',
    accion: 'UPDATE',
    tabla: 'clientes',
    id_registro: '541234567890',
    valores_anteriores: { padron: null },
    valores_nuevos: { padron: '12345' },
    ip_address: '192.168.1.100',
    timestamp: '2026-01-07 14:30:00'
  },
  // ... más cambios
]
```

---

### `obtenerLog(filtros)`

Obtiene el log de auditoría con filtros opcionales avanzados.

**Parámetros:**
```javascript
const filtros = {
  usuario?: 'admin@bot.com',        // Filtrar por usuario
  tabla?: 'clientes',                // Filtrar por tabla
  accion?: 'UPDATE',                 // Filtrar por tipo de acción
  fechaDesde?: '2026-01-01',         // Fecha inicio (YYYY-MM-DD o ISO)
  fechaHasta?: '2026-01-31',         // Fecha fin
  limite?: 50                        // Registros a retornar (default: 100)
};

const logs = await obtenerLog(filtros);
```

**Ejemplo completo:**
```javascript
const logs = await obtenerLog({
  tabla: 'clientes',
  accion: 'UPDATE',
  fechaDesde: '2026-01-01',
  limite: 25
});
```

---

### `obtenerResumenUsuario(usuario, dias)`

Obtiene resumen de actividades realizadas por un usuario en los últimos N días.

**Parámetros:**
- `usuario` (string): Email del usuario
- `dias` (number): Últimos N días (default: 7)

**Ejemplo:**
```javascript
const resumen = await obtenerResumenUsuario('admin@bot.com', 7);

// Retorna:
{
  usuario: 'admin@bot.com',
  periodo: 'Últimos 7 días',
  actividades: [
    { accion: 'UPDATE', tabla: 'clientes', cantidad: 12 },
    { accion: 'INSERT', tabla: 'mensajes', cantidad: 8 },
    { accion: 'DELETE', tabla: 'clientes', cantidad: 1 }
  ]
}
```

---

### `limpiarLogAntiguos(dias)`

Elimina registros de auditoría más antiguos que N días (limpieza automática).

**Parámetros:**
- `dias` (number): Eliminar registros más antiguos a N días (default: 90)

**Ejemplo:**
```javascript
const resultado = await limpiarLogAntiguos(90);

// Retorna:
{
  success: true,
  eliminados: 1542  // Registros eliminados
}
```

---

## Endpoints REST

### `GET /api/audit-log`

Lista el audit log con filtros opcionales.

**Queryparams:**
```
GET /api/audit-log?tabla=clientes&usuario=admin@bot.com&accion=UPDATE&limite=50&fechaDesde=2026-01-01
```

**Headers requeridos:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Respuesta:**
```json
{
  "success": true,
  "cantidad": 12,
  "logs": [
    {
      "id": 45,
      "usuario": "admin@bot.com",
      "accion": "UPDATE",
      "tabla": "clientes",
      "id_registro": "541234567890",
      "ip_address": "192.168.1.100",
      "timestamp": "2026-01-07 14:30:00"
    }
  ]
}
```

---

### `GET /api/audit-log/historial/:tabla/:idRegistro`

Obtiene el historial completo de cambios de un registro específico.

**Ejemplo:**
```
GET /api/audit-log/historial/clientes/541234567890
```

**Respuesta:**
```json
{
  "success": true,
  "tabla": "clientes",
  "idRegistro": "541234567890",
  "cambios": 3,
  "historial": [
    {
      "id": 47,
      "usuario": "admin@bot.com",
      "accion": "UPDATE",
      "valores_anteriores": { "padron": null },
      "valores_nuevos": { "padron": "12345" },
      "timestamp": "2026-01-07 14:35:00"
    }
  ]
}
```

---

### `GET /api/audit-log/resumen/:usuario`

Obtiene resumen de actividades de un usuario.

**Ejemplo:**
```
GET /api/audit-log/resumen/admin@bot.com?dias=7
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "usuario": "admin@bot.com",
    "periodo": "Últimos 7 días",
    "actividades": [
      { "accion": "UPDATE", "tabla": "clientes", "cantidad": 12 },
      { "accion": "INSERT", "tabla": "mensajes", "cantidad": 8 }
    ]
  }
}
```

---

### `POST /api/audit-log/limpiar`

Elimina registros de auditoría antiguos. **Solo administradores.**

**Body:**
```json
{
  "dias": 90
}
```

**Respuesta:**
```json
{
  "success": true,
  "eliminados": 1542
}
```

---

## Integración en Servicios

### Ejemplo: `clienteService.js`

```javascript
const { registrarCambio } = require('./auditService');

// En la función actualizarDni()
const actualizarDni = async (telefono, dni, usuario = 'SYSTEM') => {
  return withTransaction(async (connection) => {
    // ... lógica de transacción
    
    // Registrar el cambio en auditoría
    await registrarCambio(
      usuario,
      'UPDATE',
      'clientes',
      telefono,
      { padron: valoresAnteriores.padron },
      { padron: dni },
      ipAddress  // Obtener de req.clientIp en el controlador
    );
  });
};
```

---

## Casos de Uso

### 1. **Compliance & Auditoría**
```javascript
// Obtener todos los cambios en la última semana
const logs = await obtenerLog({
  fechaDesde: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  limite: 1000
});
```

### 2. **Debugging - ¿Quién cambió este registro?**
```javascript
const historial = await obtenerHistorial('clientes', '541234567890');
// Muestra cada cambio con usuario, timestamp, valores anteriores/nuevos
```

### 3. **Monitoreo de Usuario**
```javascript
const actividad = await obtenerResumenUsuario('admin@bot.com', 30);
// Detectar cambios sospechosos o exceso de actividad
```

### 4. **Limpieza Automática**
```javascript
// Ejecutar cada 30 días (en un cron job)
await limpiarLogAntiguos(90);  // Mantener últimos 90 días
```

---

## Indices de Base de Datos

El audit log incluye **4 índices clave** para optimizar queries comunes:

```sql
INDEX idx_usuario_timestamp (usuario, timestamp)    -- Búsquedas por usuario
INDEX idx_tabla_id (tabla, id_registro)             -- Historial de un registro
INDEX idx_accion (accion)                           -- Búsquedas por tipo
INDEX idx_timestamp (timestamp)                     -- Limpieza de registros antiguos
```

**Complejidad de queries:** O(log n) en tabla con millones de registros ✅

---

## Consideraciones de Seguridad

1. **Autenticación:** Todos los endpoints requieren JWT válido (`verifyToken`)
2. **Autorización:** POST /api/audit-log/limpiar solo para admins
3. **IP Tracking:** Se registra IP de cada cambio para auditoría forense
4. **Serialización:** Valores JSON se almacenan en texto para auditoría completa
5. **Inmutabilidad:** Los registros del audit log nunca se modifican (solo DELETE)

---

## Performance

- **Crecimiento:** ~5-10 registros por operación × N usuarios × horas = ~500K/mes
- **Almacenamiento:** ~1MB por 10K registros (con índices)
- **Limpieza:** Ejecutar `limpiarLogAntiguos(90)` mensualmente
- **Archivado:** Considerar exportar a S3 antes de eliminar

---

## Monitoreo y Alertas

Ejemplo de query para detectar anomalías:
```sql
-- Usuarios con > 100 cambios en 1 hora
SELECT usuario, COUNT(*) as cambios, MAX(timestamp) as ultima_actividad
FROM audit_log
WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
GROUP BY usuario
HAVING COUNT(*) > 100;
```

---

## Roadmap Futuro

- [ ] Triggers automáticos en BD para INSERT/UPDATE/DELETE
- [ ] Elasticsearch para búsquedas full-text
- [ ] Webhooks para notificaciones de cambios sospechosos
- [ ] Dashboard de auditoría en frontend
- [ ] Exportación a formato PDF/CSV
- [ ] Integración con SIEM (Splunk, ELK, Datadog)
