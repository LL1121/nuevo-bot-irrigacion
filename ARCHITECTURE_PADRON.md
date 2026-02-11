# Arquitectura Multi-Método de Consulta (DNI + Padrón)

## Flujo Completo Implementado

### 1. Entrada: Consultar Deuda o Pedir Boleto

```
Usuario selecciona "Consultar Deuda" o "Pedir Boleto"
    ↓
handleConsultarDeuda() / handlePedirBoleto()
    ↓
┌─────────────────────────────────────────────┐
│ Check cliente.padron_superficial            │ ← Tiene padrón? ✓
│ ├─ SI → ejecutarScraperPadron(tipo)         │
│ ├─ NO → check cliente.padron_subterraneo    │
│ │   └─ Tiene? → ejecutarScraperPadron(tipo) │
│ ├─ NO → check cliente.padron_contaminacion  │
│ │   └─ Tiene? → ejecutarScraperPadron(tipo) │
│ ├─ NO → check cliente.dni                   │
│ │   └─ Tiene? → ejecutarScraper(dni)        │
│ └─ NO → SHOW MODAL (DNI vs Padrón)          │
└─────────────────────────────────────────────┘
```

### 2. Modal: Selección de Método

```
Usuario recibe:
┌──────────────────────────────┐
│ 🆔 Por DNI                   │ button-reply
│ 📋 Por Padrón                │
└──────────────────────────────┘

State → AWAITING_MODO_CONSULTA
userStates[from].operacion = 'deuda' | 'boleto'
```

### 3. Respuesta: handleModoConsulta()

```
Usuario presiona botón
    ↓
if (option === 'modo_dni')
    → userStates[from].step = 'AWAITING_DNI' | 'AWAITING_DNI_BOLETO'
    → Mensaje: "Ingresa DNI..."
    ↓
else if (option === 'modo_padron')
    → userStates[from].step = 'AWAITING_TIPO_PADRON'
    → Envía modal con A/B/C
```

### 4. Selección de Tipo de Padrón

```
Usuario recibe:
┌──────────────────────────────┐
│ 🌾 A) Superficial            │
│ 💧 B) Subterráneo            │
│ 🛢️ C) Contaminación          │
└──────────────────────────────┘

State → AWAITING_TIPO_PADRON
```

### 5. Respuesta: handleTipoPadron()

```
Usuario selecciona tipo
    ↓
if (option === 'tipo_padron_a')
    → State: AWAITING_PADRON_SUPERFICIAL
    → Prompt: "Ingresa código de cauce y número de padrón (ej: 8234 1710)"
    → Guarda tipo en: userStates[from].tempTipoPadron = 'superficial'
    ↓
if (option === 'tipo_padron_b')
    → State: AWAITING_PADRON_SUBTERRANEO
    → Prompt: "Ingresa código de departamento y número de pozo (ej: 10 5)"
    → Guarda tipo en: userStates[from].tempTipoPadron = 'subterraneo'
    ↓
if (option === 'tipo_padron_c')
    → State: AWAITING_PADRON_CONTAMINACION
    → Prompt: "Ingresa número de contaminación (ej: 12345)"
    → Guarda tipo en: userStates[from].tempTipoPadron = 'contaminacion'
```

### 6. Ingreso de Datos de Padrón

#### A) Padrón Superficial

```
Usuario envía: "8234 1710"
    ↓
handlePadronSuperficial()
    ├─ Parse: const [codigoCauce, numeroPadron] = messageBody.split()
    ├─ Validate: if (partes.length !== 2) → error
    ├─ Save DB: clienteService.actualizarPadronSuperficial(
    │     from, 
    │     codigoCauce,    // "8234"
    │     numeroPadron    // "1710"
    │   )
    └─ IF Operación = "boleto"
        → State: AWAITING_TIPO_CUOTA_PADRON
        → Prompt: "¿Cuota Anual o Bimestral?"
        ↓
      ELSE (operación = "deuda")
        → ejecutarScraperPadron(from, cliente, 'superficial')
```

#### B) Padrón Subterráneo

