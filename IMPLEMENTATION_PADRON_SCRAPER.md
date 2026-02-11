# Flujo Completo de Scraping con Padrón

## Diagrama de Flujo - Consulta de Deuda con Padrón

```
┌─────────────────────────────────────────┐
│  Usuario selecciona "Consultar Deuda"   │
└──────────────────┬──────────────────────┘
                   ↓
        handleConsultarDeuda()
                   ↓
    ┌─────────────────────────────────┐
    │ ¿Tiene padrón guardado?         │
    │ (superficial/subterraneo/conta) │
    └─────────────────────────────────┘
         │                │                │
        SÍ                │               NO
         ↓               SÍ                ↓
      Direct           (otro             SHOW
      Scraper          tipo)           MODAL:
         │                ↓             "DNI o
         │             Direct           Padrón?"
         │             Scraper             │
         ├──────────────┴───────────────┤  │
         │                              │  │
         ↓                              ↓  ↓
    Estado:                    Usuario
    AWAITING_OPCION_            selecciona
    BOLETO_PADRON               opción
         ↓
    ┌────────────────────────────┐
    │ ¿Deseas boleto?            │
    │ [Anual] [Bimestral] [No]   │
    └────────────────────────────┘
         │                │               │
         │                │               └──→ Menu
         ↓                ↓
      Anual            Bimestral
         │                │
         └────────┬───────┘
                  ↓
         handleOpcionBoletoPadron()
                  ↓
         ejecutarScraperBoletoPadron()
                  ↓
         _scrapeBoletonPadron()
                  ↓
         PDF descargado y enviado
                  ↓
         Menu principal
```

## Implementación de `_scrapeDeudaYBoletoPadron()`

### PASO 1: Seleccionar tipo de padrón

```javascript
// Busca el selector con opciones A (Superficial), B (Subterráneo), C (Contaminación)
// Puede ser un <select> HTML o un combo box personalizado

if (tipoPadron === 'superficial') tipoCodigo = 'A'
else if (tipoPadron === 'subterraneo') tipoCodigo = 'B'
else if (tipoPadron === 'contaminacion') tipoCodigo = 'C'

// Selecciona la opción en el selector
```

### PASO 2: Llenar campos según tipo

**A) Padrón Superficial**
```
Campo 1 (izquierda) ← Código de cauce (ej: 8234)
Campo 2 (derecha)  ← Número de padrón (ej: 1710)
```

**B) Padrón Subterráneo**
```
Campo 1 (izquierda) ← Código de departamento (ej: 10)
Campo 2 (derecha)  ← N° de pozo (ej: 5)
```

**C) Padrón Contaminación**
```
Campo 1 (izquierda) ← N° de contaminación (ej: 12345)
```

### PASO 3: Clic en botón "Buscar"

```
Busca y hace clic en botón "Buscar"
Espera 2 segundos para que carguen resultados
```

### PASO 4: Verificar que aparecieron resultados

```
Valida que en la página aparecen:
- "Cuota Anual"
- "Cuota Bimestral"

Si no están, busca mensaje de error tipo "No se encontró"
```

### PASO 5: Clic en botón "Calcular Deuda"

```
Busca botón "Calcular Deuda" o "Consultar Deuda"
Hace clic y espera navegación
```

### PASO 6: Extraer datos de deuda

```javascript
datos_deuda = {
  titular: "NOMBRE DEL TITULAR",
  cuit: "11-22222222-3",
  hectareas: "25.50",
  capital: "$ 1.234,56",
  interes: "$ 100,50",
  apremio: "$ 50,00",
  eventuales: "$ 25,00",
  total: "$ 1.410,06"
}
```

### PASO 7: Descargar PDF

```
Busca botón "Imprimir", "PDF" o "Descargar"
Hace clic y espera descarga del PDF
Renombra archivo con ID único
```

## Implementación de `_scrapeBoletonPadron()`

**Pasos 1-4**: Igual a `_scrapeDeudaYBoletoPadron()`

### PASO 5: Seleccionar tipo de cuota

```javascript
// Busca botón con texto "Cuota Anual" o "Cuota Bimestral"
// Hace clic en el tipo solicitado

if (tipoCuota === 'anual')
  Click en button "Cuota Anual"
else if (tipoCuota === 'bimestral')
  Click en button "Cuota Bimestral"
```

### PASO 6: Clic en "Imprimir" y descargar PDF

```
Busca botón "Imprimir", "PDF" o "Descargar"
Hace clic
Espera 5 segundos
Busca archivo PDF descargado
Renombra y retorna ruta
```

## Handlers en webhookController.js

