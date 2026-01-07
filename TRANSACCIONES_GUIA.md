# 🔄 GUÍA DE TRANSACCIONES - Bot Irrigación

## ¿QUÉ TRANSACCIONES TENEMOS IMPLEMENTADAS?

### 1️⃣ **Guardar Mensaje + Actualizar Cliente**
**Archivo:** `src/services/mensajeService.js` - `guardarMensaje()`

```javascript
// ANTES (SIN transacción):
await guardarMensaje(datos);        // ✅ Guardado
// Si falla aquí → Cliente nunca se actualiza ❌

// AHORA (CON transacción):
await guardarMensaje(datos);
// Si falla algo en medio → TODO se revierte ✅
```

**Operaciones Atómicas:**
1. INSERT en tabla `mensajes`
2. UPDATE en tabla `clientes` (última_interacción)

---

### 2️⃣ **Marcar Mensajes como Leídos + Actualizar Cliente**
**Archivo:** `src/services/mensajeService.js` - `marcarComoLeido()`

```javascript
await marcarComoLeido(telefono);
// Operación 1: UPDATE mensajes SET leido = TRUE
// Operación 2: UPDATE clientes SET ultima_interaccion = NOW()
// Ambas juntas o ninguna ✅
```

**Operaciones Atómicas:**
1. UPDATE en tabla `mensajes` (marcar como leído)
2. UPDATE en tabla `clientes` (timestamp)

---

### 3️⃣ **Actualizar DNI del Cliente**
**Archivo:** `src/services/clienteService.js` - `actualizarDni()`

```javascript
await actualizarDni(telefono, dni);
// Operación 1: UPDATE clientes SET padron, ultima_interaccion
// Garantiza consistencia ✅
```

**Operaciones Atómicas:**
1. UPDATE en tabla `clientes` (DNI + timestamp)

---

## 🛠️ CÓMO USAR TRANSACCIONES EN TU CÓDIGO

### Forma 1: withTransaction (RECOMENDADO)

```javascript
const { withTransaction } = require('../services/transactionService');

const miOperacion = async (datos) => {
  return withTransaction(async (connection) => {
    try {
      // Operación 1
      const [result1] = await connection.execute(
        'INSERT INTO tabla1 ...',
        [param1, param2]
      );
      
      // Operación 2
      const [result2] = await connection.execute(
        'UPDATE tabla2 SET ... WHERE ...',
        [param3]
      );
      
      // Si llega aquí, COMMIT automático
      return { success: true, data: result1 };
    } catch (error) {
      // Si falla algo, ROLLBACK automático
      throw error;
    }
  });
};
```

### Forma 2: executeTransaction (Simple)

```javascript
const { executeTransaction } = require('../services/transactionService');

const resultado = await executeTransaction([
  {
    query: 'INSERT INTO mensajes (cliente_telefono, cuerpo) VALUES (?, ?)',
    params: ['5491234567890', 'Hola']
  },
  {
    query: 'UPDATE clientes SET ultima_interaccion = NOW() WHERE telefono = ?',
    params: ['5491234567890']
  }
]);
```

### Forma 3: safeTransaction (Con Manejo de Errores)

```javascript
const { safeTransaction } = require('../services/transactionService');

const resultado = await safeTransaction(async (connection) => {
  // tus operaciones aquí
  return data;
}, 'Mi operación crítica');

if (resultado.success) {
  console.log('✅ Éxito:', resultado.data);
} else {
  console.error('❌ Error:', resultado.error);
}
```

---

## 📋 GARANTÍAS ACID

### **Atomicity (Atomicidad)**
- ✅ Todo se ejecuta o nada
- ✅ No hay estados intermedios
- ✅ Ejemplo: Si falla el UPDATE, el INSERT se revierte

### **Consistency (Consistencia)**
- ✅ La BD siempre está en estado válido
- ✅ No hay violaciones de constraints
- ✅ Ejemplo: Nunca hay un mensaje sin cliente

### **Isolation (Aislamiento)**
- ✅ Dos transacciones no interfieren
- ✅ Cambios visibles solo después de COMMIT
- ✅ Previene race conditions

### **Durability (Durabilidad)**
- ✅ Una vez commitido, persiste siempre
- ✅ Incluso si el servidor cae
- ✅ Respaldado por MySQL InnoDB

---

## 🚨 ERRORES COMUNES

### ❌ Olvidar usar transacción
```javascript
// MAL - Sin protección:
await conexion1.execute('INSERT ...');
await conexion2.execute('UPDATE ...');
// Si conexion2 falla, INSERT queda huérfano ❌
```

### ✅ Usar transacción
```javascript
// BIEN - Protegido:
return withTransaction(async (connection) => {
  await connection.execute('INSERT ...');
  await connection.execute('UPDATE ...');
  // Ambas juntas o ninguna ✅
});
```

### ❌ No re-throw el error
```javascript
withTransaction(async (connection) => {
  try {
    // operaciones
  } catch (error) {
    console.error(error);
    // ❌ SIN throw → NO ROLLBACK
  }
});
```

### ✅ Re-throw el error
```javascript
withTransaction(async (connection) => {
  try {
    // operaciones
  } catch (error) {
    console.error(error);
    throw error; // ✅ TRIGGER ROLLBACK
  }
});
```

---

## 📊 FLUJO DE UNA TRANSACCIÓN

```
┌─────────────────────────────────────┐
│  User calls guardarMensaje(datos)   │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│  withTransaction() START            │
│  ▶ getConnection()                  │
│  ▶ beginTransaction()               │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│  OPERACIÓN 1: INSERT mensaje        │
│  ✅ Éxito                            │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│  OPERACIÓN 2: UPDATE cliente        │
│  ✅ Éxito                            │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│  ✅ COMMIT                          │
│  Todas las operaciones persisten    │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│  connection.release()               │
│  Return resultado                   │
└─────────────────────────────────────┘
```

---

## 🔍 DEBUGGING TRANSACCIONES

### Ver logs de transacciones:
```bash
npm start 2>&1 | grep -i "transacción\|commit\|rollback"
```

### Formato de logs:
```
🔄 INICIANDO TRANSACCIÓN
   ▶ Ejecutando: INSERT INTO mensajes...
   ✅ Mensaje insertado - ID: 123
   ▶ Ejecutando: UPDATE clientes...
   ✅ Cliente actualizado - Filas afectadas: 1
✅ TRANSACCIÓN COMPLETADA (COMMIT)
```

### Si algo falla:
```
🔄 INICIANDO TRANSACCIÓN
   ▶ Ejecutando: INSERT INTO mensajes...
   ✅ Mensaje insertado - ID: 123
   ▶ Ejecutando: UPDATE clientes...
   ❌ Error: Column 'telefono' not found
⏮️  TRANSACCIÓN REVERTIDA (ROLLBACK)
```

---

## 📈 PRÓXIMAS TRANSACCIONES A IMPLEMENTAR

- [ ] Upload archivo + persistencia en BD
- [ ] Scraper + guardar resultado + descarga PDF
- [ ] Pagar deuda + actualizar estado
- [ ] Bulk operations (múltiples mensajes)

---

**Versión:** 1.0.0  
**Última actualización:** 7 Enero 2026  
**Garantía ACID:** ✅ Implementada en todas las operaciones críticas