```
Usuario envía: "10 5"
    ↓
handlePadronSubterraneo()
    ├─ Parse: const [codigoDepartamento, numeroPozo] = messageBody.split()
    ├─ Validate: if (partes.length !== 2) → error
    ├─ Save DB: clienteService.actualizarPadronSubterraneo(
    │     from,
    │     codigoDepartamento,  // "10"
    │     numeroPozo           // "5"
    │   )
    └─ Continúa igual a Superficial
```

#### C) Padrón Contaminación

```
Usuario envía: "12345"
    ↓
handlePadronContaminacion()
    ├─ Validate: if (!numeroContaminacion) → error
    ├─ Save DB: clienteService.actualizarPadronContaminacion(
    │     from,
    │     numeroContaminacion  // "12345"
    │   )
    └─ Continúa igual a Superficial
```

### 7. Para Boletos: Selección de Cuota

```
State: AWAITING_TIPO_CUOTA_PADRON
Usuario recibe:
┌──────────────────────────────┐
│ 📅 Cuota Anual               │
│ 📆 Cuota Bimestral           │
└──────────────────────────────┘
```

### 8. Respuesta: handleTipoCuotaPadron()

```
Usuario selecciona cuota
    ↓
if (option === 'cuota_anual')
    → tipoCuota = 'anual'
    ↓
else if (option === 'cuota_bimestral')
    → tipoCuota = 'bimestral'
    ↓
ejecutarScraperBoletoPadron(
    from,
    userStates[from].tempPadron,      // "8234 1710"
    userStates[from].tempTipoPadron,  // "superficial"
    tipoCuota                         // "anual"
)
    ↓
State: MAIN_MENU
```

## Base de Datos

### Tabla: clientes

```sql
-- Nuevas columnas agregadas:
ALTER TABLE clientes ADD COLUMN padron_superficial VARCHAR(100);
ALTER TABLE clientes ADD COLUMN padron_subterraneo VARCHAR(100);
ALTER TABLE clientes ADD COLUMN padron_contaminacion VARCHAR(100);
ALTER TABLE clientes ADD COLUMN tipo_consulta_preferido VARCHAR(20);

-- Ejemplo de datos guardados:
telefono: "5491234567"
padron_superficial: "8234 1710"
padron_subterraneo: NULL
padron_contaminacion: NULL
tipo_consulta_preferido: "superficial"
```

### Métodos clienteService.js

```javascript
obtenerCliente(telefono)
  → SELECT * FROM clientes WHERE telefono = ?
  → Retorna: { telefono, padron_superficial, padron_subterraneo, etc... }

actualizarPadronSuperficial(telefono, codigoCauce, numeroPadron)
  → UPDATE clientes SET 
      padron_superficial = '{codigoCauce} {numeroPadron}',
      tipo_consulta_preferido = 'superficial'
    WHERE telefono = ?

actualizarPadronSubterraneo(telefono, codigoDepartamento, numeroPozo)
  → UPDATE clientes SET 
      padron_subterraneo = '{codigoDepartamento} {numeroPozo}',
      tipo_consulta_preferido = 'subterraneo'
    WHERE telefono = ?

actualizarPadronContaminacion(telefono, numeroContaminacion)
  → UPDATE clientes SET 
      padron_contaminacion = '{numeroContaminacion}',
      tipo_consulta_preferido = 'contaminacion'
    WHERE telefono = ?
```

## Máquina de Estados

```
MAIN_MENU (usuario selecciona opción)
    ↓
handleConsultarDeuda() / handlePedirBoleto()
    ↓
[Check padrón existing...]
    ↓
AWAITING_MODO_CONSULTA (usuario no tiene padrón ni DNI guardado)
    ├─ Button: "Por DNI" → AWAITING_DNI / AWAITING_DNI_BOLETO
    └─ Button: "Por Padrón" → AWAITING_TIPO_PADRON
        ↓
        ├─ Button: "A) Superficial" → AWAITING_PADRON_SUPERFICIAL
        ├─ Button: "B) Subterráneo" → AWAITING_PADRON_SUBTERRANEO
        └─ Button: "C) Contaminación" → AWAITING_PADRON_CONTAMINACION
            ↓
            [Procesar datos, guardar en DB]
            ↓
            IF boleto:
                AWAITING_TIPO_CUOTA_PADRON
                ├─ Button: "Anual" → ejecutarScraperBoletoPadron()
                └─ Button: "Bimestral" → ejecutarScraperBoletoPadron()
            ↓
            MAIN_MENU
```