### `handleModoConsulta(from, option)`
```
Recibe: "modo_dni" | "modo_padron"

if modo_dni:
  → State: AWAITING_DNI / AWAITING_DNI_BOLETO
  → Prompt: "Ingresa DNI"
  
if modo_padron:
  → State: AWAITING_TIPO_PADRON
  → Buttons: [A) Superficial, B) Subterráneo, C) Contaminación]
```

### `handleTipoPadron(from, option)`
```
Recibe: "tipo_padron_a" | "tipo_padron_b" | "tipo_padron_c"

→ Guarda tipo en: userStates[from].tempTipoPadron
→ Prompt apropiado según tipo
→ State: AWAITING_PADRON_SUPERFICIAL | AWAITING_PADRON_SUBTERRANEO | AWAITING_PADRON_CONTAMINACION
```

### `handlePadronSuperficial(from, messageBody)`
```
Input: "8234 1710"

1. Valida: debe tener 2 componentes separados por espacio
2. Guarda en BD: clienteService.actualizarPadronSuperficial()
3. Si es deuda:
   → ejecutarScraperPadron(from, cliente, 'superficial')
   → Extrae deuda
   → State: AWAITING_OPCION_BOLETO_PADRON
4. Si es boleto:
   → Pregunta tipo de cuota
   → State: AWAITING_TIPO_CUOTA_PADRON
```

### `handlePadronSubterraneo(from, messageBody)`
```
Input: "10 5"

1. Valida: debe tener 2 componentes
2. Guarda en BD: clienteService.actualizarPadronSubterraneo()
3. Continúa igual a Superficial
```

### `handlePadronContaminacion(from, messageBody)`
```
Input: "12345"

1. Valida: no vacío
2. Guarda en BD: clienteService.actualizarPadronContaminacion()
3. Continúa igual a Superficial
```

### `handleTipoCuotaPadron(from, option)`
```
Recibe: "cuota_anual" | "cuota_bimestral"

→ ejecutarScraperBoletoPadron(from, padronData, tipoPadron, tipoCuota)
→ Llama a debtScraperService.obtenerBoletoPadron()
→ Descarga y envía PDF
→ State: MAIN_MENU
```

### `handleOpcionBoletoPadron(from, option)`
```
Recibe: "pedir_boleto_anual" | "pedir_boleto_bimestral" | "sin_boleto"

if sin_boleto:
  → Menu
  
if boleto:
  → Pregunta tipo de cuota
  → State: AWAITING_TIPO_CUOTA_PADRON
```

## Llamadas a debtScraperService

### `obtenerDeudaPadron(tipoPadron, datos)`

**Parámetros:**
```javascript
tipoPadron: 'superficial' | 'subterraneo' | 'contaminacion'

// Para superficial:
datos: { codigoCauce: "8234", numeroPadron: "1710" }

// Para subterraneo:
datos: { codigoDepartamento: "10", numeroPozo: "5" }

// Para contaminacion:
datos: { numeroContaminacion: "12345" }
```

**Retorna:**
```javascript
{
  success: true,
  data: {
    titular: "...",
    cuit: "...",
    hectareas: "...",
    capital: "...",
    interes: "...",
    apremio: "...",
    eventuales: "...",
    total: "..."
  },
  pdfPath: "/temp/...",
  absolutePdfPath: "/ruta/completa/..."
}
```

### `obtenerBoletoPadron(tipoPadron, datos, tipoCuota)`

**Parámetros:**
```javascript
tipoPadron: 'superficial' | 'subterraneo' | 'contaminacion'
datos: { mismo que obtenerDeudaPadron }
tipoCuota: 'anual' | 'bimestral'
```

**Retorna:**
```javascript
{
  success: true,
  pdfPath: "/ruta/al/boleto.pdf"
}
```

## Base de Datos

**Tabla clientes** - Nuevas columnas:

```sql
padron_superficial VARCHAR(100)          -- "8234 1710"
padron_subterraneo VARCHAR(100)          -- "10 5"
padron_contaminacion VARCHAR(100)        -- "12345"
tipo_consulta_preferido VARCHAR(20)      -- "superficial"
```

**Métodos clienteService.js:**

```javascript
// Obtener todos los datos del cliente
obtenerCliente(telefono)
  → { telefono, padron_superficial, padron_subterraneo, ... }

// Guardar padrón superficial
actualizarPadronSuperficial(telefono, codigoCauce, numeroPadron)
  → UPDATE ... SET padron_superficial = "8234 1710", tipo_consulta_preferido = "superficial"

// Guardar padrón subterráneo
actualizarPadronSubterraneo(telefono, codigoDepartamento, numeroPozo)
  → UPDATE ... SET padron_subterraneo = "10 5", tipo_consulta_preferido = "subterraneo"

// Guardar padrón contaminación
actualizarPadronContaminacion(telefono, numeroContaminacion)
  → UPDATE ... SET padron_contaminacion = "12345", tipo_consulta_preferido = "contaminacion"
```