## Handlers Agregados

### 1. handleModoConsulta(from, option)
- Recibe: "modo_dni" | "modo_padron"
- Acción: Rutea a DNI o padrón según selección
- Siguiente State: AWAITING_DNI / AWAITING_TIPO_PADRON

### 2. handleTipoPadron(from, option)
- Recibe: "tipo_padron_a" | "tipo_padron_b" | "tipo_padron_c"
- Acción: Muestra prompt apropiado, guarda tipo en tempTipoPadron
- Siguiente State: AWAITING_PADRON_*

### 3. handlePadronSuperficial(from, messageBody)
- Valida: Dos componentes separados por espacio
- Guarda: clienteService.actualizarPadronSuperficial()
- Siguiente: ejecutarScraperPadron() o Estado de cuota

### 4. handlePadronSubterraneo(from, messageBody)
- Valida: Dos componentes separados por espacio
- Guarda: clienteService.actualizarPadronSubterraneo()
- Siguiente: ejecutarScraperPadron() o Estado de cuota

### 5. handlePadronContaminacion(from, messageBody)
- Valida: Número válido no vacío
- Guarda: clienteService.actualizarPadronContaminacion()
- Siguiente: ejecutarScraperPadron() o Estado de cuota

### 6. handleTipoCuotaPadron(from, option)
- Recibe: "cuota_anual" | "cuota_bimestral"
- Acción: Llama a ejecutarScraperBoletoPadron()
- Siguiente State: MAIN_MENU

### 7. ejecutarScraperBoletoPadron(from, padronData, tipoPadron, tipoCuota)
- Parsea padrón según tipo
- Ejecuta scraper con parámetros de padrón
- PLACEHOLDER: Necesita implementación en debtScraperService

## Casos de Uso Cubiertos

### 1. Usuario con padrón superficial guardado
```
Consultar deuda → Check padron_superficial → ejecutarScraperPadron('superficial')
```

### 2. Usuario sin padrón pero con DNI
```
Consultar deuda → Check dni → ejecutarScraper(dni)
```

### 3. Usuario nuevo sin nada
```
Consultar deuda → Show modal → Usuario elige "Por Padrón" → Ingresa datos → Guarda padrón → ejecutarScraperPadron()
```

### 4. Usuario quiere cambiar de método
```
Durante la sesión de modal, puede elegir DNI en lugar de padrón
→ Se guarda la preferencia en la BD
→ Próxima consulta usa el método elegido
```

## Próximos Pasos (TODO)

1. **Implementar scrapers con padrón** en debtScraperService.js
   - Parsear parámetros según tipo de padrón
   - Inyectar valores en formularios de la web
   - Extraer deuda y generar boletos con padrón

2. **Mapear URLs** de la página de consulta
   - ¿Cómo se pasan los parámetros de padrón?
   - ¿Qué selectores se usan para cada tipo?

3. **Testing de flujos**
   - Probar cada tipo de padrón
   - Validar parsing de inputs
   - Verificar guardado en BD

4. **Manejo de errores**
   - Si el padrón no existe en el sistema
   - Si hay timeout del scraper
   - Fallback a DNI si padrón falla

## Resumen de Cambios

| Archivo | Cambios | Status |
|---------|---------|--------|
| webhookController.js | +5 cases, +6 handlers | ✅ Completo |
| clienteService.js | +4 métodos | ✅ Completo |
| db.js | +4 columnas (migración) | ✅ Completo |
| debtScraperService.js | Necesita implementación padrón | ⏳ TODO |

## Notas de Implementación

- Los datos se guardan en la BD de forma persistente
- Se usa la preferencia guardada en próximas consultas (si_existent())
- Los estados se manejan con máquina de estados simple
- Los inputs se validan antes de guardar
- Se soportan 3 tipos de padrón con requisitos distintos