## Estados de Usuario

**Máquina de estados completa:**

```
MAIN_MENU
  ├─ "Consultar Deuda" / "Pedir Boleto"
  │   ↓
  │   handleConsultarDeuda() / handlePedirBoleto()
  │   ├─ ¿Tiene padrón? → ejecutarScraperPadron()
  │   ├─ ¿Tiene DNI? → ejecutarScraper()
  │   └─ Mostrar modal → AWAITING_MODO_CONSULTA
  │       ↓
  │       handleModoConsulta()
  │       ├─ "Por DNI" → AWAITING_DNI / AWAITING_DNI_BOLETO
  │       │   ↓
  │       │   [Usuario ingresa DNI]
  │       │
  │       └─ "Por Padrón" → AWAITING_TIPO_PADRON
  │           ↓
  │           handleTipoPadron()
  │           ├─ "A) Superficial" → AWAITING_PADRON_SUPERFICIAL
  │           ├─ "B) Subterráneo" → AWAITING_PADRON_SUBTERRANEO
  │           └─ "C) Contaminación" → AWAITING_PADRON_CONTAMINACION
  │               ↓
  │               [Usuario ingresa datos]
  │               ↓
  │               handlePadronSuperficial() / Subterraneo / Contaminacion
  │               ├─ Guarda en BD
  │               ├─ ejecutarScraperPadron() → extrae deuda
  │               └─ AWAITING_OPCION_BOLETO_PADRON
  │                   ↓
  │                   handleOpcionBoletoPadron()
  │                   ├─ "Boleto Anual" → AWAITING_TIPO_CUOTA_PADRON
  │                   ├─ "Boleto Bimestral" → AWAITING_TIPO_CUOTA_PADRON
  │                   │   ↓
  │                   │   handleTipoCuotaPadron()
  │                   │   ↓
  │                   │   ejecutarScraperBoletoPadron()
  │                   │   ↓
  │                   │   PDF descargado y enviado
  │                   │
  │                   └─ "No, gracias" → MAIN_MENU
  │
  └─ MAIN_MENU
```

## Pruebas Manuales

### Test 1: Deuda por Padrón Superficial

```
1. Usuario: "Consultar Deuda"
2. Bot: Modal "¿DNI o Padrón?"
3. Usuario: Click "Por Padrón"
4. Bot: Buttons A/B/C
5. Usuario: Click "A) Superficial"
6. Bot: "Ingresa código de cauce y padrón (ej: 8234 1710)"
7. Usuario: "8234 1710"
8. Bot: Ejecuta scraper, muestra deuda
9. Bot: "¿Boleto? [Anual] [Bimestral]"
10. Usuario: Click "Anual"
11. Bot: Descarga y envía PDF
12. Bot: Menu principal
```

### Test 2: Boleto Directo con Padrón Guardado

```
1. Usuario: "Pedir Boleto"
2. Bot: Verifica que tiene padrón_superficial guardado
3. Bot: "¿Boleto Anual o Bimestral?"
4. Usuario: "Anual"
5. Bot: Ejecuta scraper de boleto
6. Bot: Envía PDF
7. Bot: Menu principal
```

### Test 3: DNI Fallback

```
1. Usuario: "Consultar Deuda"
2. Bot: No tiene padrón, pero tiene DNI
3. Bot: Usa ejecutarScraper(dni) en lugar de padrón
4. Continúa flujo normal DNI
```

## Archivos Modificados

| Archivo | Cambios |
|---------|---------|
| `webhookController.js` | +6 nuevos handlers, +1 case AWAITING_OPCION_BOLETO_PADRON, implementación de ejecutarScraperPadron() |
| `debtScraperService.js` | +2 funciones públicas (obtenerDeudaPadron, obtenerBoletoPadron), +2 funciones internas, +2 exports |
| `clienteService.js` | +4 métodos nuevos (obtenerCliente, actualizarPadronSuperficial, etc.) |
| `db.js` | +4 columnas en tabla clientes (ya migradas) |

## TODO

- [ ] Testing en ambiente real con página de irrigación
- [ ] Ajustar selectores si cambian en la página
- [ ] Validar formatos de padrón según datos reales
- [ ] Manejo de edge cases (padrón inexistente, timeout, etc.)
- [ ] Logging mejorado para debugging
